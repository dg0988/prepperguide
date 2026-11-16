import { App } from "obsidian";
import { SpeciesCount, speciesCounts, wikiSummary } from "./plants";
import { fetchWithRetry, Logger, safeName, sleep, today, writeBinary, writeText } from "./util";

/**
 * Medicinal plant reference (North America). Deliberately conservative:
 *  - evidence is labeled honestly (most herbal uses are traditional, not proven)
 *  - interactions, pregnancy/children cautions and deadly lookalikes are front and center
 *  - no per-herb dosing; general preparation methods live in the "Herbal Preparations" guide
 */
export type MedStatus = "useful" | "caution" | "avoid";
export type Evidence = "good" | "some" | "traditional";

export interface MedInfo {
	key: string; common: string; status: MedStatus; evidence: Evidence;
	uses: string;       // traditional / studied uses
	prep: string;       // how it's traditionally prepared (method only)
	cautions: string;   // who shouldn't, interactions
	lookalikes?: string;
}

export const MED_DB: MedInfo[] = [
	// ----- First aid & skin -----
	{ key: "Plantago", common: "Plantain (broadleaf / narrowleaf)", status: "useful", evidence: "some",
		uses: "Stings, insect bites, minor scrapes, splinters ('drawing'), mild skin irritation. Leaves contain aucubin and allantoin, which have anti-inflammatory and skin-healing activity in lab studies.",
		prep: "Fresh-leaf poultice (crush or chew, apply, cover); infused oil or salve.",
		cautions: "Generally very safe topically. Clean wounds first — a poultice is not a substitute for cleaning or antibiotics." },
	{ key: "Achillea millefolium", common: "Yarrow", status: "useful", evidence: "traditional",
		uses: "Classic battlefield styptic — powdered/crushed leaf pressed into minor cuts to slow bleeding. Tea traditionally used for fevers and colds.",
		prep: "Crushed fresh or powdered dried leaf on minor cuts; infusion (tea) of leaves and flowers.",
		cautions: "Avoid in pregnancy. Ragweed/daisy-family (Asteraceae) allergy. May increase sun sensitivity. Not for serious bleeding — use pressure and a tourniquet.",
		lookalikes: "⚠️ POISON HEMLOCK and WATER HEMLOCK (deadly) also have white flat-topped flower clusters and lacy leaves. Yarrow's leaves are feathery and finely divided along a single stem ('thousand-leaf'), flowers are tiny daisies (not umbels), stems are fuzzy and not purple-blotched. Crushed yarrow smells pleasantly aromatic." },
	{ key: "Hamamelis virginiana", common: "Witch hazel", status: "useful", evidence: "some",
		uses: "Astringent for minor skin inflammation, bruises, insect bites, hemorrhoids. Tannins tighten tissue; topical use is reasonably supported.",
		prep: "Decoction of bark/twigs used as a wash or compress (external use).",
		cautions: "External use. Large internal doses of tannins upset the stomach." },
	{ key: "Impatiens capensis", common: "Jewelweed (spotted touch-me-not)", status: "useful", evidence: "traditional",
		uses: "Folk remedy for poison ivy and nettle stings — often grows right beside them. Studies suggest it works about as well as washing with soap (which is the real key: remove the oil fast).",
		prep: "Crush the juicy stem and rub on skin right after exposure; can be frozen in ice cubes.",
		cautions: "Topical only. Wash with soap and cool water first." },
	{ key: "Quercus", common: "Oak (bark)", status: "useful", evidence: "traditional",
		uses: "Strong tannin astringent — wash for weeping skin rashes and minor wounds; traditionally a tea for diarrhea.",
		prep: "Decoction of inner bark used as a wash or compress.",
		cautions: "Internal use only short-term; tannins irritate the stomach and reduce iron absorption. Avoid on large damaged skin areas." },
	{ key: "Pinus", common: "Pine (resin & needles)", status: "useful", evidence: "traditional",
		uses: "Resin ('pitch') used as an antiseptic wound sealant and drawing salve; needle tea is a source of vitamin C and a decongestant steam.",
		prep: "Melt resin into oil + beeswax for salve; steep chopped needles (not boiled hard) for tea.",
		cautions: "Avoid needle tea in pregnancy (especially Ponderosa pine). Resin allergy possible.",
		lookalikes: "YEW (Taxus, deadly) — flat needles, red berries, no cones. Pines have needles in bundles of 2–5." },
	{ key: "Prunella vulgaris", common: "Self-heal (heal-all)", status: "useful", evidence: "traditional",
		uses: "Traditional wound herb and gargle for sore throat and mouth sores; lab studies show antiviral/anti-inflammatory compounds.",
		prep: "Poultice of fresh leaves; infusion as a gargle or tea.",
		cautions: "Generally regarded as safe; limited human data." },

	// ----- Pain, fever, colds -----
	{ key: "Salix", common: "Willow (bark)", status: "caution", evidence: "some",
		uses: "Natural source of salicin (the original aspirin precursor). Clinical trials support willow bark for low-back pain and arthritis pain; also fever.",
		prep: "Decoction of inner bark from young branches.",
		cautions: "Same cautions as aspirin: NOT for children or teens (Reye's syndrome risk), aspirin allergy, stomach ulcers, bleeding disorders, blood thinners, pregnancy, before surgery. Slower onset than pills." },
	{ key: "Sambucus", common: "Elderberry / elderflower", status: "caution", evidence: "some",
		uses: "Cold and flu symptoms — some small trials found shorter flu duration with elderberry extract; evidence is mixed. Flowers traditionally for fever (sweating) teas.",
		prep: "Syrup from fully ripe, COOKED berries (stems removed); infusion of dried flowers.",
		cautions: "Raw berries, unripe berries, stems, leaves and bark cause vomiting (cyanogenic compounds) — always cook ripe berries. May stimulate the immune system (autoimmune disease, immunosuppressants).",
		lookalikes: "White flower clusters resemble WATER HEMLOCK / POISON HEMLOCK (deadly). Elder is a woody shrub; hemlocks are herbaceous." },
	{ key: "Echinacea", common: "Echinacea (purple coneflower)", status: "useful", evidence: "some",
		uses: "Taken at the first sign of a cold; reviews show a small possible benefit in preventing or shortening colds — results vary by product and species.",
		prep: "Root and aerial parts as tea or tincture.",
		cautions: "Daisy-family allergy; autoimmune disease; may interact with immunosuppressants. Mostly cultivated — don't dig wild stands (several species are at risk)." },
	{ key: "Monarda", common: "Bee balm / wild bergamot", status: "useful", evidence: "traditional",
		uses: "Rich in thymol (the antiseptic in thyme and mouthwash). Tea for colds, sore throat and digestion; steam for congestion; poultice for minor infections and stings.",
		prep: "Infusion of leaves and flowers; strong infusion as gargle or wash.",
		cautions: "Avoid medicinal amounts in pregnancy. Can irritate sensitive skin." },
	{ key: "Verbascum thapsus", common: "Common mullein", status: "useful", evidence: "traditional",
		uses: "Leaf tea for dry coughs and chest congestion (soothing mucilage, mild expectorant).",
		prep: "Infusion of dried leaves — strain through cloth or a coffee filter to remove irritating hairs.",
		cautions: "Seeds are toxic (fish poison) — use leaves/flowers only. Limited human data." },
	{ key: "Ulmus rubra", common: "Slippery elm (inner bark)", status: "useful", evidence: "traditional",
		uses: "Mucilage soothes sore throats, coughs and an irritated gut; historically also a survival gruel.",
		prep: "Powdered inner bark stirred into water as a gruel or lozenge.",
		cautions: "Coats the gut and can slow absorption of other medicines — take 2 hours apart. Stripping bark kills trees; take from fallen limbs." },
	{ key: "Ilex vomitoria", common: "Yaupon holly (leaves)", status: "useful", evidence: "some",
		uses: "North America's only native caffeinated plant — a coffee/tea substitute when supplies run out (avoids caffeine-withdrawal headaches).",
		prep: "Dry or lightly roast leaves, then steep like tea.",
		cautions: "BERRIES ARE TOXIC — leaves only. Normal caffeine cautions (pregnancy, heart rhythm, sleep). Despite the name, properly brewed tea doesn't cause vomiting." },

	// ----- Digestion -----
	{ key: "Mentha", common: "Wild mints", status: "useful", evidence: "good",
		uses: "Peppermint oil has good clinical evidence for irritable bowel symptoms; mint tea is widely used for nausea, gas and indigestion.",
		prep: "Infusion of fresh or dried leaves.",
		cautions: "Can worsen heartburn/reflux. Avoid applying mint oil near the face of infants.",
		lookalikes: "⚠️ PENNYROYAL (Mentha pulegium / Hedeoma) is a mint that has caused fatal liver failure when taken concentrated — never use pennyroyal internally." },
	{ key: "Matricaria", common: "Chamomile / pineappleweed", status: "useful", evidence: "some",
		uses: "Calming tea for mild anxiety, sleep and upset stomach; some trials support mild anxiety benefits. Pineappleweed (M. discoidea) is a common wild relative used the same way.",
		prep: "Infusion of flower heads.",
		cautions: "Ragweed/daisy-family allergy. May add to sedative medications and blood thinners." },
	{ key: "Rubus", common: "Blackberry / raspberry (leaves & root)", status: "useful", evidence: "traditional",
		uses: "Astringent leaf/root tea traditionally used for diarrhea and sore throat — a useful remedy when diarrhea threatens dehydration (alongside oral rehydration).",
		prep: "Infusion of DRIED leaves (wilted leaves can ferment); decoction of root.",
		cautions: "Raspberry leaf is traditionally used late in pregnancy — consult a midwife/doctor first." },
	{ key: "Taraxacum", common: "Dandelion", status: "useful", evidence: "traditional",
		uses: "Leaf is a mild diuretic and bitter digestive; root traditionally for liver and digestion. Very nutritious food plant.",
		prep: "Leaf infusion; roasted root decoction.",
		cautions: "Latex/daisy-family allergy. Diuretic effect — caution with lithium, diuretics, potassium-sparing drugs." },

	// ----- Nerves, sleep, mood -----
	{ key: "Passiflora incarnata", common: "Maypop (passionflower)", status: "caution", evidence: "some",
		uses: "Mild anxiety and sleep — small trials show modest calming effects.",
		prep: "Infusion of dried leaves and flowers.",
		cautions: "Sedating — don't combine with alcohol, sleep meds or benzodiazepines, or before driving. Avoid in pregnancy." },
	{ key: "Hypericum perforatum", common: "St. John's wort", status: "caution", evidence: "good",
		uses: "Good evidence for mild-to-moderate depression; infused oil traditionally for nerve pain and minor burns.",
		prep: "Infusion or tincture of flowering tops; flowers infused in oil (turns red) for topical use.",
		cautions: "⚠️ MAJOR DRUG INTERACTIONS: makes birth control, antidepressants (serotonin syndrome risk), blood thinners, HIV drugs, transplant drugs, heart and seizure medicines fail or misbehave. Causes sun sensitivity. Don't use if you take ANY prescription medicine without a doctor." },
	{ key: "Urtica dioica", common: "Stinging nettle", status: "useful", evidence: "some",
		uses: "Seasonal allergies (some small trials), joint pain (traditional 'urtication'), enlarged prostate symptoms (root). Extremely nutritious food plant.",
		prep: "Leaf infusion or cooked greens; root decoction.",
		cautions: "Mild diuretic; may affect blood sugar and blood pressure medications. Gloves to harvest." },

	// ----- Urinary -----
	{ key: "Solidago", common: "Goldenrod", status: "useful", evidence: "some",
		uses: "Traditional and European-approved herbal adjunct for urinary tract irritation; anti-inflammatory. (It does NOT cause hay fever — ragweed does.)",
		prep: "Infusion of flowering tops.",
		cautions: "Daisy-family allergy; avoid with heart or kidney disease requiring fluid restriction. A real UTI with fever or back pain needs antibiotics." },

	// ----- Historically used but DANGEROUS — know them, don't use them -----
	{ key: "Sassafras albidum", common: "Sassafras", status: "avoid", evidence: "traditional",
		uses: "Historic root-beer and spring tonic tea.",
		prep: "—",
		cautions: "Root bark contains safrole, a liver toxin and carcinogen banned as a food additive by the FDA. Not recommended." },
	{ key: "Symphytum", common: "Comfrey", status: "avoid", evidence: "some",
		uses: "'Knitbone' — topical creams have evidence for sprains and bruises.",
		prep: "Topical only, short-term, on unbroken skin.",
		cautions: "Contains pyrrolizidine alkaloids that cause serious liver damage when eaten. NEVER take internally; don't use on open wounds, in pregnancy or on children." },
	{ key: "Hedeoma pulegioides", common: "American pennyroyal", status: "avoid", evidence: "traditional",
		uses: "Historic insect repellent and folk abortifacient.",
		prep: "—",
		cautions: "Pennyroyal oil and strong tea have caused liver failure and death. Do not ingest." },
	{ key: "Mentha pulegium", common: "European pennyroyal", status: "avoid", evidence: "traditional",
		uses: "Historic insect repellent.", prep: "—",
		cautions: "Toxic to the liver; deaths reported. Do not ingest." },
	{ key: "Lobelia inflata", common: "Indian tobacco (lobelia)", status: "avoid", evidence: "traditional",
		uses: "Historic asthma and emetic remedy.", prep: "—",
		cautions: "Narrow margin between dose and poisoning — vomiting, rapid heartbeat, coma. Not for home use." },
	{ key: "Eupatorium perfoliatum", common: "Boneset", status: "avoid", evidence: "traditional",
		uses: "Historic remedy for 'break-bone' fevers and flu.", prep: "—",
		cautions: "Fresh plant is toxic; contains liver-damaging pyrrolizidine alkaloids. Better options exist (willow, elder, yarrow)." },
	{ key: "Actaea racemosa", common: "Black cohosh", status: "avoid", evidence: "some",
		uses: "Menopause symptoms (mixed evidence).", prep: "—",
		cautions: "Rare but serious liver injury reported; not for pregnancy. Use only commercial products under medical advice." },
	{ key: "Hydrastis canadensis", common: "Goldenseal", status: "avoid", evidence: "traditional",
		uses: "Folk antimicrobial for mucous membranes.", prep: "—",
		cautions: "Interacts with many drugs (liver enzymes), not for pregnancy or newborns. Wild populations are threatened — don't harvest." },
	{ key: "Tussilago farfara", common: "Coltsfoot", status: "avoid", evidence: "traditional",
		uses: "Historic cough remedy.", prep: "—",
		cautions: "Contains liver-toxic pyrrolizidine alkaloids. Use mullein or slippery elm instead." },
];

export function matchMed(name: string): MedInfo | null {
	const parts = name.split(" ");
	const bin = parts.slice(0, 2).join(" ");
	return MED_DB.find((m) => m.key === bin) || MED_DB.find((m) => !m.key.includes(" ") && m.key === parts[0]) || null;
}

const STATUS = {
	useful: { icon: "🌿", label: "Useful (with normal precautions)", dir: "Useful", callout: "success" },
	caution: { icon: "⚠️", label: "Useful but significant cautions", dir: "Caution", callout: "warning" },
	avoid: { icon: "⛔", label: "Historically used — DON'T", dir: "Avoid", callout: "danger" },
} as const;
const EVIDENCE = { good: "🟢 Good clinical evidence", some: "🟡 Some/mixed evidence", traditional: "⚪ Traditional use only" } as const;

export interface MedJob { lat: number; lon: number; radiusKm: number; folder: string; downloadPhotos: boolean; openLicensePhotosOnly: boolean; log: Logger; counts?: SpeciesCount[] }

export async function buildMedicinal(app: App, job: MedJob): Promise<number> {
	const base = `${job.folder}/Plants/Medicinal`;
	const counts = job.counts ?? (await speciesCounts(job.lat, job.lon, job.radiusKm, "Plantae", job.log));
	const hits: { m: MedInfo; sc: SpeciesCount; path: string }[] = [];
	const seenKeys = new Set<string>();
	for (const sc of counts) {
		const m = matchMed(sc.taxon.name);
		if (!m) continue;
		seenKeys.add(m.key);
		hits.push({ m, sc, path: `${base}/${STATUS[m.status].dir}/${safeName(`${sc.taxon.preferred_common_name || m.common} (${sc.taxon.name})`)}.md` });
	}
	job.log(`Medicinal: ${hits.length} local species match the medicinal reference list. Writing notes…`);

	for (const h of hits) {
		const S = STATUS[h.m.status];
		let photo: string | null = null;
		const ph = h.sc.taxon.default_photo;
		if (job.downloadPhotos && ph?.medium_url && (ph.license_code || !job.openLicensePhotosOnly)) {
			const existing = `${job.folder}/Plants/_photos/${h.sc.taxon.id}.jpg`;
			try {
				if (!(await app.vault.adapter.exists(existing))) await writeBinary(app, existing, (await fetchWithRetry({ url: ph.medium_url }, 2)).arrayBuffer);
				photo = existing;
			} catch { photo = null; }
		}
		const wiki = await wikiSummary(h.sc.taxon.name);
		const common = h.sc.taxon.preferred_common_name || h.m.common;
		const L = ["---", `tags: [prepper/plant, prepper/medicinal, prepper/medicinal-${h.m.status}]`, `status: ${h.m.status}`, `evidence: ${h.m.evidence}`,
			`scientific_name: "${h.sc.taxon.name}"`, `local_observations: ${h.sc.count}`, `updated: ${today()}`, "---",
			`# ${S.icon} ${common}`, `*${h.sc.taxon.name}* — **${S.label}** · ${EVIDENCE[h.m.evidence]}`, ""];
		L.push(`> [!${S.callout}] Read before using`, "> Positive ID first. Not a substitute for medical care. Ask a doctor or pharmacist if you're pregnant, nursing, treating a child, or take **any** prescription medicine. See [[Herbal Preparations]].", "");
		if (photo) L.push(`![[${photo}|400]]`, `*Photo: ${ph?.attribution || "iNaturalist"} via iNaturalist*`, "");
		L.push("## Uses", h.m.uses, "");
		if (h.m.prep !== "—") L.push("## Traditional preparation", h.m.prep, "");
		L.push("## ⚠️ Cautions & interactions", h.m.cautions, "");
		if (h.m.lookalikes) L.push("## Lookalikes", h.m.lookalikes, "");
		L.push("## Seen near you", `**${h.sc.count}** research-grade iNaturalist observations within ${job.radiusKm} km.`, "");
		if (wiki) L.push("## Background (Wikipedia)", wiki.extract, "");
		L.push("## Links", `- [iNaturalist](https://www.inaturalist.org/taxa/${h.sc.taxon.id})`);
		if (wiki) L.push(`- [Wikipedia](${wiki.url})`);
		await writeText(app, h.path, L.join("\n"));
		await sleep(150);
	}

	// Index + symptom finder
	const I = ["---", "tags: [prepper/index, prepper/medicinal]", `updated: ${today()}`, "---", "# 🌿 Local Medicinal Plants"];
	I.push("> [!danger] Herbal medicine is a **backup**, not a replacement", "> Infections that spread (red streaks, fever), deep wounds, chest pain, trouble breathing, severe dehydration, and anything in infants need real medical care. Keep a stocked medicine cabinet ([[Pantry Plan]]) — herbs are what you use when it runs out or for minor problems.", "");
	I.push(`Species recorded within **${job.radiusKm} km** of you that match a curated list of North American medicinal plants. Evidence is rated honestly: most herbal uses are traditional and unproven. See [[Herbal Preparations]] for how teas, poultices and salves are made.`, "");
	for (const st of ["useful", "caution", "avoid"] as MedStatus[]) {
		const g = hits.filter((h) => h.m.status === st).sort((a, b) => b.sc.count - a.sc.count);
		if (!g.length) continue;
		const S = STATUS[st];
		I.push(`## ${S.icon} ${S.label} (${g.length})`, "| Plant | Used for | Evidence | Local obs. |", "|---|---|---|---|");
		for (const h of g) I.push(`| [[${h.path.replace(/\.md$/, "")}\\|${h.sc.taxon.preferred_common_name || h.m.common}]] | ${h.m.uses.split(/(?<=[.—])\s/)[0].replace(/\|/g, "/")} | ${EVIDENCE[h.m.evidence]} | ${h.sc.count} |`);
		I.push("");
	}
	const quick: [string, RegExp][] = [
		["Bleeding (minor cuts)", /styptic|bleeding/i], ["Stings, bites, poison ivy", /sting|bite|poison ivy/i], ["Wounds & skin", /wound|skin|scrape|bruise/i],
		["Pain & fever", /pain|fever/i], ["Colds, cough, sore throat", /cold|cough|throat|congestion/i], ["Stomach & diarrhea", /diarrh|nausea|digest|stomach|bowel/i],
		["Anxiety & sleep", /anxiety|sleep|calming|depression/i], ["Caffeine substitute", /caffein/i],
	];
	I.push("## 🩹 Quick finder (plants found near you)");
	for (const [label, re] of quick) {
		const names = hits.filter((h) => h.m.status !== "avoid" && re.test(h.m.uses)).map((h) => `[[${h.path.replace(/\.md$/, "")}\\|${h.sc.taxon.preferred_common_name || h.m.common}]]`);
		if (names.length) I.push(`- **${label}:** ${[...new Set(names)].join(", ")}`);
	}
	const notSeenAvoid = MED_DB.filter((m) => m.status === "avoid" && !seenKeys.has(m.key));
	if (notSeenAvoid.length) {
		I.push("", "## ⛔ Also avoid (not recorded nearby, but sold or recommended online)");
		for (const m of notSeenAvoid) I.push(`- **${m.common}** (*${m.key}*) — ${m.cautions.split(/(?<=\.)\s/)[0]}`);
	}
	I.push("", "*Plant records: iNaturalist. Evidence ratings summarize published reviews (e.g. NIH NCCIH herb fact sheets) at a general level. Not medical advice.*");
	await writeText(app, `${base}/Medicinal Plants Index.md`, I.join("\n"));
	await writeText(app, `${job.folder}/Guides/Herbal Preparations.md`, PREP_GUIDE);
	return hits.length;
}

const PREP_GUIDE = `---
tags: [prepper/guide, prepper/medicinal]
---
# 🫖 Herbal Preparations

> [!warning] General methods only
> Herb strength varies hugely by plant, season and part. Start low, use short-term, and stop at any reaction. Pregnant/nursing women, children, the elderly and anyone on prescription drugs: check with a doctor or pharmacist first. **Poison Control: 1-800-222-1222.**

## Infusion (tea) — leaves & flowers
Pour just-boiled water over the herb, cover (keeps aromatic oils in), steep 10–15 min, strain. Typical kitchen strength is about a heaping teaspoon of dried herb (or a tablespoon fresh) per cup.

## Decoction — roots, bark, seeds
Simmer chopped material in water, covered, 15–30 min, then strain. Used for willow bark, oak bark, dandelion root.

## Poultice
Crush, chop or chew fresh leaves into a pulp, apply directly to the clean skin, cover with cloth. Replace every few hours. (Plantain on a sting is the classic.)

## Compress
Soak a clean cloth in a strong infusion or decoction (warm or cool), wring out, hold on the area.

## Infused oil & salve
1. Fill a clean jar with **dried** herb (fresh herb adds water → mold), cover with olive oil.
2. Keep warm (sunny window 2–4 weeks, or a double boiler on the lowest heat for 2–3 hours).
3. Strain. For salve, warm the oil with beeswax (about 1 part wax to 4–5 parts oil), pour into tins.
Pine resin, plantain and St. John's wort are traditional salve herbs.

## Gargle & steam
- **Gargle:** strong infusion (bee balm, self-heal, sage), cooled, several times a day.
- **Steam:** herbs (pine needles, mint, bee balm) in a bowl of hot water, towel over head, breathe 5–10 min. Not for small children (scald risk).

## Storage
Dry herbs out of sun with good airflow until crisp; store in labeled, dated jars, dark and cool. Most dried leaves keep ~1 year, roots and bark ~2 years.

## When herbs are NOT enough — get real care
- Wound redness spreading, red streaks, pus, fever → antibiotics.
- Deep or gaping wounds, animal bites, puncture wounds → cleaning, possibly stitches and tetanus shot.
- Diarrhea with blood, high fever, or signs of dehydration in a child → urgent care.
- Chest pain, trouble breathing, confusion, allergic swelling → 911.
`;
