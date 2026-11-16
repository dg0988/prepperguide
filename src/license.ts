import nacl from "tweetnacl";

/** Ed25519 public key — the matching private key lives only with the seller (keys/private.key, never committed). */
export const PUBLIC_KEY = "FUqF3aSXjt-fOMQgMY-_H4tZtIrZszv8W9Deh5I8XOg";
/** Where buyers purchase a key — replace with your Gumroad / Lemon Squeezy product link. */
export const BUY_URL = "https://prepper-pro.dima0988.workers.dev/#buy";
export const PRICE = "$19 one-time";

export interface License { name: string; tier: string; issued: string; id: string }

const unb64u = (s: string): Uint8Array => {
	const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
	const out = new Uint8Array(b.length);
	for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
	return out;
};

/** Fully offline: no server, no phone-home. Returns the license if the signature is valid. */
export function verifyLicense(key: string): License | null {
	const m = (key || "").trim().match(/^PFG-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
	if (!m) return null;
	try {
		const ok = nacl.sign.detached.verify(new TextEncoder().encode(m[1]), unb64u(m[2]), unb64u(PUBLIC_KEY));
		if (!ok) return null;
		const p = JSON.parse(new TextDecoder().decode(unb64u(m[1]))) as { n: string; t: string; i: string; id: string };
		return { name: p.n, tier: p.t, issued: p.i, id: p.id };
	} catch { return null; }
}
