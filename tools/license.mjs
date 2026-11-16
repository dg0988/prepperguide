#!/usr/bin/env node
/**
 * Prepper Field Guide — offline license tool.
 *   node tools/license.mjs keygen                     → creates keys/private.key + keys/public.key (do once; NEVER commit private.key)
 *   node tools/license.mjs sign "Jane Doe <jane@x.com>" → prints a Pro license key for that buyer
 *   node tools/license.mjs verify <KEY>                → checks a key against keys/public.key
 */
import nacl from "tweetnacl";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const dir = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "keys");
const b64u = (buf) => Buffer.from(buf).toString("base64url");
const unb64u = (s) => new Uint8Array(Buffer.from(s, "base64url"));
const [cmd, arg] = process.argv.slice(2);

if (cmd === "keygen") {
	if (fs.existsSync(path.join(dir, "private.key"))) { console.error("keys/private.key already exists — refusing to overwrite (that would invalidate every key you've sold)."); process.exit(1); }
	fs.mkdirSync(dir, { recursive: true });
	const kp = nacl.sign.keyPair();
	fs.writeFileSync(path.join(dir, "private.key"), b64u(kp.secretKey) + "\n", { mode: 0o600 });
	fs.writeFileSync(path.join(dir, "public.key"), b64u(kp.publicKey) + "\n");
	console.log("Public key (paste into src/license.ts PUBLIC_KEY):\n" + b64u(kp.publicKey));
} else if (cmd === "sign") {
	if (!arg) { console.error('Usage: sign "Buyer Name <email>"'); process.exit(1); }
	const sk = unb64u(fs.readFileSync(path.join(dir, "private.key"), "utf8").trim());
	const payload = b64u(JSON.stringify({ n: arg, t: "pro", i: new Date().toISOString().slice(0, 10), id: crypto.randomBytes(4).toString("hex") }));
	const sig = nacl.sign.detached(new TextEncoder().encode(payload), sk);
	console.log(`PFG-${payload}.${b64u(sig)}`);
} else if (cmd === "verify") {
	const pk = unb64u(fs.readFileSync(path.join(dir, "public.key"), "utf8").trim());
	const m = (arg || "").trim().match(/^PFG-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
	const ok = !!m && nacl.sign.detached.verify(new TextEncoder().encode(m[1]), unb64u(m[2]), pk);
	console.log(ok ? `VALID — ${Buffer.from(m[1], "base64url").toString()}` : "INVALID");
} else {
	console.log("Commands: keygen | sign \"Name <email>\" | verify <KEY>");
}
