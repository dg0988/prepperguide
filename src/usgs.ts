import { offsetKm } from "./geo";
import { Feature } from "./osm";
import { getJson, haversineKm, sleep } from "./util";

const TYPES: { code: string; kind: string; max: number }[] = [
	{ code: "SP", kind: "Spring (USGS record)", max: 60 },
	{ code: "GW", kind: "Well (USGS record)", max: 40 },
	{ code: "ST", kind: "Stream gage (USGS)", max: 20 },
	{ code: "LK", kind: "Lake/reservoir (USGS)", max: 15 },
];

/**
 * USGS Water Data OGC API (api.waterdata.usgs.gov) — the national inventory of springs, wells
 * and surface-water sites. Much denser than OpenStreetMap for rural springs and wells.
 */
export async function fetchUsgsWater(lat: number, lon: number, radiusKm: number, log: (m: string) => void): Promise<Feature[]> {
	const sw = offsetKm(lat, lon, -radiusKm, -radiusKm), ne = offsetKm(lat, lon, radiusKm, radiusKm);
	const bbox = [sw.lon, sw.lat, ne.lon, ne.lat].map((n) => n.toFixed(5)).join(",");
	const out: Feature[] = [];
	for (const t of TYPES) {
		try {
			const j = await getJson<any>(`https://api.waterdata.usgs.gov/ogcapi/v0/collections/monitoring-locations/items?f=json&limit=2000&bbox=${bbox}&site_type_code=${t.code}`);
			const feats: Feature[] = (j.features || []).filter((f: any) => f.geometry?.coordinates).map((f: any) => {
				const p = f.properties || {};
				const [flon, flat] = f.geometry.coordinates;
				const tags: Record<string, string> = { source: "USGS" };
				const id = p.monitoring_location_id || f.id || (p.monitoring_location_number ? `USGS-${p.monitoring_location_number}` : "");
				if (id) tags.usgs_url = `https://waterdata.usgs.gov/monitoring-location/${id}/`;
				const depth = p.well_constructed_depth ?? p.hole_constructed_depth;
				if (depth) tags.well_depth_ft = String(depth);
				if (p.aquifer_code || p.national_aquifer_code) tags.aquifer = String(p.national_aquifer_code || p.aquifer_code);
				return {
					id: `usgs/${id}`, category: "water", kind: t.kind,
					name: titleCase(p.monitoring_location_name || t.kind),
					lat: flat, lon: flon, distKm: haversineKm(lat, lon, flat, flon), tags,
				} as Feature;
			}).filter((f: Feature) => f.distKm <= radiusKm * 1.05);
			feats.sort((a, b) => a.distKm - b.distKm);
			out.push(...feats.slice(0, t.max));
			log(`  USGS ${t.kind.split(" (")[0].toLowerCase()}s: ${feats.length} found${feats.length > t.max ? ` (keeping nearest ${t.max})` : ""}`);
		} catch (e) {
			log(`  USGS ${t.code} lookup failed: ${e instanceof Error ? e.message : e}`);
		}
		await sleep(300);
	}
	return out;
}

function titleCase(s: string): string {
	return s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\bNr\b/g, "near").replace(/\bUsgs\b/g, "USGS");
}
