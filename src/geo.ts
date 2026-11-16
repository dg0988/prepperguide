import { getJson } from "./util";

export type Precision = "exact" | "street" | "area";
export interface GeoResult { lat: number; lon: number; label: string; matched?: string; precision: Precision; source: string }

const looksLikeStreetAddress = (q: string) => /^\s*\d+[a-z]?\s+\S+/i.test(q);

interface CensusResponse { result?: { addressMatches?: { matchedAddress: string; coordinates: { x: number; y: number }; addressComponents?: { city?: string; state?: string } }[] } }
interface NominatimAddress { city?: string; town?: string; village?: string; hamlet?: string; county?: string; state?: string; country_code?: string; house_number?: string }
interface NominatimResult { lat: string; lon: string; display_name: string; addresstype?: string; type?: string; address?: NominatimAddress }

/** US Census Bureau geocoder — street-address level for US addresses, free, no key. */
async function censusGeocode(q: string): Promise<GeoResult | null> {
	try {
		const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=${encodeURIComponent(q)}`;
		const j = await getJson<CensusResponse>(url);
		const m = j?.result?.addressMatches?.[0];
		if (!m) return null;
		const c = m.addressComponents ?? {};
		return {
			lat: m.coordinates.y, lon: m.coordinates.x,
			label: [c.city, c.state].filter(Boolean).join(", ") || m.matchedAddress,
			matched: m.matchedAddress, precision: "exact", source: "US Census geocoder",
		};
	} catch { return null; }
}

async function nominatimGeocode(q: string): Promise<GeoResult | null> {
	const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(q)}`;
	const res = await getJson<NominatimResult[]>(url);
	if (!res || !res.length) return null;
	const r = res[0];
	const a: NominatimAddress = r.address ?? {};
	const town = a.city || a.town || a.village || a.hamlet || a.county || "";
	const t = r.addresstype || r.type || "";
	const precision: Precision = ["house", "building", "amenity", "shop", "place", "leisure", "tourism"].includes(t) || !!a.house_number ? "exact"
		: ["road", "street", "highway"].includes(t) ? "street" : "area";
	return {
		lat: parseFloat(r.lat), lon: parseFloat(r.lon),
		label: [town, a.state, a.country_code ? a.country_code.toUpperCase() : ""].filter(Boolean).join(", ") || r.display_name,
		matched: r.display_name, precision, source: "OpenStreetMap Nominatim",
	};
}

/**
 * Accepts "lat, lon" (exact), a full street address (US Census first, then OSM), or a place name.
 * Returns the match with a precision flag so the UI can warn when only a town/ZIP was matched.
 */
export async function geocode(query: string): Promise<GeoResult> {
	const q = query.trim();
	const m = q.match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
	if (m) {
		const lat = parseFloat(m[1]), lon = parseFloat(m[2]);
		if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180)
			return { lat, lon, label: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, matched: "Coordinates entered directly", precision: "exact", source: "coordinates" };
	}
	let r: GeoResult | null = null;
	if (looksLikeStreetAddress(q)) r = await censusGeocode(q);
	if (!r) r = await nominatimGeocode(q);
	if (!r && looksLikeStreetAddress(q)) {
		// rural addresses are often missing house numbers in OSM — fall back to street + town
		r = await nominatimGeocode(q.replace(/^\s*\d+[a-z]?\s+/i, ""));
		if (r) r.precision = r.precision === "exact" ? "street" : r.precision;
	}
	if (!r) throw new Error(`Couldn't find "${q}". Try the full address with city and state, or paste coordinates (in Google Maps: right-click your house → click the coordinates to copy).`);
	return r;
}

export function deviceLocation(timeoutMs = 15000): Promise<GeoResult> {
	return new Promise((resolve, reject) => {
		if (!navigator.geolocation) return reject(new Error("Geolocation not available on this device."));
		navigator.geolocation.getCurrentPosition(
			(p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, label: `${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`, matched: `Device GPS (±${Math.round(p.coords.accuracy)} m)`, precision: "exact", source: "device GPS" }),
			(e) => reject(new Error(`Device location failed: ${e.message}`)),
			{ enableHighAccuracy: true, timeout: timeoutMs }
		);
	});
}

// ---- Web-Mercator tile math ----
export const lon2tileX = (lon: number, z: number) => ((lon + 180) / 360) * Math.pow(2, z);
export const lat2tileY = (lat: number, z: number) => {
	const r = (lat * Math.PI) / 180;
	return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z);
};
export const metersPerPixel = (lat: number, z: number) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, z);

/** Offset a point by km north/east (approx; fine for <100 km). */
export function offsetKm(lat: number, lon: number, dNorthKm: number, dEastKm: number) {
	return {
		lat: lat + dNorthKm / 110.574,
		lon: lon + dEastKm / (111.32 * Math.cos((lat * Math.PI) / 180)),
	};
}
