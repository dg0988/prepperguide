import * as L from "leaflet";
import { App, ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { TileSource } from "./maps";
import { Category, CATEGORY_META, Feature } from "./osm";
import { saveTile, tilePath, tileUrl } from "./tiles";
import { bearing, fetchWithRetry, fmtCoord, haversineKm } from "./util";

export const VIEW_TYPE_MAP = "prepper-offline-map";

export interface Waypoint { id: string; name: string; lat: number; lon: number; note?: string; created: string }

/** What the map needs from the plugin (keeps this file free of circular imports). */
export interface MapHost {
	app: App;
	folder(): string;
	home(): { lat: number; lon: number; label: string } | null;
	sources(): TileSource[];
	allowOnlineTiles(): boolean;
	loadPlaces(): Promise<Feature[]>;
	waypoints(): Waypoint[];
	addWaypoint(w: Waypoint): Promise<void>;
	removeWaypoint(id: string): Promise<void>;
	setHome(lat: number, lon: number): Promise<void>;
	isPro(): boolean;
	showPro(feature?: string): void;
}

const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Tile layer that reads from the vault cache, fetches+caches when online, and falls back to scaled-up parent tiles offline. */
function offlineLayer(host: MapHost, src: TileSource): L.TileLayer {
	const Layer = L.TileLayer.extend({
		createTile(this: L.TileLayer, coords: L.Coords, done: L.DoneCallback) {
			const canvas = createEl("canvas");
			canvas.width = canvas.height = 256;
			const ctx = canvas.getContext("2d")!;
			const adapter = host.app.vault.adapter;
			const folder = host.folder();
			const load = async (buf: ArrayBuffer) => createImageBitmap(new Blob([buf]));
			void (async () => {
				const { x, y, z } = coords;
				// 1. exact tile from cache
				const p = tilePath(folder, src, z, x, y);
				try {
					if (await adapter.exists(p)) { ctx.drawImage(await load(await adapter.readBinary(p)), 0, 0); return done(undefined, canvas); }
				} catch { /* fall through */ }
				// 2. fetch online and cache it
				if (host.allowOnlineTiles() && navigator.onLine && z <= src.maxZoom) {
					try {
						const res = await fetchWithRetry({ url: tileUrl(src, z, x, y) }, 1);
						ctx.drawImage(await load(res.arrayBuffer), 0, 0);
						saveTile(host.app, p, res.arrayBuffer).catch(() => {});
						return done(undefined, canvas);
					} catch { /* offline or error */ }
				}
				// 3. scale up the nearest cached parent tile (blurry beats blank)
				for (let k = 1; k <= 6 && z - k >= 0; k++) {
					const pz = z - k, px = x >> k, py = y >> k;
					const pp = tilePath(folder, src, pz, px, py);
					try {
						if (await adapter.exists(pp)) {
							const size = 256 / (1 << k);
							const sx = (x - (px << k)) * size, sy = (y - (py << k)) * size;
							ctx.imageSmoothingEnabled = true;
							ctx.drawImage(await load(await adapter.readBinary(pp)), sx, sy, size, size, 0, 0, 256, 256);
							return done(undefined, canvas);
						}
					} catch { /* keep looking */ }
				}
				ctx.fillStyle = "#d9d9d9"; ctx.fillRect(0, 0, 256, 256);
				ctx.fillStyle = "#999"; ctx.font = "12px sans-serif"; ctx.fillText("not downloaded", 80, 130);
				done(undefined, canvas);
			})();
			return canvas;
		},
	});
	return new (Layer as unknown as new (url: string, options: L.TileLayerOptions) => L.TileLayer)(BLANK, { maxNativeZoom: src.maxZoom, maxZoom: 19, attribution: src.attribution, keepBuffer: 4 });
}

const dot = (color: string, r = 7) => ({ radius: r, color: "#fff", weight: 2, fillColor: color, fillOpacity: 0.95 });

export class PrepperMapView extends ItemView {
	private map: L.Map | null = null;
	private overlays: Record<string, L.LayerGroup> = {};
	private homeLayer = L.layerGroup();
	private wpLayer = L.layerGroup();
	private gpsLayer = L.layerGroup();
	private watchId: number | null = null;
	private control: L.Control.Layers | null = null;
	pickMode = false;
	pickCenter: { lat: number; lon: number } | null = null;

	constructor(leaf: WorkspaceLeaf, private host: MapHost) { super(leaf); }
	getViewType() { return VIEW_TYPE_MAP; }
	getDisplayText() { return "Offline map"; }
	getIcon() { return "map"; }

	async onOpen() { await this.render(); }
	async onClose() { this.stopGps(); this.map?.remove(); this.map = null; }
	onResize() { this.map?.invalidateSize(); }

	async render() {
		this.stopGps();
		this.map?.remove();
		const root = this.contentEl;
		root.empty();
		root.addClass("prepper-map-root");
		if (this.pickMode) {
			root.createDiv({ cls: "prepper-banner", text: "📍 Zoom in and tap (or long-press) your exact spot, then choose “Set as my home location”." });
		}
		const el = root.createDiv({ cls: "prepper-map" });
		const home = this.host.home();
		const center = this.pickCenter || home || { lat: 39.8, lon: -98.6 };
		const map = (this.map = L.map(el, { zoomControl: true, attributionControl: true, preferCanvas: true })
			.setView([center.lat, center.lon], this.pickCenter ? 15 : home ? 13 : 4));

		const bases: Record<string, L.TileLayer> = {};
		this.host.sources().forEach((s, i) => {
			const layer = offlineLayer(this.host, s);
			bases[s.name.split(" (")[0]] = layer;
			if (i === 0) layer.addTo(map);
		});
		L.control.scale({ imperial: true, metric: true }).addTo(map);

		// Places
		this.overlays = {};
		const places = await this.host.loadPlaces();
		for (const c of Object.keys(CATEGORY_META) as Category[]) this.overlays[c] = L.layerGroup().addTo(map);
		places.forEach((f, i) => {
			const m = L.circleMarker([f.lat, f.lon], dot(CATEGORY_META[f.category].color, f.category === "water" ? 7 : 6));
			m.bindPopup(() => this.placePopup(f, i + 1));
			m.bindTooltip(f.name, { direction: "top", offset: [0, -6] });
			m.addTo(this.overlays[f.category]);
		});

		this.drawHome();
		this.drawWaypoints();
		this.homeLayer.addTo(map); this.wpLayer.addTo(map); this.gpsLayer.addTo(map);

		const overlayCtl: Record<string, L.Layer> = { "🏠 Home": this.homeLayer, "⭐ My waypoints": this.wpLayer };
		for (const c of Object.keys(CATEGORY_META) as Category[]) overlayCtl[`${CATEGORY_META[c].emoji} ${CATEGORY_META[c].label}`] = this.overlays[c];
		this.control = L.control.layers(bases, overlayCtl, { collapsed: true }).addTo(map);

		// Toolbar
		const Bar = L.Control.extend({
			onAdd: () => {
				const div = L.DomUtil.create("div", "leaflet-bar prepper-bar");
				const btn = (label: string, title: string, fn: () => void) => {
					const a = L.DomUtil.create("a", "", div);
					a.href = "#"; a.title = title; a.setText(label);
					L.DomEvent.on(a, "click", (e) => { L.DomEvent.preventDefault(e); L.DomEvent.stopPropagation(e); fn(); });
				};
				btn("🏠", "Center on home", () => { const h = this.host.home(); if (h) map.setView([h.lat, h.lon], Math.max(map.getZoom(), 14)); });
				btn("📍", "Show my GPS position (works offline on phones)", () => this.toggleGps());
				btn("💧", "Nearest water to map center", () => this.nearestWater(places));
				return div;
			},
		});
		new (Bar as unknown as new (options: L.ControlOptions) => L.Control)({ position: "topleft" }).addTo(map);

		map.on("contextmenu", (e: L.LeafletMouseEvent) => this.pointPopup(e.latlng));
		map.on("click", (e: L.LeafletMouseEvent) => { if (this.pickMode) this.pointPopup(e.latlng); });
		window.setTimeout(() => map.invalidateSize(), 100);
	}

	private distLine(lat: number, lon: number): string {
		const h = this.host.home();
		if (!h) return "";
		const km = haversineKm(h.lat, h.lon, lat, lon);
		return `${(km * 0.621371).toFixed(2)} mi (${km.toFixed(2)} km) ${bearing(h.lat, h.lon, lat, lon)} of home`;
	}

	private placePopup(f: Feature, n: number): HTMLElement {
		const d = createDiv({ cls: "prepper-popup" });
		d.createEl("b", { text: `${CATEGORY_META[f.category].emoji} ${f.name}` });
		d.createDiv({ text: `#${n} · ${f.kind}` });
		d.createDiv({ text: this.distLine(f.lat, f.lon) });
		d.createDiv({ text: fmtCoord(f.lat, f.lon), cls: "prepper-coords" });
		const t = f.tags;
		[t.phone && `☎ ${t.phone}`, t.opening_hours, t.drinking_water && `drinking_water=${t.drinking_water}`, t.well_depth_ft && `Well depth: ${t.well_depth_ft} ft`]
			.filter(Boolean).forEach((s) => d.createDiv({ text: String(s) }));
		if (f.category === "water") d.createDiv({ cls: "prepper-warn", text: "Treat before drinking. May be on private land — get permission." });
		if (t.usgs_url) d.createEl("a", { text: "USGS record", href: t.usgs_url });
		this.wpButton(d, f.lat, f.lon, f.name);
		return d;
	}

	private pointPopup(ll: L.LatLng) {
		const d = createDiv({ cls: "prepper-popup" });
		d.createDiv({ text: fmtCoord(ll.lat, ll.lng), cls: "prepper-coords" });
		const dl = this.distLine(ll.lat, ll.lng);
		if (dl) d.createDiv({ text: dl });
		const row = d.createDiv({ cls: "prepper-btns" });
		const homeBtn = row.createEl("button", { text: this.pickMode ? "✅ Set as my home location" : "🏠 Set as home" });
		if (this.pickMode) homeBtn.addClass("mod-cta");
		homeBtn.onclick = async () => { this.map?.closePopup(); this.pickMode = false; await this.host.setHome(ll.lat, ll.lng); };
		this.wpButton(row, ll.lat, ll.lng);
		const copy = row.createEl("button", { text: "📋 Copy" });
		copy.onclick = () => { void navigator.clipboard.writeText(fmtCoord(ll.lat, ll.lng)).then(() => new Notice("Coordinates copied")); };
		L.popup().setLatLng(ll).setContent(d).openOn(this.map!);
	}

	private wpButton(parent: HTMLElement, lat: number, lon: number, suggested = "") {
		const b = parent.createEl("button", { text: this.host.isPro() ? "⭐ Waypoint" : "⭐ Waypoint (Pro)" });
		b.onclick = async () => {
			if (!this.host.isPro()) { this.map?.closePopup(); this.host.showPro("Map waypoints"); return; }
			const box = parent.createDiv({ cls: "prepper-wp-form" });
			b.remove();
			const input = box.createEl("input", { type: "text", placeholder: "Name (e.g. Cache #1, Rally point)" });
			input.value = suggested;
			const note = box.createEl("input", { type: "text", placeholder: "Note (optional)" });
			const save = box.createEl("button", { text: "Save", cls: "mod-cta" });
			window.setTimeout(() => input.focus(), 50);
			save.onclick = async () => {
				const w: Waypoint = { id: String(Date.now()), name: input.value.trim() || "Waypoint", lat, lon, note: note.value.trim() || undefined, created: new Date().toISOString().slice(0, 10) };
				await this.host.addWaypoint(w);
				this.map?.closePopup();
				this.drawWaypoints();
				new Notice(`⭐ Saved waypoint: ${w.name}`);
			};
		};
	}

	drawHome() {
		this.homeLayer.clearLayers();
		const h = this.host.home();
		if (!h) return;
		L.circleMarker([h.lat, h.lon], { radius: 11, color: "#000", weight: 3, fillColor: "#ffd60a", fillOpacity: 1 })
			.bindTooltip(`🏠 ${h.label || "Home"}`, { permanent: false }).addTo(this.homeLayer);
	}

	drawWaypoints() {
		this.wpLayer.clearLayers();
		for (const w of this.host.waypoints()) {
			const m = L.marker([w.lat, w.lon], { icon: L.divIcon({ className: "prepper-star", html: "⭐", iconSize: [22, 22], iconAnchor: [11, 11] }) });
			m.bindTooltip(w.name);
			m.bindPopup(() => {
				const d = createDiv({ cls: "prepper-popup" });
				d.createEl("b", { text: `⭐ ${w.name}` });
				if (w.note) d.createDiv({ text: w.note });
				d.createDiv({ text: this.distLine(w.lat, w.lon) });
				d.createDiv({ text: fmtCoord(w.lat, w.lon), cls: "prepper-coords" });
				const del = d.createEl("button", { text: "🗑 Delete" });
				del.onclick = async () => { await this.host.removeWaypoint(w.id); this.map?.closePopup(); this.drawWaypoints(); };
				return d;
			});
			m.addTo(this.wpLayer);
		}
	}

	private nearestWater(places: Feature[]) {
		if (!this.map) return;
		const c = this.map.getCenter();
		const w = places.filter((p) => p.category === "water")
			.map((p) => ({ p, d: haversineKm(c.lat, c.lng, p.lat, p.lon) })).sort((a, b) => a.d - b.d).slice(0, 5);
		if (!w.length) { new Notice("No water sources loaded — run the field-guide build first."); return; }
		const bounds = L.latLngBounds([[c.lat, c.lng], ...w.map((x) => [x.p.lat, x.p.lon] as [number, number])]);
		this.map.fitBounds(bounds.pad(0.2));
		new Notice("Nearest water to map center:\n" + w.map((x) => `• ${x.p.name} (${x.p.kind}) — ${(x.d * 0.621371).toFixed(2)} mi ${bearing(c.lat, c.lng, x.p.lat, x.p.lon)}`).join("\n"), 12000);
	}

	private toggleGps() {
		if (this.watchId != null) { this.stopGps(); new Notice("GPS off"); return; }
		if (!navigator.geolocation) { new Notice("No GPS on this device"); return; }
		new Notice("Finding your position…");
		let first = true;
		this.watchId = navigator.geolocation.watchPosition((pos) => {
			const ll: [number, number] = [pos.coords.latitude, pos.coords.longitude];
			this.gpsLayer.clearLayers();
			L.circle(ll, { radius: pos.coords.accuracy, color: "#1e6fd9", weight: 1, fillOpacity: 0.12 }).addTo(this.gpsLayer);
			L.circleMarker(ll, dot("#1e6fd9", 8)).bindTooltip(`You (±${Math.round(pos.coords.accuracy)} m) · ${this.distLine(ll[0], ll[1])}`).addTo(this.gpsLayer);
			if (first) { this.map?.setView(ll, Math.max(this.map.getZoom(), 15)); first = false; }
		}, (e) => { new Notice(`GPS error: ${e.message}`); this.stopGps(); }, { enableHighAccuracy: true, maximumAge: 5000 });
	}

	private stopGps() {
		if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
		this.watchId = null;
		this.gpsLayer.clearLayers();
	}
}
