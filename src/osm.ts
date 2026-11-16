import { fetchWithRetry, haversineKm } from "./util";

export type Category = "water" | "medical" | "emergency" | "shelter" | "supplies";

export interface Feature {
	id: string;
	category: Category;
	kind: string;
	name: string;
	lat: number;
	lon: number;
	distKm: number;
	tags: Record<string, string>;
}

export const CATEGORY_META: Record<Category, { label: string; color: string; emoji: string }> = {
	water: { label: "Water sources", color: "#1e6fd9", emoji: "💧" },
	medical: { label: "Medical", color: "#d62828", emoji: "🏥" },
	emergency: { label: "Fire / Police / EMS", color: "#f77f00", emoji: "🚒" },
	shelter: { label: "Shelters & camps", color: "#2a9d3f", emoji: "⛺" },
	supplies: { label: "Supplies (food, fuel, hardware)", color: "#7b2cbf", emoji: "🛒" },
};

interface OverpassElement { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }
interface OverpassResponse { elements?: OverpassElement[] }

function classify(t: Record<string, string>): { category: Category; kind: string } | null {
	if (t.natural === "spring") return { category: "water", kind: "Spring" };
	if (t.amenity === "drinking_water") return { category: "water", kind: "Drinking water" };
	if (t.amenity === "water_point") return { category: "water", kind: "Water point" };
	if (t.man_made === "water_well") return { category: "water", kind: "Well" };
	if (t.man_made === "water_tower") return { category: "water", kind: "Water tower" };
	if (t.waterway === "river") return { category: "water", kind: "River" };
	if (t.waterway === "stream") return { category: "water", kind: "Stream" };
	if (t.natural === "water") return { category: "water", kind: t.water ? `Water (${t.water})` : "Lake/Pond" };
	if (t.amenity === "hospital") return { category: "medical", kind: "Hospital" };
	if (t.amenity === "clinic" || t.healthcare === "clinic") return { category: "medical", kind: "Clinic" };
	if (t.amenity === "pharmacy") return { category: "medical", kind: "Pharmacy" };
	if (t.amenity === "doctors") return { category: "medical", kind: "Doctor" };
	if (t.amenity === "fire_station") return { category: "emergency", kind: "Fire station" };
	if (t.amenity === "police") return { category: "emergency", kind: "Police" };
	if (t.emergency === "ambulance_station") return { category: "emergency", kind: "EMS station" };
	if (t.amenity === "shelter") return { category: "shelter", kind: t.shelter_type ? `Shelter (${t.shelter_type})` : "Shelter" };
	if (t.social_facility === "shelter") return { category: "shelter", kind: "Social shelter" };
	if (t.tourism === "camp_site") return { category: "shelter", kind: "Campsite" };
	if (t.tourism === "wilderness_hut" || t.tourism === "alpine_hut") return { category: "shelter", kind: "Hut" };
	if (t.amenity === "fuel") return { category: "supplies", kind: "Fuel" };
	if (t.shop === "hardware" || t.shop === "doityourself") return { category: "supplies", kind: "Hardware" };
	if (t.shop === "supermarket") return { category: "supplies", kind: "Grocery" };
	if (t.shop === "outdoor" || t.shop === "sports") return { category: "supplies", kind: "Outdoor/Sporting" };
	if (t.shop === "farm" || t.shop === "agrarian") return { category: "supplies", kind: "Farm supply" };
	return null;
}

export async function fetchOsmFeatures(lat: number, lon: number, radiusKm: number): Promise<Feature[]> {
	const r = Math.round(radiusKm * 1000);
	const a = `(around:${r},${lat},${lon})`;
	const q = `[out:json][timeout:90];
(
  nwr["natural"="spring"]${a};
  nwr["amenity"~"^(drinking_water|water_point)$"]${a};
  nwr["man_made"~"^(water_well|water_tower)$"]${a};
  way["waterway"~"^(river|stream)$"]["name"]${a};
  nwr["natural"="water"]["name"]${a};
  nwr["amenity"~"^(hospital|clinic|pharmacy|doctors|fire_station|police|shelter|fuel)$"]${a};
  nwr["healthcare"="clinic"]${a};
  nwr["emergency"="ambulance_station"]${a};
  nwr["social_facility"="shelter"]${a};
  nwr["tourism"~"^(camp_site|wilderness_hut|alpine_hut)$"]${a};
  nwr["shop"~"^(hardware|doityourself|supermarket|outdoor|sports|farm|agrarian)$"]${a};
);
out center tags;`;
	const res = await fetchWithRetry({
		url: "https://overpass-api.de/api/interpreter",
		method: "POST",
		contentType: "application/x-www-form-urlencoded",
		body: "data=" + encodeURIComponent(q),
	});
	const els: OverpassElement[] = (res.json as OverpassResponse | undefined)?.elements ?? [];
	const out: Feature[] = [];
	const seenNamedWater = new Set<string>();
	for (const e of els) {
		const t: Record<string, string> = e.tags ?? {};
		const c = classify(t);
		if (!c) continue;
		const flat = e.lat ?? e.center?.lat, flon = e.lon ?? e.center?.lon;
		if (flat == null || flon == null) continue;
		const name = t.name || t["name:en"] || c.kind;
		// rivers/streams come back as many way segments — keep the closest one per name
		const key = `${c.kind}|${name}`;
		if ((c.kind === "River" || c.kind === "Stream") && seenNamedWater.has(key)) {
			const prev = out.find((f) => `${f.kind}|${f.name}` === key);
			const d = haversineKm(lat, lon, flat, flon);
			if (prev && d < prev.distKm) { prev.lat = flat; prev.lon = flon; prev.distKm = d; }
			continue;
		}
		seenNamedWater.add(key);
		out.push({ id: `${e.type}/${e.id}`, ...c, name, lat: flat, lon: flon, distKm: haversineKm(lat, lon, flat, flon), tags: t });
	}
	out.sort((x, y) => x.distKm - y.distKm);
	return out;
}
