import { App } from "obsidian";
import { lat2tileY, lon2tileX, metersPerPixel, offsetKm } from "./geo";
import { CATEGORY_META, Feature } from "./osm";
import { fetchWithRetry, Logger, sleep, writeBinary } from "./util";

export interface TileSource { id: string; name: string; url: string; maxZoom: number; attribution: string }

export const TILE_SOURCES: TileSource[] = [
	{
		id: "usgs-topo",
		name: "USGS Topo (US only, public domain)",
		url: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}",
		maxZoom: 16,
		attribution: "USGS The National Map",
	},
	{
		id: "usgs-imagery-topo",
		name: "USGS Satellite + Topo labels (US only, public domain)",
		url: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}",
		maxZoom: 16,
		attribution: "USGS The National Map",
	},
];

export interface MapJob {
	lat: number; lon: number; radiusKm: number;
	zooms: number[]; maxTilesPerSide: number;
	sources: TileSource[];
	features: Feature[];
	folder: string;
	log: Logger;
}

export interface MapImage { path: string; zoom: number; source: TileSource; widthKm: number; heightKm: number }

async function loadBitmap(buf: ArrayBuffer): Promise<ImageBitmap | null> {
	try { return await createImageBitmap(new Blob([buf])); } catch { return null; }
}

function niceScale(mpp: number, targetPx: number): { meters: number; px: number; label: string } {
	const target = mpp * targetPx;
	const steps = [50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000];
	let m = steps[0];
	for (const s of steps) if (s <= target) m = s;
	const miles = m / 1609.344;
	const label = m >= 1000 ? `${m / 1000} km (${miles.toFixed(1)} mi)` : `${m} m (${Math.round(m * 3.28084)} ft)`;
	return { meters: m, px: m / mpp, label };
}

export async function buildMaps(app: App, job: MapJob): Promise<MapImage[]> {
	const out: MapImage[] = [];
	const nw = offsetKm(job.lat, job.lon, job.radiusKm, -job.radiusKm);
	const se = offsetKm(job.lat, job.lon, -job.radiusKm, job.radiusKm);

	for (const src of job.sources) {
		for (const zRaw of job.zooms) {
			const z = Math.min(zRaw, src.maxZoom);
			let x0 = Math.floor(lon2tileX(nw.lon, z)), x1 = Math.floor(lon2tileX(se.lon, z));
			let y0 = Math.floor(lat2tileY(nw.lat, z)), y1 = Math.floor(lat2tileY(se.lat, z));
			const cx = Math.floor(lon2tileX(job.lon, z)), cy = Math.floor(lat2tileY(job.lat, z));
			const half = Math.floor(job.maxTilesPerSide / 2);
			if (x1 - x0 + 1 > job.maxTilesPerSide) { x0 = cx - half; x1 = x0 + job.maxTilesPerSide - 1; }
			if (y1 - y0 + 1 > job.maxTilesPerSide) { y0 = cy - half; y1 = y0 + job.maxTilesPerSide - 1; }
			const nx = x1 - x0 + 1, ny = y1 - y0 + 1;
			job.log(`Map: ${src.name.split(" (")[0]} zoom ${z} — downloading ${nx * ny} tiles…`);

			const canvas = createEl("canvas");
			canvas.width = nx * 256; canvas.height = ny * 256;
			const ctx = canvas.getContext("2d")!;
			ctx.fillStyle = "#e8e8e8"; ctx.fillRect(0, 0, canvas.width, canvas.height);

			const coords: [number, number][] = [];
			for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) coords.push([x, y]);
			let failed = 0, done = 0;
			const worker = async () => {
				while (coords.length) {
					const [x, y] = coords.shift()!;
					const url = src.url.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
					try {
						const res = await fetchWithRetry({ url }, 2);
						const bmp = await loadBitmap(res.arrayBuffer);
						if (bmp) ctx.drawImage(bmp, (x - x0) * 256, (y - y0) * 256); else failed++;
					} catch { failed++; }
					done++;
					if (done % 50 === 0) job.log(`  …${done}/${nx * ny} tiles`);
					await sleep(40); // be polite to the tile server
				}
			};
			await Promise.all([worker(), worker(), worker(), worker()]);
			if (failed) job.log(`  ${failed} tiles failed (left gray).`);

			const px = (lat: number, lon: number) => ({ x: (lon2tileX(lon, z) - x0) * 256, y: (lat2tileY(lat, z) - y0) * 256 });

			// Feature markers (numbers match the Resources note)
			const r = z >= 14 ? 11 : 9;
			ctx.font = `bold ${r + 1}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
			job.features.forEach((f, i) => {
				const p = px(f.lat, f.lon);
				if (p.x < 0 || p.y < 0 || p.x > canvas.width || p.y > canvas.height) return;
				ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
				ctx.fillStyle = CATEGORY_META[f.category].color; ctx.fill();
				ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();
				ctx.fillStyle = "#fff"; ctx.fillText(String(i + 1), p.x, p.y + 1);
			});

			// Home marker
			const h = px(job.lat, job.lon);
			ctx.lineWidth = 4; ctx.strokeStyle = "#000";
			ctx.beginPath(); ctx.arc(h.x, h.y, 16, 0, Math.PI * 2); ctx.stroke();
			ctx.lineWidth = 2.5; ctx.strokeStyle = "#ff0";
			ctx.beginPath(); ctx.arc(h.x, h.y, 16, 0, Math.PI * 2); ctx.stroke();
			ctx.beginPath(); ctx.moveTo(h.x - 24, h.y); ctx.lineTo(h.x + 24, h.y); ctx.moveTo(h.x, h.y - 24); ctx.lineTo(h.x, h.y + 24); ctx.stroke();

			// Scale bar, north arrow, attribution
			const mpp = metersPerPixel(job.lat, z);
			const sb = niceScale(mpp, 220);
			const bx = 20, by = canvas.height - 30;
			ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillRect(bx - 10, by - 28, sb.px + 20, 44);
			ctx.fillStyle = "#000"; ctx.fillRect(bx, by, sb.px, 6);
			ctx.font = "bold 14px sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
			ctx.fillText(sb.label, bx, by - 8);
			ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillRect(canvas.width - 50, 10, 40, 50);
			ctx.fillStyle = "#000"; ctx.font = "bold 20px sans-serif"; ctx.textAlign = "center";
			ctx.fillText("N", canvas.width - 30, 32); ctx.fillText("▲", canvas.width - 30, 54);
			ctx.font = "12px sans-serif"; ctx.textAlign = "right";
			ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillRect(canvas.width - 260, canvas.height - 22, 255, 18);
			ctx.fillStyle = "#000"; ctx.fillText(`${src.attribution} · zoom ${z}`, canvas.width - 10, canvas.height - 8);

			const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Canvas export failed (image too large for this device? lower 'max tiles per side')"))), "image/jpeg", 0.88));
			const path = `${job.folder}/Maps/${src.id}-z${z}.jpg`;
			await writeBinary(app, path, await blob.arrayBuffer());
			out.push({ path, zoom: z, source: src, widthKm: (canvas.width * mpp) / 1000, heightKm: (canvas.height * mpp) / 1000 });
		}
	}
	return out;
}
