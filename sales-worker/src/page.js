const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function landingPage(env) {
	const price = `$${Number(env.PRICE).toFixed(0)}`;
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(env.PRODUCT_NAME)} — offline, local preparedness for Obsidian</title>
<meta name="description" content="Turn Obsidian into an offline field guide for where you actually live: topo maps, water sources, edible, poisonous and medicinal plants, a 30-year local almanac, and a pantry plan.">
<style>
:root{--bg:#f6f3ec;--ink:#1f2a1f;--muted:#5d665a;--card:#fffdf8;--line:#ddd6c6;--accent:#3f6b3a;--accent2:#b5651d;--warn:#8a3b12}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:1040px;margin:0 auto;padding:0 20px}
header{padding:56px 0 28px;border-bottom:1px solid var(--line)}
.eyebrow{font:600 13px/1 ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--accent2)}
h1{font:800 clamp(34px,6vw,58px)/1.03 Georgia,"Times New Roman",serif;margin:14px 0 16px;letter-spacing:-.01em;max-width:16ch}
.lede{font-size:20px;color:var(--muted);max-width:60ch;margin:0 0 26px}
.cta{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.btn{display:inline-block;padding:13px 20px;border-radius:10px;font-weight:700;text-decoration:none;border:2px solid var(--ink);color:var(--ink)}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.small{font-size:14px;color:var(--muted)}
section{padding:44px 0;border-bottom:1px solid var(--line)}
h2{font:700 30px/1.15 Georgia,serif;margin:0 0 18px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px}
.card h3{margin:0 0 6px;font-size:17px}.card p{margin:0;color:var(--muted);font-size:15px}
.pro-tag{font:700 11px/1 ui-monospace,monospace;background:var(--accent2);color:#fff;border-radius:4px;padding:3px 6px;vertical-align:2px;margin-left:6px}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;font-size:15px}
th,td{padding:11px 14px;border-bottom:1px solid var(--line);text-align:left}th{background:#ece6d7}
td.c,th.c{text-align:center}
.buy{display:grid;grid-template-columns:1.1fr .9fr;gap:28px;align-items:start}
@media(max-width:780px){.buy{grid-template-columns:1fr}}
.price{font:800 54px/1 Georgia,serif}.price span{font:600 16px/1 system-ui;color:var(--muted);margin-left:8px}
ul.ticks{padding:0;list-style:none;margin:14px 0}ul.ticks li{padding:4px 0 4px 26px;position:relative}ul.ticks li:before{content:"✓";position:absolute;left:0;color:var(--accent);font-weight:800}
.result{display:none;background:#eef5ea;border:2px solid var(--accent);border-radius:12px;padding:18px;margin-top:12px}
.result code{display:block;word-break:break-all;background:#fff;border:1px dashed var(--accent);padding:12px;border-radius:8px;font-size:13px;margin:10px 0}
.err{display:none;color:var(--warn);font-weight:600;margin-top:10px}
input[type=email]{width:100%;padding:12px;border:1px solid var(--line);border-radius:8px;font-size:16px}
footer{padding:30px 0 50px;color:var(--muted);font-size:14px}
.note{border-left:4px solid var(--accent2);padding:10px 14px;background:var(--card);border-radius:0 8px 8px 0;font-size:15px}
</style>
</head>
<body>
<header><div class="wrap">
  <div class="eyebrow">Obsidian plugin · works with no signal</div>
  <h1>A field guide to the land around your house.</h1>
  <p class="lede">Enter your address once. Get offline topo maps, the springs and wells near you, which local plants feed you, heal you, or kill you, and what your weather actually does — all stored as plain notes you own.</p>
  <div class="cta">
    <a class="btn primary" href="#buy">Get Pro — ${price}</a>
    <a class="btn" href="${esc(env.DIRECTORY_URL)}">Install free</a>
    <span class="small">One-time. No account. No subscription.</span>
  </div>
</div></header>

<section><div class="wrap">
  <h2>What it builds in your vault</h2>
  <div class="grid">
    <div class="card"><h3>🗺️ Offline map</h3><p>Pan-and-zoom USGS topo + satellite, live GPS dot with no cell service, long-press for distance and direction home.</p></div>
    <div class="card"><h3>💧 Water & resources</h3><p>USGS-recorded springs, wells and streams plus hospitals, pharmacies, shelters and fuel — measured from your door.</p></div>
    <div class="card"><h3>🌿 Edible & poisonous plants</h3><p>Species actually recorded near you, with photos, lookalikes, and the deadly ones listed first.</p></div>
    <div class="card"><h3>🩹 Medicinal plants <span class="pro-tag">PRO</span></h3><p>Local healing plants with honest evidence ratings, drug interactions, and the "don't use" list.</p></div>
    <div class="card"><h3>📅 Local almanac <span class="pro-tag">PRO</span></h3><p>30 years of NOAA data for your spot: frost dates, what each month throws at you, seasonal outlook, planting calendar.</p></div>
    <div class="card"><h3>🥫 Pantry planner <span class="pro-tag">PRO</span></h3><p>Food, water and supply targets for your household and timeframe — with a "have" column that tracks your progress.</p></div>
  </div>
</div></section>

<section><div class="wrap">
  <h2>Free vs Pro</h2>
  <table>
    <tr><th></th><th class="c">Free</th><th class="c">Pro</th></tr>
    <tr><td>Offline map, GPS, nearest water</td><td class="c">9 mi area</td><td class="c">up to 60 mi, max detail</td></tr>
    <tr><td>Water sources & emergency resources</td><td class="c">✓</td><td class="c">✓</td></tr>
    <tr><td>Edible & poisonous plants</td><td class="c">✓</td><td class="c">✓</td></tr>
    <tr><td>Weather alerts, survival guides, family plan</td><td class="c">✓</td><td class="c">✓</td></tr>
    <tr><td>Medicinal plants guide</td><td class="c">—</td><td class="c">✓</td></tr>
    <tr><td>Local almanac & planting calendar</td><td class="c">—</td><td class="c">✓</td></tr>
    <tr><td>Pantry planner</td><td class="c">—</td><td class="c">✓</td></tr>
    <tr><td>Map waypoints & printable maps</td><td class="c">—</td><td class="c">✓</td></tr>
  </table>
</div></section>

<section id="buy"><div class="wrap buy">
  <div>
    <h2>Get Pro</h2>
    <div class="price">${price}<span>once, for life</span></div>
    <ul class="ticks">
      <li>Key appears instantly after checkout${env.RESEND_API_KEY ? " — and is emailed to you" : ""}</li>
      <li>Activates offline on all your own devices</li>
      <li>Every future Pro feature included</li>
    </ul>
    <p class="note">You need the free plugin installed first: <a href="${esc(env.DIRECTORY_URL)}">install it here</a>, then paste your key under <em>Prepper: Pro: enter license key</em>.</p>
  </div>
  <div class="card">
    <button class="btn primary" id="buyBtn" type="button" style="width:100%;font-size:19px;padding:16px">Buy Pro — ${price}</button>
    <div id="err" class="err"></div>
    <p class="small" style="margin-top:12px">🔒 Secure checkout by Stripe — card, Apple Pay, Google Pay or Link. Your key appears on the next page${env.RESEND_API_KEY ? " and is emailed to you" : ""}. Sold by ${esc(env.SELLER_NAME)}.</p>
  </div>
</div></section>

<section><div class="wrap">
  <h2>Lost your key?</h2>
  <form id="resend" style="max-width:460px">
    <p class="small">Enter the email address you used at checkout and we'll email the key again.</p>
    <input type="email" name="email" required placeholder="you@example.com">
    <p><button class="btn" type="submit">Email my key</button> <span class="small" id="resendMsg"></span></p>
  </form>
</div></section>

<footer><div class="wrap">
  Not medical or survival advice — always positively identify plants and seek real medical care. Data from USGS, NOAA, PRISM, OpenStreetMap and iNaturalist.<br>
  Questions: <a href="mailto:${esc(env.SUPPORT_EMAIL)}">${esc(env.SUPPORT_EMAIL)}</a> · © ${new Date().getFullYear()} ${esc(env.SELLER_NAME)}
</div></footer>

<script>
(function(){
  var btn = document.getElementById('buyBtn'), err = document.getElementById('err');
  btn.onclick = function(){
    btn.disabled = true; btn.textContent = 'Opening secure checkout…'; err.style.display = 'none';
    fetch('/api/checkout', { method: 'POST' }).then(function(r){ return r.json(); }).then(function(d){
      if (d.url) { window.location.href = d.url; return; }
      throw new Error(d.error || 'Could not start checkout');
    }).catch(function(e){ err.textContent = e.message; err.style.display = 'block'; btn.disabled = false; btn.textContent = 'Buy Pro — ${price}'; });
  };
  document.getElementById('resend').onsubmit = function(e){
    e.preventDefault();
    fetch('/api/resend', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ email: e.target.email.value }) })
      .then(function(r){ return r.json(); }).then(function(d){ document.getElementById('resendMsg').textContent = d.message; });
  };
})();
</script>
</body>
</html>`;
}


const STYLE = `<style>
:root{--bg:#f6f3ec;--ink:#1f2a1f;--muted:#5d665a;--card:#fffdf8;--line:#ddd6c6;--accent:#3f6b3a;--accent2:#b5651d;--warn:#8a3b12}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:1040px;margin:0 auto;padding:0 20px}
header{padding:56px 0 28px;border-bottom:1px solid var(--line)}
.eyebrow{font:600 13px/1 ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--accent2)}
h1{font:800 clamp(34px,6vw,58px)/1.03 Georgia,"Times New Roman",serif;margin:14px 0 16px;letter-spacing:-.01em;max-width:16ch}
.lede{font-size:20px;color:var(--muted);max-width:60ch;margin:0 0 26px}
.cta{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.btn{display:inline-block;padding:13px 20px;border-radius:10px;font-weight:700;text-decoration:none;border:2px solid var(--ink);color:var(--ink)}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.small{font-size:14px;color:var(--muted)}
section{padding:44px 0;border-bottom:1px solid var(--line)}
h2{font:700 30px/1.15 Georgia,serif;margin:0 0 18px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px}
.card h3{margin:0 0 6px;font-size:17px}.card p{margin:0;color:var(--muted);font-size:15px}
.pro-tag{font:700 11px/1 ui-monospace,monospace;background:var(--accent2);color:#fff;border-radius:4px;padding:3px 6px;vertical-align:2px;margin-left:6px}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;font-size:15px}
th,td{padding:11px 14px;border-bottom:1px solid var(--line);text-align:left}th{background:#ece6d7}
td.c,th.c{text-align:center}
.buy{display:grid;grid-template-columns:1.1fr .9fr;gap:28px;align-items:start}
@media(max-width:780px){.buy{grid-template-columns:1fr}}
.price{font:800 54px/1 Georgia,serif}.price span{font:600 16px/1 system-ui;color:var(--muted);margin-left:8px}
ul.ticks{padding:0;list-style:none;margin:14px 0}ul.ticks li{padding:4px 0 4px 26px;position:relative}ul.ticks li:before{content:"✓";position:absolute;left:0;color:var(--accent);font-weight:800}
.result{display:none;background:#eef5ea;border:2px solid var(--accent);border-radius:12px;padding:18px;margin-top:12px}
.result code{display:block;word-break:break-all;background:#fff;border:1px dashed var(--accent);padding:12px;border-radius:8px;font-size:13px;margin:10px 0}
.err{display:none;color:var(--warn);font-weight:600;margin-top:10px}
input[type=email]{width:100%;padding:12px;border:1px solid var(--line);border-radius:8px;font-size:16px}
footer{padding:30px 0 50px;color:var(--muted);font-size:14px}
.note{border-left:4px solid var(--accent2);padding:10px 14px;background:var(--card);border-radius:0 8px 8px 0;font-size:15px}
</style>`;

export function successPage(env, { rec, pending, error }) {
	let body;
	if (rec) {
		body = `<h1 style="font-size:40px">✅ You're Pro.</h1>
  <p class="lede">Thank you${rec.name ? ", " + esc(rec.name.split(" ")[0]) : ""}! Here's your license key${rec.emailed ? " — a copy was emailed to " + esc(rec.email) : ""}.</p>
  <div class="result" style="display:block"><code id="key">${esc(rec.key)}</code>
  <button class="btn primary" id="copy" type="button">Copy key</button>
  <ol class="small"><li>In Obsidian, open the command palette (Ctrl/Cmd+P, or the menu on mobile).</li><li>Run <b>Prepper: Pro: enter license key / upgrade</b>.</li><li>Paste the key → <b>Activate</b>.</li></ol>
  <p class="small">Save this key somewhere safe. It works offline on all your own devices.${rec.emailed ? "" : " We couldn't email it, so please copy it now."}</p></div>
  <p class="small">Don't have the plugin yet? <a href="${esc(env.DIRECTORY_URL)}">Install it here</a>. Order ${esc(rec.orderId)}.</p>`;
	} else if (pending) {
		body = `<h1 style="font-size:40px">⏳ Payment processing</h1><p class="lede">Your payment method takes a little longer to clear. Your key will be emailed automatically as soon as it does — no need to do anything.</p>`;
	} else {
		body = `<h1 style="font-size:40px">Hmm, something's off</h1><p class="lede">${esc(error)}</p><p><a class="btn" href="/#buy">Back to the store</a></p>`;
	}
	return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(env.PRODUCT_NAME)}</title>${STYLE}</head><body><header><div class="wrap">
  <div class="eyebrow">${esc(env.PRODUCT_NAME)}</div>
  ${body}
  <p class="small" style="margin-top:28px">Questions: <a href="mailto:${esc(env.SUPPORT_EMAIL)}">${esc(env.SUPPORT_EMAIL)}</a></p>
</div></header>
<script>var c=document.getElementById('copy');if(c)c.onclick=function(){navigator.clipboard.writeText(document.getElementById('key').textContent).then(function(){c.textContent='Copied ✓'})};</script>
</body></html>`;
}
