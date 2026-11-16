import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from "obsidian";
import { deviceLocation, geocode, GeoResult } from "./geo";
import { MapHost, PrepperMapView, VIEW_TYPE_MAP, Waypoint } from "./mapview";
import { cacheTiles, CachePlan, estimate } from "./tiles";
import { fetchUsgsWater } from "./usgs";
import { GUIDES } from "./guides";
import { buildMaps, MapImage, TILE_SOURCES, TileSource } from "./maps";
import { Category, CATEGORY_META, Feature, fetchOsmFeatures } from "./osm";
import { buildPlants } from "./plants";
import { bearing, fmtCoord, haversineKm, Logger, today, writeText } from "./util";
import { buildWeather } from "./weather";
import { buildAlmanac } from "./almanac";
import { buildPantry, FAMILY_PLAN } from "./pantry";
import { buildMedicinal } from "./medicinal";
import { BUY_URL, License, PRICE, verifyLicense } from "./license";

interface Settings {
	folder: string;
	label: string;
	lat: number | null;
	lon: number | null;
	matched: string;
	precision: string;
	waypoints: Waypoint[];
	mapRadiusKm: number;
	overviewMinZoom: number;
	overviewMaxZoom: number;
	detailRadiusKm: number;
	detailMaxZoom: number;
	allowOnlineTiles: boolean;
	printableMaps: boolean;
	useUsgsWater: boolean;
	zooms: string;
	tileSources: string[]; // ids, or "custom"
	customTileUrl: string;
	customTileAttribution: string;
	maxTilesPerSide: number;
	resourceRadiusKm: number;
	maxMarkers: number;
	plantRadiusKm: number;
	includeFungi: boolean;
	downloadPhotos: boolean;
	openLicensePhotosOnly: boolean;
	doMaps: boolean; doResources: boolean; doPlants: boolean; doWeather: boolean; doGuides: boolean;
	doAlmanac: boolean; doPantry: boolean; doMedicinal: boolean;
	licenseKey: string;
	adults: number; children: number; pantryDays: number; dogs: number; cats: number;
}

const FREE = { overviewKm: 15, detailKm: 3, maxZoom: 15 };

const DEFAULTS: Settings = {
	folder: "Prepper",
	label: "",
	lat: null, lon: null, matched: "", precision: "",
	waypoints: [],
	mapRadiusKm: 25,
	overviewMinZoom: 8,
	overviewMaxZoom: 13,
	detailRadiusKm: 5,
	detailMaxZoom: 16,
	allowOnlineTiles: true,
	printableMaps: false,
	useUsgsWater: true,
	zooms: "11,13,15",
	tileSources: ["usgs-topo", "usgs-imagery-topo"],
	customTileUrl: "",
	customTileAttribution: "",
	maxTilesPerSide: 14,
	resourceRadiusKm: 20,
	maxMarkers: 150,
	plantRadiusKm: 25,
	includeFungi: true,
	downloadPhotos: true,
	openLicensePhotosOnly: true,
	doMaps: true, doResources: true, doPlants: true, doWeather: true, doGuides: true,
	doAlmanac: true, doPantry: true, doMedicinal: true,
	licenseKey: "",
	adults: 2, children: 0, pantryDays: 90, dogs: 0, cats: 0,
};

export default class PrepperPlugin extends Plugin implements MapHost {
	settings!: Settings;
	private features: Feature[] | null = null;
	private busy = false;

	async onload() {
		this.settings = Object.assign({}, DEFAULTS, await this.loadData());
		this.registerView(VIEW_TYPE_MAP, (leaf: WorkspaceLeaf) => new PrepperMapView(leaf, this));
		this.addRibbonIcon("tent", "Prepper: build / refresh field guide", () => this.buildAll());
		this.addRibbonIcon("map", "Prepper: open offline map", () => this.openMap());
		this.addCommand({ id: "open-map", name: "Open offline map", callback: () => this.openMap() });
		this.addCommand({ id: "set-location", name: "Set my location", callback: () => this.promptLocation() });
		this.addCommand({ id: "pick-location", name: "Pick my exact location on the map", callback: () => this.openMap(true) });
		this.addCommand({ id: "build-all", name: "Build / refresh entire field guide", callback: () => this.buildAll() });
		this.addCommand({ id: "build-maps", name: "Download offline maps", callback: () => this.run({ maps: true }) });
		this.addCommand({ id: "build-resources", name: "Find local water sources & emergency resources", callback: () => this.run({ resources: true }) });
		this.addCommand({ id: "build-plants", name: "Build local edible & poisonous plant guide", callback: () => this.run({ plants: true }) });
		this.addCommand({ id: "build-weather", name: "Refresh weather & alerts", callback: () => this.run({ weather: true }) });
		this.addCommand({ id: "build-almanac", name: "Build local almanac (frost dates, normals, outlook, planting)", callback: () => this.requirePro("Local almanac") && this.run({ almanac: true }) });
		this.addCommand({ id: "build-pantry", name: "Update pantry plan", callback: () => this.requirePro("Pantry planner") && this.run({ pantry: true }) });
		this.addCommand({ id: "build-medicinal", name: "Build local medicinal plant guide", callback: () => this.requirePro("Medicinal plants guide") && this.run({ medicinal: true }) });
		this.addCommand({ id: "pro", name: "Pro: enter license key / upgrade", callback: () => this.showPro() });
		this.addCommand({ id: "build-guides", name: "Write survival guides (water, fire, shelter, first aid…)", callback: () => this.run({ guides: true }) });
		this.addSettingTab(new PrepperSettingTab(this.app, this));
	}

	async saveSettings() { await this.saveData(this.settings); }

	// ---------- Pro ----------
	private licCache: { key: string; lic: License | null } | null = null;
	license(): License | null {
		if (!this.licCache || this.licCache.key !== this.settings.licenseKey) this.licCache = { key: this.settings.licenseKey, lic: verifyLicense(this.settings.licenseKey) };
		return this.licCache.lic;
	}
	isPro() { return !!this.license(); }
	showPro(feature?: string) { new ProModal(this.app, this, feature).open(); }
	/** For explicit Pro commands: returns true if unlocked, otherwise shows the upgrade dialog. */
	requirePro(feature: string) { if (this.isPro()) return true; this.showPro(feature); return false; }

	hasLocation() { return this.settings.lat != null && this.settings.lon != null; }

	// ---------- MapHost ----------
	folder() { return this.settings.folder; }
	home() { return this.hasLocation() ? { lat: this.settings.lat!, lon: this.settings.lon!, label: this.settings.label } : null; }
	allowOnlineTiles() { return this.settings.allowOnlineTiles; }
	waypoints() { return this.settings.waypoints; }
	sources(): TileSource[] {
		const s = this.settings;
		const list = s.tileSources.map((id) =>
			id === "custom"
				? (s.customTileUrl ? { id: "custom", name: "Custom", url: s.customTileUrl, maxZoom: 19, attribution: s.customTileAttribution || "Custom tiles" } : null)
				: TILE_SOURCES.find((t) => t.id === id) || null
		).filter((x): x is TileSource => !!x);
		return list.length ? list : [TILE_SOURCES[0]];
	}
	private placesPath() { return `${this.settings.folder}/.data/places.json`; }
	async loadPlaces(): Promise<Feature[]> {
		if (this.features) return this.features;
		try { this.features = JSON.parse(await this.app.vault.adapter.read(this.placesPath())); } catch { this.features = []; }
		return this.features!;
	}
	private async savePlaces(f: Feature[]) {
		const dir = `${this.settings.folder}/.data`;
		if (!(await this.app.vault.adapter.exists(dir))) await this.app.vault.adapter.mkdir(dir);
		await this.app.vault.adapter.write(this.placesPath(), JSON.stringify(f));
	}
	async addWaypoint(w: Waypoint) { this.settings.waypoints.push(w); await this.saveSettings(); await this.writeWaypoints(); }
	async removeWaypoint(id: string) { this.settings.waypoints = this.settings.waypoints.filter((w) => w.id !== id); await this.saveSettings(); await this.writeWaypoints(); }
	async setHome(lat: number, lon: number) {
		const s = this.settings;
		s.lat = lat; s.lon = lon; s.precision = "exact"; s.matched = "Picked on map";
		if (!s.label || /^-?\d/.test(s.label)) s.label = fmtCoord(lat, lon);
		this.features = null;
		await this.saveSettings();
		this.refreshMaps();
		new Notice(`🏠 Home set to ${fmtCoord(lat, lon)}`);
		new ConfirmModal(this.app, "Update the field guide for this exact spot?",
			"Recalculates water/resource distances, downloads detailed map tiles around it, and refreshes plants & weather.",
			() => this.buildAll()).open();
	}

	async openMap(pick = false, center?: { lat: number; lon: number }) {
		let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_MAP)[0];
		if (!leaf) { leaf = this.app.workspace.getLeaf("tab"); await leaf.setViewState({ type: VIEW_TYPE_MAP, active: true }); }
		const view = leaf.view as PrepperMapView;
		view.pickMode = pick;
		view.pickCenter = center || null;
		await view.render();
		this.app.workspace.revealLeaf(leaf);
	}
	private refreshMaps() {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_MAP)) {
			const v = leaf.view as PrepperMapView; v.pickMode = false; v.pickCenter = null; v.render();
		}
	}

	promptLocation(): Promise<boolean> {
		return new Promise((resolve) => {
			new LocationModal(this.app, async (g, pick) => {
				if (pick) { resolve(false); await this.openMap(true, g ? { lat: g.lat, lon: g.lon } : undefined); return; }
				if (!g) return resolve(false);
				const s = this.settings;
				s.lat = g.lat; s.lon = g.lon; s.label = g.label; s.matched = g.matched || ""; s.precision = g.precision;
				this.features = null;
				await this.saveSettings();
				this.refreshMaps();
				new Notice(`📍 Location set: ${g.matched || g.label}`);
				resolve(true);
			}).open();
		});
	}

	async buildAll() {
		const s = this.settings;
		await this.run({ maps: s.doMaps, resources: s.doResources || s.doMaps, plants: s.doPlants, weather: s.doWeather, guides: s.doGuides, almanac: s.doAlmanac, pantry: s.doPantry, medicinal: s.doMedicinal });
	}

	/** Free tier: 15 km overview, 3 km detail to zoom 15. Pro: settings as chosen (up to 100 km / 20 km / zoom 16) + waypoint detail. */
	cachePlan(): CachePlan {
		const s = this.settings, pro = this.isPro();
		return {
			overviewRadiusKm: pro ? s.mapRadiusKm : Math.min(s.mapRadiusKm, FREE.overviewKm),
			overviewMinZoom: s.overviewMinZoom, overviewMaxZoom: s.overviewMaxZoom,
			detailRadiusKm: pro ? s.detailRadiusKm : Math.min(s.detailRadiusKm, FREE.detailKm),
			detailMaxZoom: pro ? s.detailMaxZoom : Math.min(s.detailMaxZoom, FREE.maxZoom),
			extraPoints: pro ? s.waypoints : [],
		};
	}

	async run(what: { maps?: boolean; resources?: boolean; plants?: boolean; weather?: boolean; guides?: boolean; almanac?: boolean; pantry?: boolean; medicinal?: boolean }) {
		if (this.busy) { new Notice("Prepper: a build is already running."); return; }
		if (!this.hasLocation() && !(await this.promptLocation())) return;
		this.busy = true;
		const s = this.settings;
		const lat = s.lat!, lon = s.lon!;
		const pro = this.isPro();
		const skippedPro = (["almanac", "pantry", "medicinal"] as const).filter((k) => what[k] && !pro);
		if (!pro) { what = { ...what, almanac: false, pantry: false, medicinal: false }; }
		const modal = new ProgressModal(this.app);
		modal.open();
		const log: Logger = (m) => modal.log(m);
		const errors: string[] = [];
		const step = async (name: string, fn: () => Promise<void>) => {
			try { await fn(); } catch (e) { errors.push(`${name}: ${e instanceof Error ? e.message : e}`); log(`❌ ${name} failed: ${e}`); }
		};
		log(`📍 ${s.matched || s.label} (${fmtCoord(lat, lon)})${pro ? " · ⭐ Pro" : ""}`);
		if (skippedPro.length) log(`🔒 Skipping Pro features (${skippedPro.join(", ")}) — command palette → “Prepper: Pro: enter license key / upgrade”.`);
		if (s.precision === "area") log("⚠️ Your location is only town/ZIP-level. Distances are from the town center — use “Pick my exact location on the map” for accurate results.");

		if (what.resources || what.maps) {
			await step("Local resources", async () => {
				log("Resources: querying OpenStreetMap (water, medical, shelters, supplies)…");
				const osm = await fetchOsmFeatures(lat, lon, s.resourceRadiusKm);
				log(`  OpenStreetMap: ${osm.length} places`);
				let usgs: Feature[] = [];
				if (s.useUsgsWater) { log("Resources: querying USGS for springs, wells and streams…"); usgs = await fetchUsgsWater(lat, lon, s.resourceRadiusKm, log); }
				this.features = [...osm, ...usgs].sort((a, b) => a.distKm - b.distKm);
				await this.savePlaces(this.features);
				await this.writeResources(this.features);
			});
		}
		if (what.maps) {
			await step("Maps", async () => {
				for (const src of this.sources()) await cacheTiles(this.app, s.folder, src, lat, lon, this.cachePlan(), log);
				let images: MapImage[] = [];
				if (s.printableMaps && pro) {
					const zooms = s.zooms.split(",").map((z) => parseInt(z.trim())).filter((z) => z >= 5 && z <= 19);
					images = await buildMaps(this.app, {
						lat, lon, radiusKm: Math.min(s.mapRadiusKm, 15), zooms, maxTilesPerSide: s.maxTilesPerSide,
						sources: this.sources(), features: (this.features || []).slice(0, s.maxMarkers), folder: s.folder, log,
					});
				}
				await this.writeMapsNote(images);
				this.refreshMaps();
			});
		}
		let plantCounts: any[] | undefined;
		if (what.plants) {
			await step("Plants", async () => {
				const r = await buildPlants(this.app, {
					lat, lon, radiusKm: s.plantRadiusKm, folder: s.folder, includeFungi: s.includeFungi,
					openLicensePhotosOnly: s.openLicensePhotosOnly, downloadPhotos: s.downloadPhotos, log,
				});
				log(`  🟢 ${r.counts.edible} edible · 🟡 ${r.counts.caution} caution · 🔴 ${r.counts.toxic} toxic · ☠️ ${r.counts.deadly} deadly`);
				plantCounts = r.plantCounts;
			});
		}
		if (what.medicinal) {
			await step("Medicinal plants", async () => {
				const n = await buildMedicinal(this.app, { lat, lon, radiusKm: s.plantRadiusKm, folder: s.folder, downloadPhotos: s.downloadPhotos, openLicensePhotosOnly: s.openLicensePhotosOnly, log, counts: plantCounts });
				log(`  🌿 ${n} medicinal species found near you`);
			});
		}
		if (what.weather) await step("Weather", async () => { await buildWeather(this.app, lat, lon, s.folder, log); });
		if (what.almanac) await step("Almanac", async () => { await buildAlmanac(this.app, lat, lon, s.folder, log); log("Almanac: frost dates, normals, outlook, planting calendar, sun & moon written"); });
		if (what.pantry) {
			await step("Pantry", async () => {
				await buildPantry(this.app, s.folder, { adults: s.adults, children: s.children, days: s.pantryDays, dogs: s.dogs, cats: s.cats });
				log(`Pantry: plan written for ${s.adults} adults + ${s.children} children, ${s.pantryDays} days`);
			});
		}
		if (what.guides) {
			await step("Guides", async () => {
				for (const [title, body] of Object.entries(GUIDES)) await writeText(this.app, `${s.folder}/Guides/${title}.md`, body);
				const plan = `${s.folder}/Family Emergency Plan.md`;
				if (!this.app.vault.getAbstractFileByPath(plan)) await writeText(this.app, plan, FAMILY_PLAN);
				log(`Guides: wrote ${Object.keys(GUIDES).length} survival guides`);
			});
		}
		await step("Home note", () => this.writeHome());
		await step("Waypoints note", () => this.writeWaypoints());
		this.busy = false;
		modal.done(errors);
		if (!errors.length) this.app.workspace.openLinkText(`${s.folder}/Prepper Home.md`, "", false);
	}

	private async writeResources(features: Feature[]) {
		const s = this.settings;
		const L: string[] = ["---", "tags: [prepper/resources]", `updated: ${today()}`, "---", "# 🗺️ Local Water Sources & Emergency Resources"];
		L.push(`Measured from **${s.matched || s.label}** (${fmtCoord(s.lat!, s.lon!)}), within **${s.resourceRadiusKm} km / ${(s.resourceRadiusKm * 0.621371).toFixed(0)} mi**. Open the interactive map with the 🗺️ ribbon icon.`);
		if (s.precision === "area") L.push("", "> [!warning] Location is only town/ZIP-level\n> Distances below are from the town center, not your home. Run **Prepper: Pick my exact location on the map**.");
		L.push("", "> [!info] Sources: OpenStreetMap and the USGS national water inventory. USGS springs/wells are *recorded sites* — some are on private land, capped, dry, or monitoring-only. Scout them in advance and get permission. **Treat all natural water** — see [[Water Purification]].", "");
		const water = features.filter((f) => f.category === "water").slice(0, 8);
		if (water.length) {
			L.push("## 💧 Nearest water at a glance");
			water.forEach((f) => L.push(`- **${f.name}** — ${f.kind}, ${(f.distKm * 0.621371).toFixed(2)} mi ${bearing(s.lat!, s.lon!, f.lat, f.lon)}`));
			L.push("");
		}
		const cats: Category[] = ["water", "medical", "emergency", "shelter", "supplies"];
		for (const c of cats) {
			const items = features.map((f, i) => ({ f, n: i + 1 })).filter((x) => x.f.category === c);
			if (!items.length) continue;
			const m = CATEGORY_META[c];
			L.push(`## ${m.emoji} ${m.label} (${items.length})`, "| # | Name | Type | Distance | Coordinates | Notes |", "|---|---|---|---|---|---|");
			for (const { f, n } of items) {
				const mi = (f.distKm * 0.621371).toFixed(2);
				const t = f.tags;
				const notes = [t.phone && `☎ ${t.phone}`, t["addr:street"] && `${t["addr:housenumber"] || ""} ${t["addr:street"]}`.trim(), t.opening_hours,
					t.drinking_water && `drinking_water=${t.drinking_water}`, t.emergency === "yes" && "ER", t.well_depth_ft && `depth ${t.well_depth_ft} ft`,
					t.usgs_url && `[USGS](${t.usgs_url})`].filter(Boolean).join(" · ").replace(/\|/g, "/");
				L.push(`| ${n} | ${f.name.replace(/\|/g, "/")} | ${f.kind} | ${mi} mi ${bearing(s.lat!, s.lon!, f.lat, f.lon)} | [${fmtCoord(f.lat, f.lon)}](geo:${f.lat},${f.lon}) | ${notes} |`);
			}
			L.push("");
		}
		L.push("*Data © OpenStreetMap contributors (ODbL); USGS Water Data for the Nation (public domain).*");
		await writeText(this.app, `${s.folder}/Local Resources.md`, L.join("\n"));
	}

	private async writeWaypoints() {
		const s = this.settings;
		if (!s.waypoints.length && !this.app.vault.getAbstractFileByPath(`${s.folder}/My Waypoints.md`)) return;
		const L = ["---", "tags: [prepper/waypoints]", `updated: ${today()}`, "---", "# ⭐ My Waypoints",
			"Add or delete waypoints on the offline map (long-press / right-click → ⭐ Waypoint). Detailed map tiles are downloaded around each one on the next map refresh.", "",
			"| Name | Distance from home | Coordinates | Note | Added |", "|---|---|---|---|---|"];
		for (const w of s.waypoints) {
			const d = this.hasLocation() ? `${(haversineKm(s.lat!, s.lon!, w.lat, w.lon) * 0.621371).toFixed(2)} mi ${bearing(s.lat!, s.lon!, w.lat, w.lon)}` : "";
			L.push(`| ${w.name.replace(/\|/g, "/")} | ${d} | [${fmtCoord(w.lat, w.lon)}](geo:${w.lat},${w.lon}) | ${(w.note || "").replace(/\|/g, "/")} | ${w.created} |`);
		}
		await writeText(this.app, `${s.folder}/My Waypoints.md`, L.join("\n"));
	}

	private async writeMapsNote(maps: MapImage[]) {
		const s = this.settings;
		const est = estimate(s.lat!, s.lon!, this.cachePlan(), this.sources().length);
		const L: string[] = ["---", "tags: [prepper/maps]", `updated: ${today()}`, "---", "# 🗺️ Offline Maps"];
		L.push("**Open the interactive map:** 🗺️ ribbon icon, or command palette → *Prepper: Open offline map*.", "");
		L.push(`- Overview: ${s.mapRadiusKm} km (${(s.mapRadiusKm * 0.621371).toFixed(0)} mi) around home, zoom ${s.overviewMinZoom}–${s.overviewMaxZoom}`);
		L.push(`- Street/trail detail: ${s.detailRadiusKm} km (${(s.detailRadiusKm * 0.621371).toFixed(1)} mi) around home and 2 km around each waypoint, up to zoom ${s.detailMaxZoom}`);
		L.push(`- Approx. ${est.tiles.toLocaleString()} tiles (~${est.mb} MB), stored in \`${s.folder}/.tiles\``, "");
		L.push("> [!tip] Using the map", "> - **Long-press / right-click** anywhere: distance & direction from home, set home, save a ⭐ waypoint, copy coordinates.",
			"> - **📍** shows your live GPS position — works with no signal on phones/tablets.", "> - **💧** finds the nearest water to the map center.",
			"> - Layers button (top-right): switch topo ↔ satellite, toggle water/medical/shelter/supply markers.",
			"> - Past the downloaded zoom, the map shows enlarged lower-zoom tiles instead of going blank. When online, anything you browse is cached automatically.", "");
		if (maps.length) {
			L.push("## Printable map images");
			for (const m of maps) L.push(`### ${m.source.name.split(" (")[0]} — zoom ${m.zoom}`, `![[${m.path}]]`, "");
		}
		await writeText(this.app, `${s.folder}/Offline Maps.md`, L.join("\n"));
	}

	private async writeHome() {
		const s = this.settings;
		const f = s.folder;
		const L = ["---", "tags: [prepper/index]", `location: "${s.label}"`, `lat: ${s.lat}`, `lon: ${s.lon}`, `updated: ${today()}`, "---",
			"# 🏕️ Prepper Field Guide",
			`📍 **${s.matched || s.label || "Home"}** — ${fmtCoord(s.lat!, s.lon!)}`, "",
			"> [!danger] Emergency numbers",
			"> **911** · **Poison Control 1-800-222-1222** · Text **911** where supported", "",
			"## Local", `- [[${f}/Offline Maps|🗺️ Offline maps]] (ribbon 🗺️ opens the interactive map)`, `- [[${f}/My Waypoints|⭐ My waypoints]]`, `- [[${f}/Local Resources|💧 Water sources & emergency resources]]`,
			`- [[${f}/Plants/Plants Index|🌿 Local edible & poisonous plants]]`, `- [[${f}/Plants/Medicinal/Medicinal Plants Index|🩹 Local medicinal plants]]`, `- [[${f}/Weather & Hazards|⛈️ Weather & hazards]]`, `- [[${f}/Almanac|📅 Almanac — frost dates, what to expect, planting calendar]]`, "",
			"## Supplies & plan", `- [[${f}/Pantry Plan|🥫 Pantry plan]]`, `- [[${f}/Family Emergency Plan|👨‍👩‍👧‍👦 Family emergency plan]]`, "",
			"## Guides", ...Object.keys(GUIDES).map((g) => `- [[${f}/Guides/${g}|${g}]]`), "",
			"## My notes", "- Family meeting place (local): ", "- Family meeting place (out of town): ", "- Out-of-state contact: ", "- Water stored: ", "- Food stored (days): ", "",
			`*Generated by Prepper Field Guide on ${today()}. Re-run "Prepper: Build / refresh entire field guide" to update.*`];
		const path = `${f}/Prepper Home.md`;
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing) {
			// keep the user's "My notes" section
			const old = await this.app.vault.adapter.read(path);
			const mine = old.match(/## My notes\n([\s\S]*?)\n\n\*Generated/);
			if (mine) { const i = L.indexOf("## My notes"); L.splice(i + 1, 5, ...mine[1].split("\n")); }
		}
		await writeText(this.app, path, L.join("\n"));
	}
}

class LocationModal extends Modal {
	private value = "";
	private resolved = false;
	constructor(app: App, private onDone: (g: GeoResult | null, pickOnMap: boolean) => void) { super(app); }
	private finish(g: GeoResult | null, pick = false) { if (!this.resolved) { this.resolved = true; this.onDone(g, pick); } this.close(); }

	onOpen() { this.askStep(); }

	private askStep() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "📍 Where is home base?" });
		contentEl.createEl("p", { text: "Enter your full street address so water sources and resources are measured from your actual door — not the town center." });
		const status = contentEl.createEl("p", { cls: "prepper-status" });
		const go = async () => {
			if (!this.value.trim()) return;
			status.setText("Looking up…");
			try { this.confirmStep(await geocode(this.value)); } catch (e) { status.setText(String(e instanceof Error ? e.message : e)); }
		};
		new Setting(contentEl).setName("Street address").setDesc('e.g. "123 Main St, Guyton, GA 31312". Coordinates like "32.3105, -81.3912" also work.')
			.addText((t) => {
				t.setPlaceholder("123 Main St, Town, ST 12345").setValue(this.value).onChange((v) => (this.value = v));
				t.inputEl.style.width = "100%";
				t.inputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
				setTimeout(() => t.inputEl.focus(), 50);
			});
		new Setting(contentEl)
			.addButton((b) => b.setButtonText("🗺️ Pick on map").onClick(() => this.finish(null, true)))
			.addButton((b) => b.setButtonText("📡 Use device GPS").onClick(async () => {
				status.setText("Getting device location… (stand outside for best accuracy)");
				try { this.confirmStep(await deviceLocation()); } catch (e) { status.setText(String(e instanceof Error ? e.message : e)); }
			}))
			.addButton((b) => b.setButtonText("Look up").setCta().onClick(go));
		contentEl.createEl("small", { text: "Your address is sent only to the US Census Bureau geocoder (or OpenStreetMap Nominatim as a fallback). Only coordinates are stored." });
	}

	private confirmStep(g: GeoResult) {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Is this right?" });
		const card = contentEl.createDiv({ cls: "prepper-match" });
		card.createEl("div", { text: g.matched || g.label, cls: "prepper-match-addr" });
		card.createEl("div", { text: `${fmtCoord(g.lat, g.lon)} · via ${g.source}` });
		const msg: Record<string, [string, string]> = {
			exact: ["✅ Address-level match", "prepper-ok"],
			street: ["⚠️ Street-level only — your house number wasn't found, so this point is somewhere on your street. Fine-tune it on the map.", "prepper-warn"],
			area: ["⛔ Town/ZIP-level only — distances to water would be measured from the town center and could be miles off. Pick your spot on the map instead.", "prepper-warn"],
		};
		card.createEl("div", { text: msg[g.precision][0], cls: msg[g.precision][1] });
		new Setting(contentEl)
			.addButton((b) => b.setButtonText("← Back").onClick(() => this.askStep()))
			.addButton((b) => { b.setButtonText("🗺️ Fine-tune on map").onClick(() => this.finish(g, true)); if (g.precision !== "exact") b.setCta(); })
			.addButton((b) => { b.setButtonText("Use this location").onClick(() => this.finish(g)); if (g.precision === "exact") b.setCta(); });
	}
	onClose() { this.contentEl.empty(); if (!this.resolved) { this.resolved = true; this.onDone(null, false); } }
}

class ConfirmModal extends Modal {
	constructor(app: App, private title: string, private body: string, private onYes: () => void) { super(app); }
	onOpen() {
		this.titleEl.setText(this.title);
		this.contentEl.createEl("p", { text: this.body });
		new Setting(this.contentEl)
			.addButton((b) => b.setButtonText("Later").onClick(() => this.close()))
			.addButton((b) => b.setButtonText("Update now").setCta().onClick(() => { this.close(); this.onYes(); }));
	}
	onClose() { this.contentEl.empty(); }
}

class ProModal extends Modal {
	constructor(app: App, private plugin: PrepperPlugin, private feature?: string) { super(app); }
	onOpen() {
		const { contentEl } = this;
		const lic = this.plugin.license();
		this.titleEl.setText(lic ? "⭐ Prepper Field Guide Pro" : `⭐ ${this.feature ? `${this.feature} is a Pro feature` : "Upgrade to Pro"}`);
		if (lic) {
			contentEl.createEl("p", { text: `Licensed to ${lic.name} · issued ${lic.issued}. Thank you for supporting the plugin!` });
		} else {
			contentEl.createEl("p", { text: `One-time purchase (${PRICE}). No subscription, no account, and the license works fully offline — forever.` });
			const ul = contentEl.createEl("ul");
			for (const f of [
				"📅 Local almanac — 30-year frost dates, monthly normals & records, what to prepare for each month, NOAA seasonal outlook, planting calendar, sun & moon",
				"🩹 Medicinal plants guide — local species, honest evidence ratings, interactions, lookalikes, preparation guide",
				"🥫 Pantry planner — food, water & supply targets scaled to your household",
				"⭐ Map waypoints (caches, rally points) with detailed maps around each",
				"🗺️ Bigger offline maps — up to 100 km overview, 20 km at max detail",
				"🖨️ Printable map images",
			]) ul.createEl("li", { text: f });
			new Setting(contentEl).addButton((b) => b.setButtonText(`Buy Pro — ${PRICE}`).setCta().onClick(() => window.open(BUY_URL)));
		}
		let key = this.plugin.settings.licenseKey;
		const status = contentEl.createEl("p", { cls: "prepper-status" });
		new Setting(contentEl).setName("License key").setDesc("Paste the key from your purchase email (starts with PFG-).")
			.addText((t) => { t.setPlaceholder("PFG-…").setValue(key).onChange((v) => (key = v.trim())); t.inputEl.style.width = "100%"; })
			.addButton((b) => b.setButtonText("Activate").setCta().onClick(async () => {
				const l = verifyLicense(key);
				if (!l) { status.setText("❌ That key isn't valid. Check for missing characters."); return; }
				this.plugin.settings.licenseKey = key;
				await this.plugin.saveSettings();
				new Notice(`⭐ Pro unlocked — thanks, ${l.name.split(" <")[0]}!`);
				this.close();
				new ConfirmModal(this.app, "Build the Pro sections now?", "Adds the almanac, medicinal plants guide and pantry plan, and expands your offline maps.", () => this.plugin.buildAll()).open();
			}));
	}
	onClose() { this.contentEl.empty(); }
}

class ProgressModal extends Modal {
	private logEl!: HTMLElement;
	onOpen() {
		this.titleEl.setText("🏕️ Building your field guide…");
		this.contentEl.createEl("p", { text: "This can take a few minutes. You can close this window — work continues in the background." });
		this.logEl = this.contentEl.createEl("pre");
		Object.assign(this.logEl.style, { maxHeight: "50vh", overflowY: "auto", whiteSpace: "pre-wrap", fontSize: "12px" });
	}
	log(msg: string) {
		console.log("[prepper]", msg);
		if (!this.logEl) return;
		this.logEl.appendText(msg + "\n");
		this.logEl.scrollTop = this.logEl.scrollHeight;
	}
	done(errors: string[]) {
		this.titleEl.setText(errors.length ? "⚠️ Finished with some errors" : "✅ Field guide ready");
		this.log(errors.length ? `\n${errors.length} step(s) failed — the rest was saved. Re-run that step later.` : "\nDone. Everything is saved in your vault and works offline.");
		new Notice(errors.length ? "Prepper: finished with errors (see log)" : "Prepper: field guide ready ✅");
	}
}

class PrepperSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: PrepperPlugin) { super(app, plugin); }
	display() {
		const { containerEl } = this;
		const s = this.plugin.settings;
		const save = () => this.plugin.saveSettings();
		containerEl.empty();

		const lic = this.plugin.license();
		new Setting(containerEl).setName(lic ? "⭐ Pro unlocked" : "Free version")
			.setDesc(lic ? `Licensed to ${lic.name}` : `Pro (${PRICE}) adds the almanac, medicinal plants, pantry planner, waypoints, larger and printable maps.`)
			.addButton((b) => b.setButtonText(lic ? "License…" : "Upgrade / enter key").setCta().onClick(() => this.plugin.showPro()));

		containerEl.createEl("h3", { text: "Location" });
		new Setting(containerEl)
			.setName("Current location")
			.setDesc(this.plugin.hasLocation() ? `${s.matched || s.label} (${fmtCoord(s.lat!, s.lon!)})${s.precision === "area" ? " ⚠️ town-level only — pick your exact spot on the map" : ""}` : "Not set")
			.addButton((b) => b.setButtonText("Pick on map").onClick(() => this.plugin.openMap(true)))
			.addButton((b) => b.setButtonText("Change…").onClick(async () => { await this.plugin.promptLocation(); this.display(); }));
		new Setting(containerEl).setName("Vault folder").setDesc("Where everything is written.")
			.addText((t) => t.setValue(s.folder).onChange(async (v) => { s.folder = v.trim() || "Prepper"; await save(); }));

		containerEl.createEl("h3", { text: "What to build" });
		const toggle = (name: string, key: "doMaps" | "doResources" | "doPlants" | "doWeather" | "doGuides" | "doAlmanac" | "doPantry" | "doMedicinal", desc = "") =>
			new Setting(containerEl).setName(name).setDesc(desc).addToggle((t) => t.setValue(s[key]).onChange(async (v) => { s[key] = v; await save(); }));
		toggle("Offline maps", "doMaps", "Interactive pan/zoom topo + satellite map that works with no signal.");
		toggle("Water sources & emergency resources", "doResources", "Springs, wells, streams, hospitals, pharmacies, fire/police, shelters, fuel, hardware (OpenStreetMap + USGS).");
		toggle("Edible & poisonous plants", "doPlants", "Species observed near you (iNaturalist) matched against a curated edible/toxic list.");
		toggle("Weather & alerts", "doWeather", "US National Weather Service snapshot (US only).");
		toggle("⭐ Almanac (Pro)", "doAlmanac", "30-year local climate: frost dates, monthly normals & records, what to prepare for each month, 6-month outlook, planting calendar, sun & moon.");
		toggle("⭐ Pantry plan (Pro)", "doPantry", "Food, water & supply targets scaled to your household.");
		toggle("⭐ Medicinal plants (Pro)", "doMedicinal", "Local medicinal species with evidence ratings, cautions, lookalikes, and an herbal preparations guide.");
		toggle("Survival guides", "doGuides", "Water purification, foraging safety, fire, shelter & signaling, first aid, go-bag checklist, family emergency plan.");

		containerEl.createEl("h3", { text: "Maps" });
		if (!lic) containerEl.createEl("p", { cls: "setting-item-description", text: `Free version downloads ${FREE.overviewKm} km overview and ${FREE.detailKm} km of detail up to zoom ${FREE.maxZoom}. ⭐ Pro uses the full settings below.` });
		for (const src of TILE_SOURCES) {
			new Setting(containerEl).setName(src.name).addToggle((t) => t.setValue(s.tileSources.includes(src.id)).onChange(async (v) => {
				s.tileSources = v ? [...new Set([...s.tileSources, src.id])] : s.tileSources.filter((x) => x !== src.id); await save();
			}));
		}
		new Setting(containerEl).setName("Custom tile source").setDesc("Optional XYZ URL with {z} {x} {y}. Only use a server whose terms allow downloading for offline use (the public OpenStreetMap tile server does NOT).")
			.addToggle((t) => t.setValue(s.tileSources.includes("custom")).onChange(async (v) => {
				s.tileSources = v ? [...new Set([...s.tileSources, "custom"])] : s.tileSources.filter((x) => x !== "custom"); await save();
			}))
			.addText((t) => t.setPlaceholder("https://example.com/{z}/{x}/{y}.png").setValue(s.customTileUrl).onChange(async (v) => { s.customTileUrl = v.trim(); await save(); }));
		new Setting(containerEl).setName("Custom tile attribution").addText((t) => t.setValue(s.customTileAttribution).onChange(async (v) => { s.customTileAttribution = v; await save(); }));
		const est = containerEl.createEl("p", { cls: "setting-item-description" });
		const updEst = () => {
			if (!this.plugin.hasLocation()) { est.setText("Set a location to see the download size."); return; }
			const e = estimate(s.lat!, s.lon!, this.plugin.cachePlan(), this.plugin.sources().length);
			est.setText(`Estimated offline map download: ~${e.tiles.toLocaleString()} tiles, ~${e.mb} MB (already-downloaded tiles are skipped).`);
		};
		const num = (name: string, desc: string, key: "mapRadiusKm" | "overviewMinZoom" | "overviewMaxZoom" | "detailRadiusKm" | "detailMaxZoom", min: number, max: number, step = 1) =>
			new Setting(containerEl).setName(name).setDesc(desc).addSlider((sl) => sl.setLimits(min, max, step).setValue(s[key]).setDynamicTooltip()
				.onChange(async (v) => { s[key] = v; await save(); updEst(); }));
		num("Overview radius (km)", "Area covered at overview zooms (25 km ≈ 15 mi).", "mapRadiusKm", 5, 100, 5);
		num("Overview zoom from", "8 = multi-county region.", "overviewMinZoom", 5, 11);
		num("Overview zoom to", "13 = town level, roads and streams visible.", "overviewMaxZoom", 10, 14);
		num("Detail radius (km)", "Area around home downloaded at full detail (5 km ≈ 3 mi). Waypoints get 2 km of detail each.", "detailRadiusKm", 1, 20);
		num("Detail max zoom", "15 = trails & buildings, 16 = maximum USGS detail.", "detailMaxZoom", 13, 16);
		containerEl.appendChild(est); updEst();
		new Setting(containerEl).setName("Fetch missing tiles when online").setDesc("While you have signal, any area you browse on the map is downloaded and cached.")
			.addToggle((t) => t.setValue(s.allowOnlineTiles).onChange(async (v) => { s.allowOnlineTiles = v; await save(); }));
		new Setting(containerEl).setName("⭐ Also make printable map images (Pro)").setDesc("Stitched JPGs with numbered markers, embedded in the Offline Maps note — for printing.")
			.addToggle((t) => t.setValue(s.printableMaps).onChange(async (v) => { s.printableMaps = v; await save(); }));
		new Setting(containerEl).setName("Printable zoom levels").setDesc("Comma-separated, e.g. 11,13,15.")
			.addText((t) => t.setValue(s.zooms).onChange(async (v) => { s.zooms = v; await save(); }));
		new Setting(containerEl).setName("Printable max tiles per side").setDesc("Caps printable image size (×256 px). Keep ≤16 on phones/tablets.")
			.addSlider((sl) => sl.setLimits(4, 32, 1).setValue(s.maxTilesPerSide).setDynamicTooltip().onChange(async (v) => { s.maxTilesPerSide = v; await save(); }));

		containerEl.createEl("h3", { text: "Resources" });
		new Setting(containerEl).setName("Resource search radius (km)")
			.addSlider((sl) => sl.setLimits(2, 50, 1).setValue(s.resourceRadiusKm).setDynamicTooltip().onChange(async (v) => { s.resourceRadiusKm = v; await save(); }));
		new Setting(containerEl).setName("Include USGS springs, wells & streams").setDesc("National water inventory — far more rural springs and wells than OpenStreetMap.")
			.addToggle((t) => t.setValue(s.useUsgsWater).onChange(async (v) => { s.useUsgsWater = v; await save(); }));
		new Setting(containerEl).setName("Max markers on printable maps")
			.addSlider((sl) => sl.setLimits(20, 400, 10).setValue(s.maxMarkers).setDynamicTooltip().onChange(async (v) => { s.maxMarkers = v; await save(); }));

		containerEl.createEl("h3", { text: "⭐ Household (pantry plan)" });
		const hh = (name: string, key: "adults" | "children" | "dogs" | "cats", max: number, desc = "") =>
			new Setting(containerEl).setName(name).setDesc(desc).addSlider((sl) => sl.setLimits(0, max, 1).setValue(s[key]).setDynamicTooltip().onChange(async (v) => { s[key] = v; await save(); }));
		hh("Adults (12+)", "adults", 12);
		hh("Children (under 12)", "children", 12, "Counted at 70% of an adult's food.");
		hh("Dogs", "dogs", 10); hh("Cats", "cats", 10);
		new Setting(containerEl).setName("Plan for how many days").addDropdown((d) => {
			for (const [v, l] of [["14", "2 weeks"], ["30", "1 month"], ["90", "3 months"], ["180", "6 months"], ["365", "1 year"]]) d.addOption(v, l);
			d.setValue(String(s.pantryDays)).onChange(async (v) => { s.pantryDays = parseInt(v); await save(); });
		});

		containerEl.createEl("h3", { text: "Plants" });
		new Setting(containerEl).setName("Plant search radius (km)")
			.addSlider((sl) => sl.setLimits(5, 100, 5).setValue(s.plantRadiusKm).setDynamicTooltip().onChange(async (v) => { s.plantRadiusKm = v; await save(); }));
		new Setting(containerEl).setName("Include dangerous mushrooms").setDesc("Danger list only — the plugin never recommends eating wild mushrooms.")
			.addToggle((t) => t.setValue(s.includeFungi).onChange(async (v) => { s.includeFungi = v; await save(); }));
		new Setting(containerEl).setName("Download plant photos").addToggle((t) => t.setValue(s.downloadPhotos).onChange(async (v) => { s.downloadPhotos = v; await save(); }));
		new Setting(containerEl).setName("Only openly-licensed photos").setDesc("Skip iNaturalist photos marked 'all rights reserved'.")
			.addToggle((t) => t.setValue(s.openLicensePhotosOnly).onChange(async (v) => { s.openLicensePhotosOnly = v; await save(); }));
	}
}
