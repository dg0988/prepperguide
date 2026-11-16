import { App } from "obsidian";
import { getJson, Logger, today, writeText } from "./util";

/** US National Weather Service snapshot: forecast office, county, 7-day forecast, active alerts. */
export async function buildWeather(app: App, lat: number, lon: number, folder: string, log: Logger): Promise<string | null> {
	log("Weather: contacting National Weather Service…");
	let pts: any;
	try {
		pts = await getJson(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, { Accept: "application/geo+json" });
	} catch {
		log("  NWS has no data for this location (US only) — skipping.");
		return null;
	}
	const p = pts.properties;
	const rel = p.relativeLocation?.properties;
	const L: string[] = ["---", "tags: [prepper/weather]", `updated: ${today()}`, "---", "# ⛈️ Weather & Hazards"];
	L.push(`> [!info] Snapshot taken ${new Date().toLocaleString()} — re-run **Prepper: Refresh weather & alerts** when you have signal.`);
	L.push("");
	if (rel) L.push(`- **Nearest place:** ${rel.city}, ${rel.state}`);
	L.push(`- **NWS office:** ${p.cwa} — https://www.weather.gov/${String(p.cwa).toLowerCase()}`);
	L.push(`- **Time zone:** ${p.timeZone}`);
	if (p.radarStation) L.push(`- **Radar station:** ${p.radarStation}`);
	try {
		const county = await getJson<any>(p.county, { Accept: "application/geo+json" });
		L.push(`- **County / zone:** ${county.properties.name} (${county.properties.id})`);
	} catch { /* optional */ }
	L.push("- **NOAA Weather Radio:** find your county's frequency at https://www.weather.gov/nwr/county_coverage");
	L.push("");

	try {
		const alerts = await getJson<any>(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`, { Accept: "application/geo+json" });
		const feats = alerts.features || [];
		L.push(`## Active alerts (${feats.length})`);
		if (!feats.length) L.push("None at time of download.");
		for (const f of feats) {
			const a = f.properties;
			L.push(`> [!warning] ${a.event} — ${a.severity}`);
			L.push(`> ${String(a.headline || "").replace(/\n/g, " ")}`);
			if (a.instruction) L.push(`> **Instructions:** ${String(a.instruction).replace(/\n+/g, " ")}`);
			L.push("");
		}
	} catch { L.push("## Active alerts", "Couldn't fetch alerts."); }

	try {
		const fc = await getJson<any>(p.forecast, { Accept: "application/geo+json" });
		L.push("", "## 7-day forecast", "| Period | Temp | Forecast |", "|---|---|---|");
		for (const per of fc.properties.periods || []) {
			L.push(`| ${per.name} | ${per.temperature}°${per.temperatureUnit} | ${String(per.detailedForecast).replace(/\|/g, "/")} |`);
		}
	} catch { L.push("", "## Forecast", "Couldn't fetch forecast."); }

	L.push("", "## Plan for your hazards", "- Ready.gov hazard guides: https://www.ready.gov/be-informed", "- FEMA flood maps: https://msc.fema.gov/portal/search", "- Sign up for your county's emergency alerts (search \"<your county> emergency alerts\").");
	const path = `${folder}/Weather & Hazards.md`;
	await writeText(app, path, L.join("\n"));
	return path;
}
