# Selling Prepper Field Guide Pro with Stripe — setup guide

What you get: a sales page (`/`) with a **Buy** button → Stripe Checkout (cards, Apple Pay, Google Pay, Link) →
the buyer lands on a page showing their license key, which is also emailed and stored. Runs free on Cloudflare.

About 30–40 minutes. Do everything in Stripe **test mode** first, then switch to live keys.

---

## 1. Stripe keys (test mode)
1. dashboard.stripe.com → turn on **Test mode** (toggle top-right).
2. **Developers → API keys** → copy the **Secret key** (`sk_test_…`).
   *Optional, safer for live:* create a **restricted key** with *Checkout Sessions: Write* and everything else *None*.
3. **Settings → Public details / Branding** — set your business name (ID Communications LLC), icon and colors. Stripe Checkout and receipts use these.
4. **Settings → Customer emails** → turn on **Successful payments** so buyers also get a Stripe receipt.

## 2. Cloudflare Worker
```bash
cd sales-worker
npm install
npx wrangler login                         # free Cloudflare account is fine
npx wrangler kv namespace create LICENSES   # copy the id it prints
```
Edit **wrangler.toml**:
- `id = "…"` under `[[kv_namespaces]]` → the KV id
- `SUPPORT_EMAIL`, `EMAIL_FROM`, `DIRECTORY_URL`

Set the secrets (each command prompts you to paste the value):
```bash
npx wrangler secret put STRIPE_SECRET_KEY      # sk_test_…
npx wrangler secret put LICENSE_PRIVATE_KEY    # the private key line from PRO-KEYS-keep-secret.txt
npx wrangler secret put ADMIN_TOKEN            # make up a long random password
npx wrangler deploy
```
It prints your URL, e.g. `https://prepper-pro.<you>.workers.dev`. Open it — you should see the sales page.

## 3. Stripe webhook (backup delivery + refunds)
Stripe dashboard (still in test mode) → **Developers → Webhooks → Add endpoint**
- Endpoint URL: `https://<your worker URL>/api/stripe/webhook`
- Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.created`
- Open the endpoint → **Signing secret** → reveal → copy (`whsec_…`), then:
```bash
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

## 4. Email the keys (optional but recommended)
1. **resend.com** → free account (3,000 emails/month).
2. **Domains → Add** `idcomm.tech` (or a subdomain) → add the DNS records it shows → Verify.
3. **API Keys → Create** → `npx wrangler secret put RESEND_API_KEY`
4. Set `EMAIL_FROM = "Prepper Field Guide <licenses@idcomm.tech>"` in wrangler.toml → `npx wrangler deploy`.

Without Resend, buyers still see the key on screen and get Stripe's receipt — but "Lost your key?" can't email it.

## 5. Test a purchase
1. Open your worker URL → **Buy Pro** → pay with test card **4242 4242 4242 4242**, any future date, any CVC, any ZIP.
2. You land on the success page with the key → paste it into Obsidian (*Prepper: Pro: enter license key*) → Pro unlocks.
3. Check the email arrived. Stripe → **Webhooks → your endpoint** should show the events delivered with ✅.
4. Try a declined card: **4000 0000 0000 0002** → Checkout shows the error, no key issued.
5. Refund the test payment in Stripe → "Lost your key?" no longer re-sends that key.

## 6. Go live
1. Stripe → turn **Test mode off** → finish account activation if Stripe asks (business details, bank account).
2. **Developers → API keys** → copy the live secret key (or create a live restricted key).
3. **Developers → Webhooks** → add the same endpoint and events in live mode → copy its live signing secret.
4. ```bash
   npx wrangler secret put STRIPE_SECRET_KEY       # sk_live_… / rk_live_…
   npx wrangler secret put STRIPE_WEBHOOK_SECRET   # live whsec_…
   ```
   (No redeploy needed — secrets apply immediately. `/api/health` shows `"live": true`.)
5. Buy it once yourself with a real card, then refund it in Stripe.

## 7. Your own domain (optional)
- If idcomm.tech's DNS is on Cloudflare: Workers → *prepper-pro* → **Settings → Domains & Routes → Add custom domain** → `prepper.idcomm.tech`. Update the webhook URL in Stripe to match.
- If not: link "Get Pro" on your site to the workers.dev URL — works the same.

## 8. Point the plugin at the store
In `src/license.ts` set `BUY_URL` to your sales page (with `#buy` on the end), rebuild, release.

---

## Everyday operations
**Discounts / giveaways:** Stripe → **Products → Coupons** → create a coupon + promotion code (e.g. `LAUNCH30`). Checkout already shows a promo-code box. A 100%-off code is an easy way to hand out free keys.

**Manual key** (no Stripe involved):
```bash
curl -X POST https://<worker>/api/admin/issue \
  -H "authorization: Bearer <ADMIN_TOKEN>" -H "content-type: application/json" \
  -d '{"name":"Jane Reviewer","email":"jane@example.com","sendEmail":true}'
```
**See sales:** Stripe → Payments. Every issued key is in Cloudflare → KV → LICENSES (`order:cs_…` and `email:…`).

**Refunds & disputes:** refund in Stripe as usual. The license record is marked refunded and won't be re-sent. Keys verify offline, so a delivered key can't be remotely disabled — normal for one-time offline licenses.

**Sales tax:** digital goods are taxable in some states. If you need it, turn on **Stripe Tax** in the dashboard and set `STRIPE_AUTOMATIC_TAX = "true"` in wrangler.toml. Ask your accountant whether you need to collect.

**Costs:** Cloudflare + Resend free tiers cover this. Stripe's standard US card fee applies per sale (check stripe.com/pricing for the current rate).

**Security:**
- The private key lives only in your password manager and as a Cloudflare secret. Never in git or wrangler.toml.
- The price is set by the worker, not the browser. Every session is re-read from Stripe and checked (paid, this product, amount ≤ price, currency) before a key is issued.
- Webhooks are signature-verified with replay protection.
