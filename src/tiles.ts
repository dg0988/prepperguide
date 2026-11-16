import { App, normalizePath } from "obsidian";
import { lat2tileY, lon2tileX, offsetKm } from "./geo";
import { TileSource } from "./maps";
import { fetchWithRetry, Logger, sleep } from "./util";

/**
 * Offline tile cache. Tiles are stored as individual files under a dot-folder
 * (e.g. "Prepper/.tiles/usgs-topo/15/9012/13280.jpg"). Obsidian doesn't index dot-folders,
 * so thousands of tiles don't clutter search or the file explorer, but they still sync
 * with any file-level sync (Google Drive, Syncthing, GSync if it includes hidden folders).
 */
export const tileDir = (folder: string, src: TileSource) => normalizePath(`${folder}/.tiles/${src.id}`);
export const tilePath = (folder: string, src: TileSource, z: number, x: number, y: number) => `${tileDir(folder, src)}/${z}/${x}/${y}.jpg`;
export const tileUrl = (src: TileSource, z: number, x: number, y: number) =>
	src.url.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));

export interface CachePlan {
	overviewRadiusKm: number; overviewMinZoom: number; overviewMaxZoom: number;
	detailRadiusKm: number; detailMaxZoom: number;
	extraPoints?: { lat: number; lon: number }[]; // waypoints also get detail coverage
}

function tileRange(lat: number, lon: number, radiusKm: number, z: number) {
	const nw = offsetKm(lat, lon, radiusKm, -radiusKm), se = offsetKm(lat, lon, -radiusKm, radiusKm);
	return {
		x0: Math.floor(lon2tileX(nw.lon, z)), x1: Math.floor(lon2tileX(se.lon, z)),
		y0: Math.floor(lat2tileY(nw.lat, z)), y1: Math.floor(lat2tileY(se.lat, z)),
	};
}

export function planTiles(lat: number, lon: number, p: CachePlan, maxZoom: number): Map<string, [number, number, number]> {
	const set = new Map<string, [number, number, number]>();
	const add = (clat: number, clon: number, r: number, zFrom: number, zTo: number) => {
		for (let z = zFrom; z <= Math.min(zTo, maxZoom); z++) {
			const t = tileRange(clat, clon, r, z);
			for (let x = t.x0; x <= t.x1; x++) for (let y = t.y0; y <= t.y1; y++) set.set(`${z}/${x}/${y}`, [z, x, y]);
		}
	};
	add(lat, lon, p.overviewRadiusKm, p.overviewMinZoom, p.overviewMaxZoom);
	add(lat, lon, p.detailRadiusKm, p.overviewMaxZoom + 1, p.detailMaxZoom);
	for (const w of p.extraPoints || []) add(w.lat, w.lon, Math.min(2, p.detailRadiusKm), p.overviewMaxZoom + 1, p.detailMaxZoom);
	return set;
}

export async function saveTile(app: App, path: string, data: ArrayBuffer) {
	const dir = path.split("/").slice(0, -1).join("/");
	if (!(await app.vault.adapter.exists(dir))) await app.vault.adapter.mkdir(dir);
	await app.vault.adapter.writeBinary(path, data);
}

/** Downloads every planned tile that isn't already cached. Safe to re-run (resumes). */
export async function cacheTiles(app: App, folder: string, src: TileSource, lat: number, lon: number, plan: CachePlan, log: Logger) {
	const tiles = [...planTiles(lat, lon, plan, src.maxZoom).values()];
	const missing: [number, number, number][] = [];
	for (const t of tiles) if (!(await app.vault.adapter.exists(tilePath(folder, src, ...t)))) missing.push(t);
	log(`Offline map — ${src.name.split(" (")[0]}: ${tiles.length} tiles planned, ${tiles.length - missing.length} already cached, downloading ${missing.length}…`);
	let done = 0, failed = 0, bytes = 0;
	const worker = async () => {
		while (missing.length) {
			const [z, x, y] = missing.shift()!;
			try {
				const res = await fetchWithRetry({ url: tileUrl(src, z, x, y) }, 2);
				await saveTile(app, tilePath(folder, src, z, x, y), res.arrayBuffer);
				bytes += res.arrayBuffer.byteLength;
			} catch { failed++; }
			if (++done % 200 === 0) log(`  …${done} tiles (${(bytes / 1048576).toFixed(0)} MB)`);
			await sleep(30);
		}
	};
	await Promise.all([worker(), worker(), worker(), worker()]);
	log(`  done: ${(bytes / 1048576).toFixed(1)} MB downloaded${failed ? `, ${failed} failed (re-run to retry)` : ""}`);
}

/** Rough size estimate for the settings screen (≈25 KB per tile). */
export function estimate(lat: number, lon: number, plan: CachePlan, sources: number) {
	const n = planTiles(lat, lon, plan, 16).size * sources;
	return { tiles: n, mb: Math.round((n * 25) / 1024) };
}
