/**
 * Prepper Field Guide Pro — Stripe sales + automatic license issuing (Cloudflare Worker).
 *
 * Flow:  "Buy" button → POST /api/checkout → Stripe Checkout (hosted; cards, Apple Pay, Google Pay, Link)
 *        → Stripe redirects to /success?session_id=… → worker re-reads the session from Stripe,
 *        verifies it's paid and is this product → Ed25519-signed key shown on screen + emailed + stored in KV.
 * Backup: Stripe webhook (checkout.session.completed / async_payment_succeeded) issues + emails the key
 *         if the buyer closed the tab or paid with a delayed method. charge.refunded marks the license refunded.
 */
import nacl from "tweetnacl";
import { landingPage, successPage } from "./page.js";

// ---------- helpers ----------
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type,authorization" };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...CORS } });
const html = (body, status = 200) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });
const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const enc = new TextEncoder();
const normEmail = (e) => String(e || "").trim().toLowerCase();
const PRODUCT_TAG = "prepper-pro";
const priceCents = (env) => Math.round(Number(env.PRICE) * 100);

/** Stripe REST call (form-encoded, as Stripe's API expects). */
async function stripe(env, method, path, params) {
	const body = params ? new URLSearchParams(params).toString() : undefined;
	const res = await fetch(`${env.STRIPE_API_BASE || "https://api.stripe.com"}${path}`, {
		method,
		headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
		body,
	});
	const data = await res.json().catch(() => ({}));
	return { ok: res.ok, status: res.status, data };
}

/** Same format the plugin verifies: PFG-<b64url payload>.<b64url ed25519 signature over the payload string> */
function signLicense(env, name) {
	const sk = unb64u(env.LICENSE_PRIVATE_KEY.trim());
	if (sk.length !== 64) throw new Error("LICENSE_PRIVATE_KEY is not a 64-byte tweetnacl secret key");
	const id = b64u(crypto.getRandomValues(new Uint8Array(4)));
	const payload = b64u(enc.encode(JSON.stringify({ n: name, t: "pro", i: new Date().toISOString().slice(0, 10), id })));
	return `PFG-${payload}.${b64u(nacl.sign.detached(enc.encode(payload), sk))}`;
}

/** Issue once per Checkout Session (idempotent): verify, sign, store, email. */
async function issueForSession(env, s, source) {
	const existing = await env.LICENSES.get(`order:${s.id}`, "json");
	if (existing) return existing;

	if (s.metadata?.product !== PRODUCT_TAG) throw new Error("This payment isn't for Prepper Field Guide Pro.");
	if (s.status !== "complete") return { incomplete: true };
	if (!["paid", "no_payment_required"].includes(s.payment_status)) {
		return { pending: true, status: s.payment_status };
	}
	// Promo codes may lower the amount; it can never be more than the list price or a different currency.
	if (String(s.currency).toUpperCase() !== String(env.CURRENCY).toUpperCase() || s.amount_total > priceCents(env)) {
		console.log("Amount/currency mismatch", s.id, s.amount_total, s.currency);
		throw new Error("Payment details don't match this product.");
	}

	const email = normEmail(s.customer_details?.email || s.customer_email);
	const name = (s.customer_details?.name || "").trim() || email.split("@")[0] || "Customer";
	const record = {
		key: signLicense(env, email ? `${name} <${email}>` : name),
		name, email,
		orderId: s.id,
		paymentIntent: typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id || null,
		amount: `${(s.amount_total / 100).toFixed(2)} ${String(s.currency).toUpperCase()}`,
		issued: new Date().toISOString(),
		source,
	};
	await env.LICENSES.put(`order:${s.id}`, JSON.stringify(record));
	if (record.paymentIntent) await env.LICENSES.put(`pi:${record.paymentIntent}`, s.id);
	if (email) {
		const list = (await env.LICENSES.get(`email:${email}`, "json")) || [];
		if (!list.includes(s.id)) list.push(s.id);
		await env.LICENSES.put(`email:${email}`, JSON.stringify(list));
	}
	record.emailed = await sendKeyEmail(env, record);
	await env.LICENSES.put(`order:${s.id}`, JSON.stringify(record));
	return record;
}

async function sendKeyEmail(env, rec) {
	if (!env.RESEND_API_KEY || !rec.email) return false;
	const text = `Thanks for buying ${env.PRODUCT_NAME}!

Your license key:

${rec.key}

To activate:
1. In Obsidian, open the command palette (Ctrl/Cmd+P, or the menu on mobile).
2. Run "Prepper: Pro: enter license key / upgrade".
3. Paste the key and tap Activate.

The key works offline, on all your own devices, forever.
Install / update the plugin: ${env.DIRECTORY_URL}
Order: ${rec.orderId} · ${rec.amount}

Questions? Reply to this email or write ${env.SUPPORT_EMAIL}.
— ${env.SELLER_NAME}`;
	try {
		const res = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
			body: JSON.stringify({ from: env.EMAIL_FROM, to: [rec.email], reply_to: env.SUPPORT_EMAIL, subject: `Your ${env.PRODUCT_NAME} license key`, text }),
		});
		return res.ok;
	} catch { return false; }
}

/** Verify Stripe-Signature header (HMAC-SHA256 of "t.payload", 5-minute tolerance). */
async function verifyStripeSignature(env, header, payload) {
	if (!header || !env.STRIPE_WEBHOOK_SECRET) return false;
	let t = null; const v1 = [];
	for (const kv of header.split(",")) {
		const [k, v] = kv.split("=");
		if (k === "t") t = v; else if (k === "v1") v1.push(v);
	}
	if (!t || !v1.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
	const key = await crypto.subtle.importKey("raw", enc.encode(env.STRIPE_WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`)));
	const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
	// constant-time compare
	return v1.some((sig) => sig.length === hex.length && [...sig].reduce((acc, c, i) => acc | (c.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}

// ---------- routes ----------
async function createCheckout(env, origin) {
	const params = {
		mode: "payment",
		"line_items[0][quantity]": "1",
		"line_items[0][price_data][currency]": env.CURRENCY.toLowerCase(),
		"line_items[0][price_data][unit_amount]": String(priceCents(env)), // price is set HERE, never by the browser
		"line_items[0][price_data][product_data][name]": env.PRODUCT_NAME,
		"line_items[0][price_data][product_data][description]": "Lifetime license — almanac, medicinal plants, pantry planner, waypoints, larger & printable maps.",
		"metadata[product]": PRODUCT_TAG,
		"payment_intent_data[metadata][product]": PRODUCT_TAG,
		success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${origin}/#buy`,
		allow_promotion_codes: "true",
		"custom_text[submit][message]": "Your license key appears on the next page and is emailed to you.",
	};
	if (env.STRIPE_AUTOMATIC_TAX === "true") params["automatic_tax[enabled]"] = "true";
	const r = await stripe(env, "POST", "/v1/checkout/sessions", params);
	if (!r.ok || !r.data.url) { console.log("checkout create failed", r.status, JSON.stringify(r.data)); return json({ error: "Couldn't start checkout. Please try again." }, 502); }
	return json({ url: r.data.url });
}

async function success(env, sessionId) {
	if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId || "")) return html(successPage(env, { error: "Missing or invalid checkout session." }), 400);
	const existing = await env.LICENSES.get(`order:${sessionId}`, "json");
	if (existing) return html(successPage(env, { rec: existing }));
	const r = await stripe(env, "GET", `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`);
	if (!r.ok) return html(successPage(env, { error: "We couldn't find that checkout session." }), 404);
	try {
		const rec = await issueForSession(env, r.data, "checkout");
		if (rec.incomplete) return html(successPage(env, { error: "Checkout wasn't completed, so you haven't been charged." }));
		if (rec.pending) return html(successPage(env, { pending: true }));
		return html(successPage(env, { rec }));
	} catch (e) {
		return html(successPage(env, { error: `${e.message} If you were charged, email ${env.SUPPORT_EMAIL} with order ${sessionId}.` }), 400);
	}
}

async function webhook(env, request) {
	const payload = await request.text();
	if (!(await verifyStripeSignature(env, request.headers.get("stripe-signature"), payload))) return json({ error: "bad signature" }, 400);
	const event = JSON.parse(payload);
	const obj = event.data?.object || {};
	try {
		if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
			if (obj.metadata?.product === PRODUCT_TAG) await issueForSession(env, obj, "webhook");
		} else if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
			const pi = obj.payment_intent;
			const sid = pi && (await env.LICENSES.get(`pi:${pi}`));
			const rec = sid && (await env.LICENSES.get(`order:${sid}`, "json"));
			if (rec) { rec.refunded = event.type; await env.LICENSES.put(`order:${sid}`, JSON.stringify(rec)); }
		}
	} catch (e) { console.log("webhook handling failed", event.type, e.message); }
	return json({ received: true }); // always 200 once verified, so Stripe doesn't retry forever
}

/** "Lost my key" — only ever emails the key to the purchase address; never reveals it on screen. */
async function resend(env, request) {
	const { email } = await request.json().catch(() => ({}));
	const e = normEmail(email);
	const generic = json({ message: "If that email matches a purchase, the key is on its way. Check spam, or contact support." });
	if (!e || !e.includes("@")) return generic;
	if (await env.LICENSES.get(`ratelimit:${e}`)) return generic;
	await env.LICENSES.put(`ratelimit:${e}`, "1", { expirationTtl: 600 });
	for (const id of (await env.LICENSES.get(`email:${e}`, "json")) || []) {
		const rec = await env.LICENSES.get(`order:${id}`, "json");
		if (rec && !rec.refunded) await sendKeyEmail(env, rec);
	}
	return generic;
}

/** Manual keys for reviewers, giveaways or sales made elsewhere. */
async function adminIssue(env, request) {
	if (!env.ADMIN_TOKEN || request.headers.get("authorization") !== `Bearer ${env.ADMIN_TOKEN}`) return json({ error: "unauthorized" }, 401);
	const { name, email, sendEmail } = await request.json().catch(() => ({}));
	if (!name) return json({ error: "name required" }, 400);
	const e = normEmail(email);
	const orderId = `manual-${Date.now()}`;
	const rec = { key: signLicense(env, e ? `${name} <${e}>` : name), name, email: e, orderId, amount: "comp", issued: new Date().toISOString(), source: "admin" };
	await env.LICENSES.put(`order:${orderId}`, JSON.stringify(rec));
	if (e) {
		const list = (await env.LICENSES.get(`email:${e}`, "json")) || [];
		list.push(orderId);
		await env.LICENSES.put(`email:${e}`, JSON.stringify(list));
	}
	if (sendEmail) rec.emailed = await sendKeyEmail(env, rec);
	return json(rec);
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const p = url.pathname;
		if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
		try {
			if (request.method === "GET" && (p === "/" || p === "/pro")) return html(landingPage(env));
			if (request.method === "GET" && p === "/success") return success(env, url.searchParams.get("session_id"));
			if (request.method === "GET" && p === "/api/health") return json({ ok: true, live: String(env.STRIPE_SECRET_KEY || "").startsWith("sk_live_") });
			if (request.method === "POST" && p === "/api/checkout") return createCheckout(env, env.PUBLIC_URL || url.origin);
			if (request.method === "POST" && p === "/api/stripe/webhook") return webhook(env, request);
			if (request.method === "POST" && p === "/api/resend") return resend(env, request);
			if (request.method === "POST" && p === "/api/admin/issue") return adminIssue(env, request);
			return json({ error: "not found" }, 404);
		} catch (e) {
			console.log("error", e && e.stack);
			return json({ error: "Something went wrong. You have not been charged unless Stripe sent you a receipt." }, 500);
		}
	},
};
