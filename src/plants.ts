import { App } from "obsidian";
import { matchPlant, PLANT_DB, PlantInfo, Status } from "./plantdb";
import { fetchWithRetry, getJson, Logger, safeName, sleep, today, writeBinary, writeText } from "./util";

export interface Taxon {
	id: number; name: string; rank: string; preferred_common_name?: string;
	wikipedia_url?: string | null;
	default_photo?: { medium_url?: string; attribution?: string; license_code?: string | null } | null;
}
export interface SpeciesCount { count: number; taxon: Taxon }

export interface PlantJob {
	lat: number; lon: number; radiusKm: number; folder: string;
	includeFungi: boolean; openLicensePhotosOnly: boolean; downloadPhotos: boolean;
	log: Logger;
}

const STATUS_META: Record<Status, { label: string; callout: string; tag: string; dir: string; icon: string }> = {
	edible: { label: "Edible (with correct ID)", callout: "success", tag: "edible", dir: "Edible", icon: "🟢" },
	caution: { label: "Edible with serious cautions", callout: "warning", tag: "caution", dir: "Caution", icon: "🟡" },
	toxic: { label: "Toxic", callout: "danger", tag: "toxic", dir: "Toxic", icon: "🔴" },
	deadly: { label: "DEADLY", callout: "danger", tag: "deadly", dir: "Deadly", icon: "☠️" },
};

export async function speciesCounts(lat: number, lon: number, radiusKm: number, iconic: string, log: Logger): Promise<SpeciesCount[]> {
	const all: SpeciesCount[] = [];
	for (let page = 1; page <= 4; page++) {
		const url = `https://api.inaturalist.org/v1/observations/species_counts?lat=${lat}&lng=${lon}&radius=${radiusKm}` +
			`&iconic_taxa=${iconic}&quality_grade=research&per_page=500&page=${page}`;
		const res = await getJson<{ results: SpeciesCount[]; total_results: number }>(url);
		all.push(...res.results);
		log(`  iNaturalist ${iconic}: ${all.length}/${res.total_results} species`);
		if (all.length >= res.total_results || res.results.length < 500) break;
		await sleep(1100); // iNat asks for ≤ 1 req/sec
	}
	return all;
}

export async function wikiSummary(title: string): Promise<{ extract: string; url: string } | null> {
	try {
		const j = await getJson<any>(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
		if (j.type === "disambiguation" || !j.extract) return null;
		return { extract: j.extract, url: j.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}` };
	} catch { return null; }
}

function noteFor(p: PlantInfo, sc: SpeciesCount, photoPath: string | null, wiki: { extract: string; url: string } | null): string {
	const m = STATUS_META[p.status];
	const common = sc.taxon.preferred_common_name || p.common;
	const lines: string[] = [];
	lines.push("---");
	lines.push(`tags: [prepper/plant, prepper/${m.tag}${p.kingdom === "fungus" ? ", prepper/fungus" : ""}]`);
	lines.push(`status: ${p.status}`);
	lines.push(`scientific_name: "${sc.taxon.name}"`);
	lines.push(`common_name: "${common.replace(/"/g, "'")}"`);
	lines.push(`local_observations: ${sc.count}`);
	lines.push(`updated: ${today()}`);
	lines.push("---");
	lines.push(`# ${m.icon} ${common}`);
	lines.push(`*${sc.taxon.name}* — reference group: **${p.common}** (\`${p.key}\`)`);
	lines.push("");
	if (p.status === "edible" || p.status === "caution") {
		lines.push(`> [!${m.callout}] ${m.label}`);
		lines.push(`> Only eat after **positive identification** with at least two field guides or an experienced local forager. When in doubt, throw it out.`);
	} else {
		lines.push(`> [!danger] ${m.label}`);
		lines.push(`> Do not eat. Learn to recognize it. **Poison Control (US): 1-800-222-1222.** Call 911 for trouble breathing, seizures or unconsciousness.`);
	}
	lines.push("");
	if (photoPath) {
		lines.push(`![[${photoPath}|400]]`);
		lines.push(`*Photo: ${sc.taxon.default_photo?.attribution || "iNaturalist"} via iNaturalist*`);
		lines.push("");
	}
	lines.push(p.status === "edible" || p.status === "caution" ? "## How it's used" : "## Why it's dangerous");
	lines.push(p.use);
	if (p.warn) { lines.push("", "## ⚠️ Cautions", p.warn); }
	if (p.lookalikes) { lines.push("", "## Lookalikes", p.lookalikes); }
	lines.push("", "## Seen near you", `**${sc.count}** research-grade iNaturalist observations within the search radius.`);
	if (wiki) { lines.push("", "## Background (Wikipedia)", wiki.extract); }
	lines.push("", "## Links");
	lines.push(`- [iNaturalist taxon page](https://www.inaturalist.org/taxa/${sc.taxon.id})`);
	if (wiki) lines.push(`- [Wikipedia](${wiki.url})`);
	return lines.join("\n");
}

export interface PlantResult { indexPath: string; counts: Record<Status, number>; plantCounts: SpeciesCount[] }

export async function buildPlants(app: App, job: PlantJob): Promise<PlantResult> {
	const base = `${job.folder}/Plants`;
	job.log("Plants: querying iNaturalist for species observed near you…");
	const plants = await speciesCounts(job.lat, job.lon, job.radiusKm, "Plantae", job.log);
	let fungi: SpeciesCount[] = [];
	if (job.includeFungi) { await sleep(1100); fungi = await speciesCounts(job.lat, job.lon, job.radiusKm, "Fungi", job.log); }

	type Hit = { p: PlantInfo; sc: SpeciesCount; notePath: string };
	const hits: Hit[] = [];
	const matchedKeys = new Set<string>();
	const unmatched: SpeciesCount[] = [];
	for (const sc of [...plants, ...fungi]) {
		const p = matchPlant(sc.taxon.name);
		if (!p) { if (sc.taxon.rank === "species") unmatched.push(sc); continue; }
		if (p.kingdom === "fungus" && !job.includeFungi) continue;
		matchedKeys.add(p.key);
		const name = safeName(`${sc.taxon.preferred_common_name || p.common} (${sc.taxon.name})`);
		hits.push({ p, sc, notePath: `${base}/${STATUS_META[p.status].dir}/${name}.md` });
	}
	job.log(`Plants: ${hits.length} local species match the edible/toxic reference list. Writing notes…`);

	let i = 0;
	for (const h of hits) {
		i++;
		let photoPath: string | null = null;
		const ph = h.sc.taxon.default_photo;
		const licensed = !!ph?.license_code;
		if (job.downloadPhotos && ph?.medium_url && (licensed || !job.openLicensePhotosOnly)) {
			try {
				const res = await fetchWithRetry({ url: ph.medium_url }, 2);
				const ext = ph.medium_url.match(/\.(jpe?g|png)/i)?.[1] || "jpg";
				photoPath = `${base}/_photos/${h.sc.taxon.id}.${ext}`;
				await writeBinary(app, photoPath, res.arrayBuffer);
			} catch { photoPath = null; }
		}
		const wiki = await wikiSummary(h.sc.taxon.name);
		await writeText(app, h.notePath, noteFor(h.p, h.sc, photoPath, wiki));
		if (i % 10 === 0) job.log(`  …${i}/${hits.length} plant notes`);
		await sleep(150);
	}

	// ---- Index note ----
	const counts: Record<Status, number> = { edible: 0, caution: 0, toxic: 0, deadly: 0 };
	hits.forEach((h) => counts[h.p.status]++);
	const L: string[] = [];
	L.push("---", "tags: [prepper/index]", `updated: ${today()}`, "---");
	L.push("# 🌿 Local Edible & Poisonous Plants");
	L.push(`Species observed within **${job.radiusKm} km** of your location (research-grade iNaturalist records), cross-referenced with a curated list of well-known edible and dangerous species.`);
	L.push("");
	L.push("> [!warning] Read first");
	L.push("> - **Never eat a wild plant or mushroom you haven't positively identified** — use two independent field guides and, ideally, an experienced local forager.");
	L.push("> - Learn the **deadly** plants before the edible ones.");
	L.push("> - Avoid plants near roads, rail lines, power-line cuts, lawns and farm fields (herbicides, lead, runoff).");
	L.push("> - Try a small amount of any new food first; some people react to otherwise-edible plants.");
	L.push("> - This list is incomplete. A plant not listed here is **unknown**, not safe.");
	L.push("> - **Poison Control (US): 1-800-222-1222**");
	L.push("");
	const order: Status[] = ["deadly", "toxic", "caution", "edible"];
	for (const s of order) {
		const group = hits.filter((h) => h.p.status === s).sort((a, b) => b.sc.count - a.sc.count);
		if (!group.length) continue;
		const m = STATUS_META[s];
		L.push(`## ${m.icon} ${m.label} (${group.length})`);
		L.push("| Plant | Scientific name | Local obs. | Key point |", "|---|---|---|---|");
		for (const h of group) {
			const link = h.notePath.replace(/\.md$/, "");
			const key = h.p.use.split(/(?<=\.)\s/)[0].replace(/\|/g, "/");
			L.push(`| [[${link}\\|${h.sc.taxon.preferred_common_name || h.p.common}]] | *${h.sc.taxon.name}* | ${h.sc.count} | ${key} |`);
		}
		L.push("");
	}
	const notSeenDeadly = PLANT_DB.filter((p) => (p.status === "deadly" || p.status === "toxic") && !matchedKeys.has(p.key) && (job.includeFungi || p.kingdom !== "fungus"));
	if (notSeenDeadly.length) {
		L.push("## Not recorded nearby — but still worth recognizing");
		L.push("Absence on iNaturalist doesn't mean absence in the field.");
		for (const p of notSeenDeadly) L.push(`- ${STATUS_META[p.status].icon} **${p.common}** (*${p.key}*) — ${p.use.split(/(?<=\.)\s/)[0]}`);
		L.push("");
	}
	L.push("## Other common plants near you (not on the reference list)");
	L.push("Unknown status — research each one before considering it. Most-observed first.");
	L.push("| Common name | Scientific name | Obs. |", "|---|---|---|");
	unmatched.slice(0, 75).forEach((sc) => L.push(`| ${sc.taxon.preferred_common_name || "—"} | [*${sc.taxon.name}*](https://www.inaturalist.org/taxa/${sc.taxon.id}) | ${sc.count} |`));
	L.push("", "*Data: iNaturalist (research-grade observations), Wikipedia. Photos © their owners under the license shown on each note.*");
	const indexPath = `${base}/Plants Index.md`;
	await writeText(app, indexPath, L.join("\n"));
	return { indexPath, counts, plantCounts: plants };
}
