import { App, normalizePath, requestUrl, RequestUrlParam, TFile } from "obsidian";

export const USER_AGENT = "ObsidianPrepperFieldGuide/1.0 (personal offline preparedness notes)";

export const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/** First sentence of a text (no regex lookbehind — unsupported on iOS < 16.4). */
export function firstSentence(s: string): string {
	const m = s.match(/^[\s\S]*?\.(?=\s+[A-Z("“]|\s*$)/);
	return (m ? m[0] : s).trim();
}

export function safeName(s: string): string {
	return s.replace(/[\\/:*?"<>|#^[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
}

export async function ensureFolder(app: App, path: string): Promise<void> {
	const parts = normalizePath(path).split("/");
	let cur = "";
	for (const p of parts) {
		cur = cur ? `${cur}/${p}` : p;
		if (!(await app.vault.adapter.exists(cur))) {
			try { await app.vault.createFolder(cur); } catch { /* race / exists */ }
		}
	}
}

export async function writeText(app: App, path: string, content: string): Promise<void> {
	path = normalizePath(path);
	await ensureFolder(app, path.split("/").slice(0, -1).join("/"));
	const f = app.vault.getAbstractFileByPath(path);
	if (f instanceof TFile) await app.vault.modify(f, content);
	else await app.vault.create(path, content);
}

export async function writeBinary(app: App, path: string, data: ArrayBuffer): Promise<void> {
	path = normalizePath(path);
	await ensureFolder(app, path.split("/").slice(0, -1).join("/"));
	const f = app.vault.getAbstractFileByPath(path);
	if (f instanceof TFile) await app.vault.modifyBinary(f, data);
	else await app.vault.createBinary(path, data);
}

/** requestUrl with a few retries and polite backoff. */
export async function fetchWithRetry(req: RequestUrlParam, tries = 3) {
	let lastErr: unknown;
	for (let i = 0; i < tries; i++) {
		try {
			const res = await requestUrl({ throw: false, ...req, headers: { "User-Agent": USER_AGENT, ...(req.headers || {}) } });
			if (res.status >= 200 && res.status < 300) return res;
			if (res.status === 404) throw new Error(`404 ${req.url}`);
			lastErr = new Error(`HTTP ${res.status} for ${req.url}`);
		} catch (e) {
			lastErr = e;
			if (String(e).includes("404")) throw e;
		}
		await sleep(1000 * (i + 1));
	}
	throw lastErr;
}

export async function getJson<T = unknown>(url: string, headers?: Record<string, string>): Promise<T> {
	const res = await fetchWithRetry({ url, headers: { Accept: "application/json", ...(headers || {}) } });
	return res.json as T;
}

export function today(): string {
	return new Date().toISOString().slice(0, 10);
}

export function fmtCoord(lat: number, lon: number): string {
	return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371, toR = Math.PI / 180;
	const dLat = (lat2 - lat1) * toR, dLon = (lon2 - lon1) * toR;
	const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(a));
}

export function bearing(lat1: number, lon1: number, lat2: number, lon2: number): string {
	const toR = Math.PI / 180;
	const y = Math.sin((lon2 - lon1) * toR) * Math.cos(lat2 * toR);
	const x = Math.cos(lat1 * toR) * Math.sin(lat2 * toR) - Math.sin(lat1 * toR) * Math.cos(lat2 * toR) * Math.cos((lon2 - lon1) * toR);
	const deg = (Math.atan2(y, x) / toR + 360) % 360;
	return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8];
}

export interface Logger { (msg: string): void }
