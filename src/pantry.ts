import { App, TFile } from "obsidian";
import { today, writeText } from "./util";

export interface Household { adults: number; children: number; days: number; dogs: number; cats: number }

type Unit = "lb" | "qt" | "gal" | "cans" | "jars" | "rolls" | "ea" | "doses";
interface Item { name: string; perAdultPerYear: number; unit: Unit; shelf: string; tip: string; calPerUnit?: number }
interface Group { title: string; intro?: string; items: Item[] }

/**
 * Baseline long-term storage amounts per adult per year follow the widely used
 * "basic food storage" planning numbers (grains 300 lb, legumes 60 lb, sugar 60 lb, powdered milk 16 lb,
 * oil 10 qt, salt 5 lb …) — roughly 2,000 kcal/day. Children under 12 are counted at 0.7.
 */
const GROUPS: Group[] = [
	{
		title: "🌾 Long-term staples (the calorie backbone)",
		intro: "Cheap, dense, 10–30 year shelf life when stored right: sealed buckets/Mylar + oxygen absorbers, cool and dark.",
		items: [
			{ name: "White rice", perAdultPerYear: 120, unit: "lb", shelf: "25–30 yr sealed", tip: "Not brown rice (oils go rancid in ~1 yr)", calPerUnit: 1650 },
			{ name: "Wheat berries or flour", perAdultPerYear: 90, unit: "lb", shelf: "Berries 25+ yr · flour 1–2 yr", tip: "Berries need a grain mill; flour is easier but rotate it", calPerUnit: 1500 },
			{ name: "Rolled oats", perAdultPerYear: 45, unit: "lb", shelf: "25+ yr sealed", tip: "Breakfast, baking, no-cook option", calPerUnit: 1720 },
			{ name: "Pasta", perAdultPerYear: 45, unit: "lb", shelf: "2+ yr box · 20+ yr sealed", tip: "Morale food — kids will eat it", calPerUnit: 1680 },
			{ name: "Dry beans, lentils, split peas", perAdultPerYear: 60, unit: "lb", shelf: "10–30 yr sealed", tip: "Rice + beans = complete protein. Old beans need longer cooking", calPerUnit: 1550 },
			{ name: "Sugar / honey", perAdultPerYear: 60, unit: "lb", shelf: "Indefinite", tip: "Honey also for wounds/sore throats (not for babies <1 yr)", calPerUnit: 1750 },
			{ name: "Powdered milk", perAdultPerYear: 16, unit: "lb", shelf: "20 yr (nonfat, sealed)", tip: "Whole-milk powder only ~2 yr", calPerUnit: 1630 },
			{ name: "Cooking oil / shortening", perAdultPerYear: 10, unit: "qt", shelf: "1–2 yr (shortening 5+ yr sealed)", tip: "Fats are the hardest calories to store — rotate", calPerUnit: 7700 },
			{ name: "Salt (iodized)", perAdultPerYear: 5, unit: "lb", shelf: "Indefinite", tip: "Plus extra non-iodized for curing/canning" },
			{ name: "Baking soda + baking powder", perAdultPerYear: 2, unit: "lb", shelf: "Soda indefinite · powder 1–2 yr", tip: "" },
			{ name: "Yeast", perAdultPerYear: 0.5, unit: "lb", shelf: "2 yr (freeze for longer)", tip: "Or keep a sourdough starter" },
			{ name: "Vinegar", perAdultPerYear: 0.5, unit: "gal", shelf: "Indefinite", tip: "Pickling, cleaning" },
		],
	},
	{
		title: "🥫 Everyday pantry (store what you eat, rotate first-in-first-out)",
		intro: "These cover the first weeks with zero cooking skill and keep meals normal for kids.",
		items: [
			{ name: "Canned meat & fish (chicken, tuna, SPAM, salmon)", perAdultPerYear: 52, unit: "cans", shelf: "2–5 yr", tip: "Protein is the usual gap", calPerUnit: 350 },
			{ name: "Canned vegetables", perAdultPerYear: 104, unit: "cans", shelf: "2–5 yr", tip: "Low-sodium if anyone has BP issues", calPerUnit: 150 },
			{ name: "Canned fruit / applesauce", perAdultPerYear: 52, unit: "cans", shelf: "1–2 yr", tip: "", calPerUnit: 300 },
			{ name: "Soups, stews, chili", perAdultPerYear: 52, unit: "cans", shelf: "2–5 yr", tip: "Heat-and-eat meals", calPerUnit: 400 },
			{ name: "Peanut butter", perAdultPerYear: 12, unit: "jars", shelf: "1–2 yr", tip: "≈2,800 kcal per 16 oz jar", calPerUnit: 2800 },
			{ name: "Crackers, granola bars, trail mix", perAdultPerYear: 20, unit: "lb", shelf: "6–12 mo", tip: "Grab-and-go / go-bag rotation", calPerUnit: 2000 },
			{ name: "Tomato sauce / paste", perAdultPerYear: 24, unit: "cans", shelf: "1–2 yr", tip: "Makes rice and beans edible for weeks", calPerUnit: 100 },
			{ name: "Bouillon, spices, hot sauce", perAdultPerYear: 1, unit: "ea", shelf: "2+ yr", tip: "Flavor fatigue is real — one kit per person" },
			{ name: "Coffee / tea / drink mix", perAdultPerYear: 1, unit: "ea", shelf: "2+ yr", tip: "Caffeine withdrawal in a crisis is miserable" },
			{ name: "Multivitamins", perAdultPerYear: 365, unit: "doses", shelf: "2 yr", tip: "Covers gaps in a rice-and-beans diet" },
		],
	},
	{
		title: "🧻 Household & hygiene",
		items: [
			{ name: "Toilet paper", perAdultPerYear: 52, unit: "rolls", shelf: "Indefinite", tip: "" },
			{ name: "Unscented bleach (6–8.25%)", perAdultPerYear: 2, unit: "gal", shelf: "~1 yr — rotate!", tip: "Water treatment + sanitation" },
			{ name: "Bar soap", perAdultPerYear: 12, unit: "ea", shelf: "Indefinite", tip: "" },
			{ name: "Trash bags (contractor)", perAdultPerYear: 52, unit: "ea", shelf: "Indefinite", tip: "Bucket toilet liners if plumbing fails" },
			{ name: "Feminine products", perAdultPerYear: 1, unit: "ea", shelf: "Indefinite", tip: "Year's supply per person who needs them" },
		],
	},
	{
		title: "💊 Medicine cabinet (per household)",
		intro: "Not scaled per person — one well-stocked kit. Talk to your doctor about extra prescription supply.",
		items: [
			{ name: "Pain/fever: ibuprofen + acetaminophen (adult & children's)", perAdultPerYear: 0, unit: "ea", shelf: "2–3 yr", tip: "Keep both kid formulations" },
			{ name: "Antihistamine (diphenhydramine, cetirizine)", perAdultPerYear: 0, unit: "ea", shelf: "2–3 yr", tip: "" },
			{ name: "Anti-diarrheal + oral rehydration salts", perAdultPerYear: 0, unit: "ea", shelf: "2–3 yr", tip: "Diarrhea dehydration kills in disasters" },
			{ name: "Antibiotic ointment, hydrocortisone, burn gel", perAdultPerYear: 0, unit: "ea", shelf: "2–3 yr", tip: "" },
			{ name: "Prescription meds — 90-day buffer", perAdultPerYear: 0, unit: "ea", shelf: "varies", tip: "Ask about 90-day fills" },
		],
	},
];

const qty = (n: number, unit: Unit) => {
	const v = n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
	return `${v} ${unit}`;
};

export async function buildPantry(app: App, folder: string, hh: Household): Promise<string> {
	const path = `${folder}/Pantry Plan.md`;
	const people = hh.adults + hh.children * 0.7;
	const scale = (people * hh.days) / 365;

	// Preserve what the user typed in the "Have" column
	const have: Record<string, string> = {};
	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) {
		for (const line of (await app.vault.read(existing)).split("\n")) {
			const c = line.split("|").map((x) => x.trim());
			if (c.length >= 5 && c[1] && c[3] && !c[1].startsWith("---") && c[1] !== "Item") have[c[1].replace(/^- \[.\] /, "")] = c[3];
		}
	}

	const L: string[] = ["---", "tags: [prepper/pantry, prepper/checklist]", `updated: ${today()}`,
		`household: "${hh.adults} adults, ${hh.children} children"`, `days: ${hh.days}`, "---", "# 🥫 Pantry Plan"];
	L.push(`Targets for **${hh.adults} adult${hh.adults === 1 ? "" : "s"}${hh.children ? ` + ${hh.children} child${hh.children === 1 ? "" : "ren"}` : ""}** for **${hh.days} days**. Change the household or duration in plugin settings and re-run — **anything you type in the “Have” column is kept.**`, "");

	let kcal = 0;
	for (const g of GROUPS) for (const it of g.items) if (it.calPerUnit) kcal += it.perAdultPerYear * it.calPerUnit;
	const perDay = Math.round(kcal / 365);
	L.push(`> [!info] Planning baseline ≈ **${perDay.toLocaleString()} kcal per adult per day** (children counted at 70%). Adjust for appetites, allergies and what your family actually eats — a stockpile nobody will eat isn't a stockpile.`, "");

	const water = Math.ceil((hh.adults + hh.children) * Math.min(hh.days, 14));
	L.push("## 💧 Water", `- Store at least **${water} gallons** (1 gal/person/day × ${Math.min(hh.days, 14)} days). Beyond 2 weeks, plan on **treating** water rather than storing it all — see [[Water Purification]] and your nearest sources in [[Local Resources]].`, `- Add for pets: ~1 qt/day per dog, ~1 cup/day per cat.`, "");

	for (const g of GROUPS) {
		L.push(`## ${g.title}`);
		if (g.intro) L.push(g.intro, "");
		L.push("| Item | Target | Have | Shelf life | Tip |", "|---|---|---|---|---|");
		for (const it of g.items) {
			const target = it.perAdultPerYear === 0 ? "household kit" : qty(it.perAdultPerYear * scale, it.unit);
			L.push(`| ${it.name} | ${target} | ${have[it.name] ?? ""} | ${it.shelf} | ${it.tip} |`);
		}
		L.push("");
	}

	if (hh.dogs || hh.cats) {
		L.push("## 🐾 Pets");
		if (hh.dogs) L.push(`- [ ] Dog food for ${hh.dogs} dog${hh.dogs > 1 ? "s" : ""} × ${hh.days} days (check bag feeding chart; kibble lasts ~1 yr unopened)`);
		if (hh.cats) L.push(`- [ ] Cat food for ${hh.cats} cat${hh.cats > 1 ? "s" : ""} × ${hh.days} days + litter`);
		L.push("- [ ] Pet meds, leash, carrier, vaccination records", "");
	}

	L.push("## 🔁 Rotation rules",
		"- [ ] Write the purchase date on everything with a marker.",
		"- [ ] New stock goes to the **back**; eat from the front.",
		"- [ ] Twice a year (daylight-saving changes): check dates, rotate bleach/oil/meds, swap go-bag food.",
		"- [ ] Store cool (<70°F), dry, dark, off concrete floors. Heat is the #1 shelf-life killer.",
		"- [ ] Keep a manual can opener in the pantry **and** the go-bag.",
		"- [ ] Have a way to cook without power: propane camp stove + fuel, rocket stove, or grill (**outdoors only**).",
		"",
		"*Baseline per-person amounts follow common long-term food storage planning guidelines (e.g. Utah State University Extension). Not nutrition or medical advice.*");
	await writeText(app, path, L.join("\n"));
	return path;
}

export const FAMILY_PLAN = `---
tags: [prepper/plan]
---
# 👨‍👩‍👧‍👦 Family Emergency Plan

*Fill this in once, print it, and put a copy in every go-bag. This note is never overwritten by the plugin.*

## Contacts
| Who | Phone | Notes |
|---|---|---|
| Out-of-state contact (everyone checks in here) |  | Long-distance calls/texts often work when local lines are jammed |
|  |  |  |
| Doctor / pediatrician |  |  |
| Vet |  |  |
| Insurance (policy #s in the document bag) |  |  |

## Meeting places
- **Near home** (fire, gas leak):
- **In the neighborhood** (can't get home):
- **Out of town** (evacuation):

## Evacuation
- Route 1:
- Route 2 (avoid bridges / flood-prone roads):
- Where we go:
- Trigger: we leave when … (mandatory order / water at … / smoke …)

## Shelter in place
- Safest interior room:
- Water shutoff location:
- Gas shutoff location (and the wrench is: ):
- Electrical main:

## Kids
- School/daycare release policy:
- Who is authorized to pick them up:
- Kid-sized go-bag + comfort item:

## Practice
- [ ] Fire drill (twice a year)
- [ ] Practice the out-of-town route once
- [ ] Everyone knows the out-of-state contact number by heart
`;
