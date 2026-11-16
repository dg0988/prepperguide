import { App } from "obsidian";
import { fetchWithRetry, getJson, Logger, today, writeText } from "./util";

/**
 * "Almanac" built from real data instead of folklore:
 *  - 30 years of daily PRISM weather at your exact point (NOAA RCC-ACIS; free for any use, attribution)
 *    → monthly normals, records, frost/freeze dates with risk levels, growing season
 *  - Official NOAA Climate Prediction Center monthly & seasonal outlooks for your point
 *  - Planting calendar keyed to your frost dates
 *  - Sunrise/sunset & full/new moons computed locally (no network)
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL_MOON_NAMES = ["Wolf", "Snow", "Worm", "Pink", "Flower", "Strawberry", "Buck", "Sturgeon", "Corn/Harvest", "Hunter's", "Beaver", "Cold"];

interface Daily { time: string[]; tmax: number[]; tmin: number[]; prcp: number[]; snow: number[] }

const doy = (d: Date) => Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000);
const fmtDoy = (n: number) => { const d = new Date(Date.UTC(2023, 0, 1)); d.setUTCDate(n); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; };
const pct = (arr: number[], p: number) => { const a = [...arr].sort((x, y) => x - y); if (!a.length) return NaN; const i = (a.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); };
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const r0 = (n: number) => (isFinite(n) ? Math.round(n) : "—");
const r1 = (n: number) => (isFinite(n) ? n.toFixed(1) : "—");

const ACIS = "https://data.rcc-acis.org";
async function acis(endpoint: string, params: any): Promise<any> {
	const res = await fetchWithRetry({ url: `${ACIS}/${endpoint}`, method: "POST", contentType: "application/json", body: JSON.stringify(params) });
	return res.json;
}
const num = (v: any): number | null => { if (v === "T") return 0; const n = typeof v === "number" ? v : parseFloat(v); return isFinite(n) && n > -900 ? n : null; };

/** 30 years of daily PRISM (≈4 km grid, via NOAA RCC-ACIS) at the exact point + snowfall from the nearest long-record station. */
async function fetchHistory(lat: number, lon: number, startYear: number, endYear: number, log: Logger): Promise<Daily & { snowStation: string | null }> {
	const j = await acis("GridData", { loc: `${lon.toFixed(4)},${lat.toFixed(4)}`, sdate: `${startYear}-01-01`, edate: `${endYear}-12-31`, grid: "21", elems: "maxt,mint,pcpn" });
	if (!j?.data?.length) throw new Error("No PRISM data for this point (US lower 48 only).");
	const time: string[] = [], tmax: any[] = [], tmin: any[] = [], prcp: any[] = [];
	for (const row of j.data) { time.push(row[0]); tmax.push(num(row[1])); tmin.push(num(row[2])); prcp.push(num(row[3])); }
	const snowMap: Record<string, number> = {};
	let snowStation: string | null = null;
	try {
		const meta = await acis("StnMeta", { bbox: `${lon - 0.4},${lat - 0.4},${lon + 0.4},${lat + 0.4}`, elems: "snow", sdate: `${startYear}-01-01`, edate: `${endYear}-12-31`, meta: "name,ll,sids,valid_daterange" });
		const cands = (meta.meta || []).filter((m: any) => m.ll && m.valid_daterange?.[0]?.length === 2)
			.map((m: any) => ({ m, d: Math.hypot(m.ll[0] - lon, m.ll[1] - lat), yrs: (Date.parse(m.valid_daterange[0][1]) - Date.parse(m.valid_daterange[0][0])) / 3.15e10 }))
			.filter((c: any) => c.yrs >= 15).sort((a: any, b: any) => a.d - b.d);
		if (cands.length) {
			const st = cands[0].m;
			const sd = await acis("StnData", { sid: st.sids[0].split(" ")[0], sdate: `${startYear}-01-01`, edate: `${endYear}-12-31`, elems: "snow" });
			for (const row of sd.data || []) { const v = num(row[1]); if (v != null) snowMap[row[0]] = v; }
			snowStation = `${st.name} (${(cands[0].d * 111).toFixed(0)} km away)`;
			log(`  snowfall from station: ${snowStation}`);
		}
	} catch { /* snow optional */ }
	return { time, tmax, tmin, prcp, snow: time.map((t) => snowMap[t] ?? 0), snowStation };
}

/** NOAA Climate Prediction Center official outlooks at this point (monthly + up to 13 seasonal leads). */
interface Outlook { label: string; temp: string; prcp: string }
async function cpcLayer(service: string, layer: number, lat: number, lon: number): Promise<Record<string, any> | null | undefined> {
	const url = `https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/${service}/MapServer/${layer}/query?geometry=${lon},${lat}` +
		`&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json`;
	try {
		const j = await getJson<any>(url);
		if (j.error) return undefined; // layer doesn't exist
		return j.features?.[0]?.attributes ?? null; // null = no polygon here → equal chances
	} catch { return undefined; }
}
function describe(attrs: Record<string, any> | null, kind: "temp" | "prcp"): string {
	if (!attrs) return "Equal chances";
	const v = Object.entries(attrs);
	const cat = String(v.find(([k]) => /^cat/i.test(k))?.[1] ?? "");
	const prob = v.find(([k]) => /^prob/i.test(k))?.[1];
	const word = /above/i.test(cat) ? (kind === "temp" ? "🔺 Warmer than normal" : "💧 Wetter than normal")
		: /below/i.test(cat) ? (kind === "temp" ? "🔻 Colder than normal" : "🏜️ Drier than normal")
		: /normal/i.test(cat) ? "≈ Near normal" : "Equal chances";
	return prob != null && word !== "Equal chances" ? `${word} (${prob}% chance)` : word;
}
function seasonLabel(attrs: Record<string, any> | null, fallback: string): string {
	if (!attrs) return fallback;
	const v = Object.entries(attrs).find(([k]) => /valid|seas|period|target/i.test(k));
	return v ? String(v[1]) : fallback;
}
async function fetchOutlooks(lat: number, lon: number): Promise<Outlook[]> {
	const out: Outlook[] = [];
	const mt = await cpcLayer("cpc_mthly_temp_outlk", 0, lat, lon), mp = await cpcLayer("cpc_mthly_precip_outlk", 0, lat, lon);
	if (mt !== undefined || mp !== undefined) out.push({ label: seasonLabel(mt ?? mp ?? null, "Next month"), temp: describe(mt ?? null, "temp"), prcp: describe(mp ?? null, "prcp") });
	for (let i = 0; i < 13; i++) {
		const t = await cpcLayer("cpc_sea_temp_outlk", i, lat, lon), p = await cpcLayer("cpc_sea_precip_outlk", i, lat, lon);
		if (t === undefined && p === undefined) break;
		const start = new Date(); start.setDate(1); start.setMonth(start.getMonth() + 1 + i);
		const fb = [0, 1, 2].map((k) => "JFMAMJJASOND"[(start.getMonth() + k) % 12]).join("") + " " + new Date(start.getFullYear(), start.getMonth() + 2, 1).getFullYear();
		out.push({ label: seasonLabel(t ?? p ?? null, fb), temp: describe(t ?? null, "temp"), prcp: describe(p ?? null, "prcp") });
	}
	return out;
}

// ---------- Sun & moon (local computation) ----------
function sunTimes(date: Date, lat: number, lon: number): { rise: Date | null; set: Date | null } {
	const rad = Math.PI / 180;
	const n = doy(date);
	const gamma = (2 * Math.PI / 365) * (n - 1);
	const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
	const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
	const cosH = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
	if (cosH > 1 || cosH < -1) return { rise: null, set: null };
	const ha = Math.acos(cosH) / rad;
	const base = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
	const riseMin = 720 - 4 * (lon + ha) - eqtime, setMin = 720 - 4 * (lon - ha) - eqtime;
	return { rise: new Date(base + riseMin * 60000), set: new Date(base + setMin * 60000) };
}

/** Mean lunar phases (accurate to within a few hours — fine for planning). */
function moonPhases(from: Date, months: number): { date: Date; type: "new" | "full" }[] {
	const synodic = 29.530588853;
	const ref = Date.UTC(2000, 0, 6, 18, 14); // known new moon
	const out: { date: Date; type: "new" | "full" }[] = [];
	let k = Math.floor((from.getTime() - ref) / 86400000 / synodic);
	const end = from.getTime() + months * 30.44 * 86400000;
	for (; ; k++) {
		const nm = ref + k * synodic * 86400000, fm = nm + (synodic / 2) * 86400000;
		if (nm > end) break;
		if (nm >= from.getTime()) out.push({ date: new Date(nm), type: "new" });
		if (fm >= from.getTime() && fm <= end) out.push({ date: new Date(fm), type: "full" });
	}
	return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// ---------- Planting calendar (weeks relative to frost; standard extension-service guidance) ----------
const SPRING: [string, number, number, string][] = [
	["Start peppers indoors", -10, -8, "seed trays, warm spot"],
	["Start tomatoes & eggplant indoors", -8, -6, ""],
	["Start broccoli, cabbage, collards indoors", -8, -6, "or buy transplants"],
	["Plant onion sets / transplants", -6, -4, ""],
	["Direct-sow peas, spinach, lettuce, kale, radish", -6, -2, "cool-season; tolerate light frost"],
	["Plant seed potatoes", -4, -2, "cut pieces with 2 eyes, cure 1–2 days"],
	["Direct-sow carrots, beets, turnips", -4, -1, ""],
	["Transplant broccoli, cabbage, collards", -4, -2, ""],
	["Transplant tomatoes", 1, 3, "after frost danger, soil > 60°F"],
	["Direct-sow beans, corn, squash, cucumbers", 1, 4, "soil > 60–65°F"],
	["Transplant peppers & eggplant", 2, 4, "like warm nights"],
	["Plant sweet potato slips, okra, southern peas", 3, 6, "heat lovers — great calorie crops in the South"],
];
const FALL: [string, number, number, string][] = [
	["Sow fall beans & cucumbers", -12, -10, "need ~60 frost-free days"],
	["Transplant collards, cabbage, broccoli", -10, -8, ""],
	["Direct-sow kale, turnips, mustard, carrots, beets", -10, -6, ""],
	["Direct-sow lettuce, spinach, radish", -8, -4, ""],
	["Plant garlic", 0, 4, "harvest next early summer"],
];

export async function buildAlmanac(app: App, lat: number, lon: number, folder: string, log: Logger): Promise<string> {
	const now = new Date();
	const endYear = now.getUTCFullYear() - 1, startYear = endYear - 29;
	log(`Almanac: downloading ${startYear}–${endYear} daily PRISM weather history for your exact location (NOAA RCC-ACIS)…`);
	const h = await fetchHistory(lat, lon, startYear, endYear, log);
	log(`  ${h.time.length.toLocaleString()} days of history`);

	// Monthly normals
	type M = { hi: number[]; lo: number[]; prcpByYear: Record<string, number>; snowByYear: Record<string, number>; hot95: Record<string, number>; frz: Record<string, number>; recHi: [number, string]; recLo: [number, string] };
	const mon: M[] = MONTHS.map(() => ({ hi: [], lo: [], prcpByYear: {}, snowByYear: {}, hot95: {}, frz: {}, recHi: [-999, ""], recLo: [999, ""] }));
	const springLast: Record<string, number> = {}, fallFirst: Record<string, number> = {};
	const wettestDays: [number, string][] = [];
	for (let i = 0; i < h.time.length; i++) {
		const t = h.time[i], y = t.slice(0, 4), m = parseInt(t.slice(5, 7)) - 1;
		const hi = h.tmax[i], lo = h.tmin[i], p = h.prcp[i] ?? 0, s = h.snow[i] ?? 0;
		if (hi == null || lo == null) continue;
		const M = mon[m];
		M.hi.push(hi); M.lo.push(lo);
		M.prcpByYear[y] = (M.prcpByYear[y] || 0) + p;
		M.snowByYear[y] = (M.snowByYear[y] || 0) + s;
		M.hot95[y] = (M.hot95[y] || 0) + (hi >= 95 ? 1 : 0);
		M.frz[y] = (M.frz[y] || 0) + (lo <= 32 ? 1 : 0);
		if (hi > M.recHi[0]) M.recHi = [hi, t];
		if (lo < M.recLo[0]) M.recLo = [lo, t];
		if (lo <= 32) {
			const d = doy(new Date(t + "T00:00:00Z"));
			if (m < 6) springLast[y] = Math.max(springLast[y] || 0, d);
			else if (!fallFirst[y]) fallFirst[y] = d;
		}
		wettestDays.push([p, t]);
	}
	const years = endYear - startYear + 1;
	const springs = Object.values(springLast), falls = Object.values(fallFirst);
	const freezeFreeYears = years - Object.keys(springLast).length;
	const L: string[] = ["---", "tags: [prepper/almanac, prepper/weather]", `updated: ${today()}`, `period: ${startYear}-${endYear}`, "---", "# 📅 Local Almanac"];
	L.push(`Built from **${years} years (${startYear}–${endYear})** of daily PRISM weather data for your exact location (≈4 km grid), plus a long-range outlook and planting calendar. Real data, not folklore — and it stays readable offline.`, "");

	// Frost
	L.push("## ❄️ Frost & freeze dates (32°F)");
	if (springs.length >= years / 3) {
		const lastMed = pct(springs, 0.5), last90 = pct(springs, 0.9), last10 = pct(springs, 0.1);
		const firstMed = falls.length ? pct(falls, 0.5) : NaN, first10 = falls.length ? pct(falls, 0.1) : NaN, first90 = falls.length ? pct(falls, 0.9) : NaN;
		L.push("| | Early (1 in 10 yrs) | **Typical (median)** | Late (1 in 10 yrs) |", "|---|---|---|---|");
		L.push(`| Last spring freeze | ${fmtDoy(last10)} | **${fmtDoy(lastMed)}** | ${fmtDoy(last90)} |`);
		if (falls.length) L.push(`| First fall freeze | ${fmtDoy(first10)} | **${fmtDoy(firstMed)}** | ${fmtDoy(first90)} |`);
		if (falls.length) L.push("", `**Growing season:** ~${r0(firstMed - lastMed)} days typical; ~${r0(first10 - last90)} days in a bad year.`);
		L.push("", `> [!tip] Planning rule: plant tender crops after **${fmtDoy(last90)}** and you'll dodge a late freeze 9 years out of 10.`);
		if (freezeFreeYears > 0) L.push(`> ${freezeFreeYears} of ${years} years had no spring freeze at all.`);
	} else {
		L.push(`Freezes are rare here — only ${springs.length} of ${years} years had a spring freeze. Year-round growing is possible for many crops.`);
	}
	L.push("");

	// Monthly normals table
	L.push("## 🌡️ What a normal year looks like", "| Month | Avg high | Avg low | Rain (in) | Snow (in) | Days ≥95°F | Nights ≤32°F | Record high | Record low |", "|---|---|---|---|---|---|---|---|---|");
	mon.forEach((M, i) => {
		L.push(`| ${MONTHS[i]} | ${r0(mean(M.hi))}° | ${r0(mean(M.lo))}° | ${r1(mean(Object.values(M.prcpByYear)))} | ${r1(mean(Object.values(M.snowByYear)))} | ${r1(mean(Object.values(M.hot95)))} | ${r1(mean(Object.values(M.frz)))} | ${r0(M.recHi[0])}° (${M.recHi[1].slice(0, 4)}) | ${r0(M.recLo[0])}° (${M.recLo[1].slice(0, 4)}) |`);
	});
	const annualRain = mon.reduce((s, M) => s + mean(Object.values(M.prcpByYear)), 0);
	L.push("", `**Annual rain:** ~${r1(annualRain)} in. A 1,000 sq ft roof sheds ~600 gal per inch of rain → ~${Math.round(annualRain * 600).toLocaleString()} gal/yr of potential rain catchment.`);
	wettestDays.sort((a, b) => b[0] - a[0]);
	const top = wettestDays.slice(0, 3);
	L.push(`**Wettest single days on record:** ${top.map(([p, t]) => `${r1(p)} in (${t})`).join(", ")}${top[0] && top[0][0] >= 3 ? " — 3+ inches in a day means flash flooding; know whether your roads and yard flood." : ""}`, "");

	// What to expect by month (prep-oriented)
	L.push("## 🧭 What to prepare for, month by month");
	const hottest = mon.map((M, i) => [mean(M.hi), i] as [number, number]).sort((a, b) => b[0] - a[0]);
	const wettest = mon.map((M, i) => [mean(Object.values(M.prcpByYear)), i] as [number, number]).sort((a, b) => b[0] - a[0]);
	mon.forEach((M, i) => {
		const tips: string[] = [];
		const hi = mean(M.hi), lo = mean(M.lo), frz = mean(Object.values(M.frz)), hot = mean(Object.values(M.hot95));
		if (frz >= 1) tips.push(`~${r0(frz)} freezing nights — protect pipes, livestock water, generator fuel; check heat source`);
		if (M.recLo[0] <= 20) tips.push(`record low ${r0(M.recLo[0])}°F — have a no-power heat plan`);
		if (hot >= 1 || hi >= 90) tips.push(`heat stress — water needs double, plan cooling without power, store water out of sun`);
		if (wettest.slice(0, 3).some(([, j]) => j === i)) tips.push("one of the wettest months — flood/drainage check, keep sandbags & sump ready");
		if (lat > 24 && lat < 36 && lon > -98 && i >= 5 && i <= 10) tips.push(i >= 7 && i <= 9 ? "**peak hurricane season**" : "hurricane season");
		if (mean(Object.values(M.snowByYear)) >= 1) tips.push("snow — traction, shovel, 2 weeks of supplies before storms");
		if (i === hottest[0][1]) tips.push("hottest month of the year");
		if (!tips.length) tips.push(`mild (${r0(hi)}°/${r0(lo)}°) — good month for outdoor projects and drills`);
		L.push(`- **${MONTHS[i]}:** ${tips.join("; ")}`);
	});
	L.push("");

	// Seasonal outlook (NOAA CPC)
	log("Almanac: downloading NOAA Climate Prediction Center outlooks…");
	const outlooks = await fetchOutlooks(lat, lon);
	L.push("## 🔮 Official long-range outlook (NOAA Climate Prediction Center)");
	if (outlooks.length) {
		L.push("The odds that each period runs warmer/colder or wetter/drier than **your 30-year normal above**. These are tendencies for stocking and planning, not day-by-day forecasts.", "");
		L.push("| Period | Temperature | Precipitation |", "|---|---|---|");
		for (const o of outlooks) L.push(`| ${o.label} | ${o.temp} | ${o.prcp} |`);
		L.push("", "Maps & discussion: https://www.cpc.ncep.noaa.gov/products/predictions/90day/");
	} else {
		L.push("Couldn't download the outlook this time — re-run *Prepper: Build local almanac* later. https://www.cpc.ncep.noaa.gov/products/predictions/90day/");
	}
	L.push("");

	// Planting calendar
	if (springs.length >= years / 3) {
		const last = pct(springs, 0.5), first = falls.length ? pct(falls, 0.5) : 330;
		L.push("## 🌱 Planting calendar for your frost dates", "Keyed to your typical last spring freeze (**" + fmtDoy(last) + "**) and first fall freeze (**" + fmtDoy(first) + "**). Adjust ±1 week for soil and weather.", "");
		L.push("### Spring", "| Task | Window | Notes |", "|---|---|---|");
		for (const [task, a, b, note] of SPRING) L.push(`| ${task} | ${fmtDoy(last + a * 7)} – ${fmtDoy(last + b * 7)} | ${note} |`);
		L.push("", "### Fall garden", "| Task | Window | Notes |", "|---|---|---|");
		for (const [task, a, b, note] of FALL) L.push(`| ${task} | ${fmtDoy(first + a * 7)} – ${fmtDoy(first + b * 7)} | ${note} |`);
		L.push("", "> [!tip] Survival-garden calorie crops: potatoes, sweet potatoes, dry beans, winter squash, corn, peanuts (South). Greens are nutrition, not calories.", "");
	}

	// Sun & moon
	L.push("## ☀️ Daylight (next 12 months)", "| Date | Sunrise | Sunset | Daylight |", "|---|---|---|---|");
	const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const fmtT = (d: Date | null) => (d ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: tz }) : "—");
	for (let k = 0; k < 12; k++) {
		const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + k, 15));
		const s = sunTimes(d, lat, lon);
		const len = s.rise && s.set ? (s.set.getTime() - s.rise.getTime()) / 3600000 : NaN;
		L.push(`| ${MONTHS[d.getUTCMonth()]} 15, ${d.getUTCFullYear()} | ${fmtT(s.rise)} | ${fmtT(s.set)} | ${isFinite(len) ? `${Math.floor(len)}h ${Math.round((len % 1) * 60)}m` : "—"} |`);
	}
	L.push("", "*Times in your device's time zone.*", "");
	L.push("## 🌕 Moon (next 12 months)", "Full moons give the most natural light for night movement and the best visibility *of* you; new moons are darkest.", "", "| Date | Phase |", "|---|---|");
	for (const p of moonPhases(now, 12)) {
		const label = p.type === "full" ? `🌕 Full — ${FULL_MOON_NAMES[p.date.getMonth()]} Moon` : "🌑 New moon";
		L.push(`| ${p.date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: tz })} | ${label} |`);
	}
	L.push("", `*Climate data: PRISM Climate Group, Oregon State University, via NOAA Regional Climate Centers (RCC-ACIS)${h.snowStation ? `; snowfall from NOAA station ${h.snowStation}` : ""}. Outlooks: NOAA Climate Prediction Center. Planting windows follow standard US extension-service guidance.*`);

	const path = `${folder}/Almanac.md`;
	await writeText(app, path, L.join("\n"));
	return path;
}
