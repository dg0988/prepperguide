/**
 * Curated, deliberately conservative reference list (North America focus).
 * `key` is matched against iNaturalist taxon names: a binomial matches that species
 * (and its subspecies/varieties); a single word matches the whole genus.
 *
 * This is a memory aid, NOT an identification tool. Never eat anything you have not
 * positively identified with multiple field guides / an experienced local forager.
 */
export type Status = "edible" | "caution" | "toxic" | "deadly";

export interface PlantInfo {
	key: string;
	common: string;
	status: Status;
	kingdom?: "plant" | "fungus";
	/** edible: what parts & how. toxic: what is dangerous & symptoms */
	use: string;
	/** extra cautions */
	warn?: string;
	/** dangerous or confusing lookalikes */
	lookalikes?: string;
}

export const PLANT_DB: PlantInfo[] = [
	// ---------------- EDIBLE (well established, few dangerous lookalikes when ID'd properly) ----------------
	{ key: "Taraxacum", common: "Dandelion", status: "edible", use: "Whole plant. Young leaves raw or cooked (bitter when older), flowers raw/fried, roots roasted as coffee substitute.", lookalikes: "Cat's ear and other dandelion-like plants — also edible; no dangerous lookalikes. True dandelion has hollow, leafless, unbranched flower stems with milky sap." },
	{ key: "Plantago", common: "Plantain (broadleaf / narrowleaf)", status: "edible", use: "Young leaves raw or cooked (older leaves stringy — chop or cook). Seeds edible. Crushed leaf is a traditional poultice for stings/bites." },
	{ key: "Stellaria media", common: "Common chickweed", status: "edible", use: "Tender stems, leaves and flowers raw or cooked; mild, spinach-like.", lookalikes: "Scarlet pimpernel (Anagallis arvensis, toxic) — square stem, no hair line, orange/red flowers. Chickweed has a single line of hairs along a round stem and white star flowers with deeply split petals." },
	{ key: "Portulaca oleracea", common: "Purslane", status: "edible", use: "Leaves and stems raw or cooked; succulent, lemony; rich in omega-3s. Contains oxalates — eat in moderation.", lookalikes: "Prostrate spurges (Euphorbia, toxic) — spurge has thin stems and MILKY SAP when broken. Purslane has thick succulent stems and clear sap." },
	{ key: "Chenopodium album", common: "Lamb's quarters", status: "edible", use: "Young leaves and tips — best cooked (oxalates and nitrates). Seeds can be cooked like quinoa.", warn: "Avoid plants from fertilized fields (nitrate accumulation)." },
	{ key: "Amaranthus", common: "Amaranth / pigweed", status: "edible", use: "Young leaves cooked like spinach; seeds cooked or popped.", warn: "Can accumulate nitrates in heavily fertilized soil; contains oxalates — cook and don't overeat." },
	{ key: "Urtica dioica", common: "Stinging nettle", status: "edible", use: "Young tops cooked, steamed or dried for tea — heat/drying removes the sting. Very nutritious.", warn: "Wear gloves to harvest. Avoid old plants in flower/seed (gritty cystoliths)." },
	{ key: "Rubus", common: "Blackberry / raspberry / dewberry", status: "edible", use: "Ripe berries raw. Young peeled shoots edible. Leaves (dried, not wilted) for tea.", lookalikes: "No toxic Rubus berries in North America — aggregate berry of many small drupelets is diagnostic." },
	{ key: "Vaccinium", common: "Blueberry / huckleberry / cranberry", status: "edible", use: "Ripe berries raw or cooked.", lookalikes: "Make sure the berry has the five-pointed 'crown' at the end. Don't confuse with toxic dark berries like pokeweed, nightshade or moonseed." },
	{ key: "Morus", common: "Mulberry", status: "edible", use: "Fully ripe fruit raw or cooked.", warn: "Unripe fruit, leaves and milky sap can cause stomach upset/hallucination-like effects — eat only ripe fruit." },
	{ key: "Diospyros virginiana", common: "American persimmon", status: "edible", use: "Fully ripe (soft, wrinkly) fruit raw — usually after first frost. Seeds roasted as coffee substitute.", warn: "Unripe fruit is extremely astringent; eating lots of unripe fruit can form stomach bezoars." },
	{ key: "Asimina triloba", common: "Pawpaw", status: "edible", use: "Ripe fruit pulp raw (custard-like).", warn: "Don't eat the skin or seeds (seeds contain toxic compounds). Some people get GI upset or skin reactions." },
	{ key: "Carya", common: "Hickory / pecan", status: "edible", use: "Nuts raw or roasted; very high calorie. Shagbark hickory bark can flavor syrup.", lookalikes: "Buckeye (Aesculus) nuts are TOXIC — they are glossy brown with a pale 'eye' and no hard woody shell inside a husk that splits into 4 sections." },
	{ key: "Juglans", common: "Black walnut / butternut", status: "edible", use: "Nuts raw or roasted. Husks stain heavily.", warn: "Discard moldy nuts." },
	{ key: "Quercus", common: "Oak (acorns)", status: "edible", use: "Acorns after removing tannins — shell, grind, and leach in repeated changes of water (cold or hot) until no longer bitter. Then use as flour/meal.", warn: "Unleached acorns are high in tannins and cause GI upset/kidney stress." },
	{ key: "Typha", common: "Cattail", status: "edible", use: "Peeled young shoots raw/cooked ('Cossack asparagus'), green flower spikes boiled like corn, pollen as flour, rhizome starch.", warn: "Cattails filter pollutants — avoid plants from contaminated water.", lookalikes: "Young iris (Iris, toxic) and daffodil leaves. Iris leaves are flat and fan-arranged and lack the cattail's spongy/jelly-like base. Confirm with last year's brown 'hot dog' seed heads." },
	{ key: "Trifolium", common: "Clover", status: "edible", use: "Flowers raw or for tea; leaves better cooked (hard to digest raw).", warn: "Use fresh — wilted/fermented clover can contain coumarin derivatives." },
	{ key: "Oxalis", common: "Wood sorrel", status: "edible", use: "Leaves, flowers, green pods raw — lemony flavor.", warn: "High in oxalic acid; fine in moderation, avoid large amounts (kidney stones, gout)." },
	{ key: "Viola", common: "Violet", status: "edible", use: "Leaves and flowers raw or cooked; leaves thicken soups.", warn: "Do NOT confuse with African violet (not a true violet). Avoid roots/seeds.", lookalikes: "Young leaves can be confused with lesser celandine (Ficaria verna, toxic raw) — celandine has glossy leaves and yellow flowers." },
	{ key: "Opuntia", common: "Prickly pear cactus", status: "edible", use: "Young pads (nopales) and ripe fruit (tunas) — burn or scrape off spines AND tiny hair-like glochids first.", warn: "Glochids are very irritating; handle with tongs/gloves." },
	{ key: "Passiflora incarnata", common: "Maypop (passionflower)", status: "edible", use: "Ripe fruit (yellowish, wrinkles slightly) — eat the pulp around seeds. Young leaves sometimes cooked.", warn: "Unripe fruit is not palatable." },
	{ key: "Rosa", common: "Wild rose", status: "edible", use: "Rose hips (very high vitamin C) — remove the irritating seed hairs; petals raw or tea.", warn: "Multiflora rose is invasive; fine to harvest." },
	{ key: "Cichorium intybus", common: "Chicory", status: "edible", use: "Young leaves raw/cooked (bitter), flowers raw, roots roasted as coffee substitute." },
	{ key: "Galium aparine", common: "Cleavers", status: "edible", use: "Young shoots cooked as a pot herb; dried/roasted seeds as coffee substitute.", warn: "Some people get skin irritation from handling." },
	{ key: "Lamium", common: "Henbit / purple deadnettle", status: "edible", use: "Leaves, stems and flowers raw or cooked. ('Dead' nettle = doesn't sting.)" },
	{ key: "Nasturtium officinale", common: "Watercress", status: "caution", use: "Leaves and stems raw or cooked; peppery.", warn: "Grows in water — can carry liver flukes and bacteria. COOK it unless the water source is known clean. Don't harvest downstream of livestock.", lookalikes: "Water hemlock and fool's watercress grow in the same habitat — be certain of ID." },
	{ key: "Arctium", common: "Burdock", status: "edible", use: "First-year taproot peeled and cooked (gobo). Young peeled flower stalks cooked.", lookalikes: "Young rosettes can resemble foxglove (Digitalis, deadly) and rhubarb leaves. Burdock leaves have a woolly white underside and hollow/grooved stems; confirm with burrs from last year." },
	{ key: "Helianthus tuberosus", common: "Jerusalem artichoke (sunchoke)", status: "edible", use: "Tubers raw or cooked (dig in fall/winter).", warn: "Inulin can cause gas/bloating — eat moderate amounts." },
	{ key: "Fragaria", common: "Wild strawberry", status: "edible", use: "Ripe berries raw; leaves (fully dried) for tea.", lookalikes: "Mock strawberry (Potentilla indica) has yellow flowers and bland upward-facing fruit — not dangerous, just tasteless." },
	{ key: "Amelanchier", common: "Serviceberry / juneberry", status: "edible", use: "Ripe berries raw or cooked — sweet, almond-flavored seeds are fine in normal quantities." },
	{ key: "Pueraria montana", common: "Kudzu", status: "edible", use: "Young leaves and shoot tips cooked, flowers for jelly/tea, starchy roots processed for starch.", warn: "Frequently sprayed with herbicide along roadsides and power lines — only harvest where you know it hasn't been treated.", lookalikes: "Poison ivy also has three leaflets — kudzu leaflets are much larger and fuzzy, and vines are hairy-brown rather than having aerial rootlets." },
	{ key: "Lepidium virginicum", common: "Virginia pepperweed", status: "edible", use: "Leaves and seed pods raw — peppery, mustard-like." },
	{ key: "Cardamine", common: "Bittercress", status: "edible", use: "Leaves and flowers raw — mild mustard flavor; abundant late winter/early spring." },
	{ key: "Rumex", common: "Dock / sorrel", status: "edible", use: "Young leaves cooked (change water if bitter); sheep sorrel leaves raw in small amounts.", warn: "High in oxalic acid — cook and eat in moderation." },
	{ key: "Smilax", common: "Greenbrier", status: "edible", use: "Tender new shoot tips and tendrils raw or cooked (snap where tender, like asparagus). Starchy tubers processed for starch." },
	{ key: "Rhus", common: "Sumac (red-berried)", status: "edible", use: "Red fuzzy berry clusters soaked in COLD water for 'sumac-ade' (lemony); dried as spice.", warn: "Related to cashew/mango — people with those allergies may react.", lookalikes: "POISON SUMAC (Toxicodendron vernix) has WHITE/greenish drooping berries and grows in swamps. Edible sumacs have upright RED berry clusters." },
	{ key: "Crataegus", common: "Hawthorn", status: "edible", use: "Ripe fruit (haws) raw or cooked; young leaves.", warn: "Don't eat the seeds (contain cyanogenic compounds). May interact with heart medications." },
	{ key: "Malus", common: "Crabapple / wild apple", status: "edible", use: "Fruit raw or cooked (crabapples are sour — good for jelly and natural pectin).", warn: "Don't eat the seeds in quantity (cyanogenic)." },
	{ key: "Allium canadense", common: "Wild onion / wild garlic", status: "caution", use: "Bulbs, leaves and bulblets raw or cooked.", warn: "Rule: if it doesn't SMELL like onion/garlic, don't eat it.", lookalikes: "DEATH CAMAS (Toxicoscordion/Zigadenus, deadly) and Star-of-Bethlehem (Ornithogalum, toxic) look similar but have NO onion smell. Your hands may already smell of onion — crush a fresh piece." },
	{ key: "Sambucus", common: "Elderberry", status: "caution", use: "Fully ripe dark berries COOKED (jam, syrup); flower clusters cooked or in tea/fritters.", warn: "Stems, leaves, roots, bark, seeds and unripe/raw berries contain cyanogenic glycosides — cause vomiting. Remove all stems. Red elderberry (S. racemosa) is more toxic; many experts avoid it.", lookalikes: "Flat-topped white flower clusters resemble WATER HEMLOCK and POISON HEMLOCK (deadly). Elder is a woody shrub with opposite, compound, toothed leaves; hemlocks are herbaceous with umbrella-shaped umbels." },
	{ key: "Vitis", common: "Wild grape / muscadine", status: "caution", use: "Ripe grapes raw or cooked; young leaves cooked (dolmas). Muscadines are common in the Southeast.", lookalikes: "CANADA MOONSEED (Menispermum canadense, deadly) — moonseed has ONE crescent-shaped seed per berry and no forked tendrils. Grapes have several pear-shaped seeds and forked tendrils. Also Virginia creeper (toxic berries, 5 leaflets) and porcelain berry." },
	{ key: "Pinus", common: "Pine", status: "caution", use: "Needle tea (vitamin C), inner bark (cambium) as emergency food, pine nuts, pollen. Fatwood from stumps is excellent fire starter.", warn: "Avoid Ponderosa pine needles during pregnancy. Not all needled trees are pine.", lookalikes: "YEW (Taxus, deadly) — flat needles, red fleshy berry cups, no cones. Pines have needles in bundles (fascicles) of 2–5." },
	{ key: "Prunus serotina", common: "Black cherry", status: "caution", use: "Ripe fruit flesh raw or cooked.", warn: "Pits, leaves (especially wilted), twigs and bark contain cyanogenic compounds — never eat pits or use wilted leaves for tea." },
	{ key: "Podophyllum peltatum", common: "Mayapple", status: "caution", use: "ONLY the fully ripe, yellow, soft fruit (seeds removed) is edible.", warn: "Everything else — roots, leaves, stems, seeds, and unripe green fruit — is toxic (podophyllotoxin). Many foragers skip it entirely." },

	// ---------------- TOXIC / DEADLY (know these first) ----------------
	{ key: "Conium maculatum", common: "Poison hemlock", status: "deadly", use: "ALL parts deadly (coniine) — paralysis and respiratory failure. Even handling may irritate; don't burn it.", lookalikes: "Looks like wild carrot (Queen Anne's lace), wild parsley, fennel. Hemlock has SMOOTH, HAIRLESS stems with PURPLE BLOTCHES and a musty/mousy smell. Wild carrot stems are hairy. Best rule: don't eat ANY white umbel-flowered plant unless you're an expert." },
	{ key: "Cicuta", common: "Water hemlock", status: "deadly", use: "Considered the most toxic plant in North America (cicutoxin) — violent seizures, death within hours. Roots are most toxic; a bite can kill.", lookalikes: "Wild parsnip, wild carrot, angelica, elderberry flowers. Grows in wet areas. Cut root shows chambers and yellowish oily liquid. Avoid all white umbels near water." },
	{ key: "Toxicodendron", common: "Poison ivy / poison oak / poison sumac", status: "toxic", use: "Urushiol oil causes severe blistering rash. NEVER burn — smoke can cause serious lung reactions. Oil persists on tools/clothes/pets for months.", warn: "Wash skin with soap and cool water ASAP (within ~30 min) after contact.", lookalikes: "'Leaves of three, let it be.' Hairy vines on trees ('hairy rope, don't be a dope'). Poison sumac has white berries in swamps." },
	{ key: "Phytolacca americana", common: "Pokeweed", status: "toxic", use: "Roots, mature stems/leaves and berries are toxic — vomiting, diarrhea, low blood pressure; roots are most dangerous. Berries can be lethal to children.", warn: "'Poke sallet' tradition requires very young shoots boiled in multiple changes of water — not recommended in an emergency." },
	{ key: "Datura", common: "Jimsonweed / thornapple", status: "deadly", use: "All parts toxic (tropane alkaloids) — delirium, hyperthermia, racing heart, death. Spiny seed pods, trumpet flowers." },
	{ key: "Solanum", common: "Wild nightshades / horsenettle", status: "toxic", use: "Wild Solanum species (horsenettle, bittersweet nightshade, black nightshade): leaves and unripe berries contain solanine — GI upset, neurological symptoms. (Genus also includes cultivated tomato/potato.)", lookalikes: "Black nightshade berries resemble blueberries but grow in clusters from a star-shaped calyx without a crown." },
	{ key: "Atropa belladonna", common: "Deadly nightshade (belladonna)", status: "deadly", use: "All parts deadly — sweet-tasting black berries are a classic child poisoning." },
	{ key: "Digitalis", common: "Foxglove", status: "deadly", use: "All parts contain cardiac glycosides — heart arrhythmia, death.", lookalikes: "First-year leaves resemble comfrey, borage and burdock." },
	{ key: "Nerium oleander", common: "Oleander", status: "deadly", use: "All parts extremely toxic (cardiac glycosides) — even smoke from burning it and honey from its flowers. Common Southern landscape shrub; don't use stems as skewers." },
	{ key: "Taxus", common: "Yew", status: "deadly", use: "Needles, bark and seeds are deadly (taxine — sudden cardiac arrest). The red fleshy aril surrounds a deadly seed.", lookalikes: "Can be mistaken for hemlock-tree or fir needles for tea. Yew has flat needles with no white stripes and red berries." },
	{ key: "Ricinus communis", common: "Castor bean", status: "deadly", use: "Seeds contain ricin — chewing seeds can be fatal." },
	{ key: "Abrus precatorius", common: "Rosary pea", status: "deadly", use: "Red-and-black seeds contain abrin — one chewed seed can be fatal. Invasive in Florida." },
	{ key: "Kalmia", common: "Mountain laurel", status: "toxic", use: "All parts contain grayanotoxins — vomiting, low heart rate, low blood pressure. Honey from it can be toxic." },
	{ key: "Rhododendron", common: "Rhododendron / azalea", status: "toxic", use: "All parts contain grayanotoxins — same as mountain laurel. Don't use for tea or honey ('mad honey')." },
	{ key: "Aesculus", common: "Buckeye / horse chestnut", status: "toxic", use: "Nuts, leaves, bark and sprouts are toxic (aesculin) — vomiting, paralysis. Squirrels eat them; you can't.", lookalikes: "Nuts resemble true chestnuts (Castanea) — true chestnuts come in very spiny burs with 2–3 pointed nuts; buckeye husks are leathery/warty with 1 round nut." },
	{ key: "Melia azedarach", common: "Chinaberry", status: "toxic", use: "Yellow berries and bark are toxic — vomiting, seizures, paralysis. Very common in the Southeast." },
	{ key: "Ilex", common: "Holly (berries)", status: "toxic", use: "Berries cause vomiting and diarrhea, especially dangerous for children.", warn: "Yaupon holly (Ilex vomitoria) LEAVES are traditionally brewed as a caffeinated tea, but the berries are still toxic." },
	{ key: "Hedera helix", common: "English ivy", status: "toxic", use: "Leaves and berries cause GI upset; sap irritates skin." },
	{ key: "Lantana camara", common: "Lantana", status: "toxic", use: "Unripe green berries and leaves are toxic (liver damage, GI upset) — dangerous to children and livestock." },
	{ key: "Toxicoscordion", common: "Death camas", status: "deadly", use: "All parts deadly — vomiting, low heart rate, death.", lookalikes: "Wild onion and camas (Camassia) — death camas has NO onion smell." },
	{ key: "Zigadenus", common: "Death camas", status: "deadly", use: "All parts deadly.", lookalikes: "Wild onion — no onion smell." },
	{ key: "Veratrum", common: "False hellebore", status: "deadly", use: "All parts deadly — severe low heart rate and blood pressure.", lookalikes: "Ramps (wild leeks) and skunk cabbage. Ramps smell strongly of onion/garlic; false hellebore has pleated, many-veined leaves and no smell." },
	{ key: "Aconitum", common: "Monkshood / wolfsbane", status: "deadly", use: "All parts deadly — can be absorbed through skin. Hood-shaped purple flowers." },
	{ key: "Euphorbia", common: "Spurge", status: "toxic", use: "Milky sap irritates skin and eyes (can cause temporary blindness); toxic if eaten.", lookalikes: "Prostrate spurge vs. purslane — spurge bleeds milky sap." },
	{ key: "Arisaema", common: "Jack-in-the-pulpit", status: "toxic", use: "Calcium oxalate crystals — intense burning of mouth and throat, swelling. Red berries in fall." },
	{ key: "Menispermum canadense", common: "Canada moonseed", status: "deadly", use: "Berries are deadly and look like wild grapes.", lookalikes: "Wild grape — moonseed has a single crescent-moon-shaped seed and no tendrils." },
	{ key: "Sanguinaria canadensis", common: "Bloodroot", status: "toxic", use: "Orange-red sap is caustic; ingestion causes vomiting and collapse. Escharotic — burns skin." },
	{ key: "Convallaria majalis", common: "Lily of the valley", status: "deadly", use: "All parts contain cardiac glycosides.", lookalikes: "Ramps / wild garlic leaves — lily of the valley has no onion smell." },
	{ key: "Gelsemium sempervirens", common: "Carolina jessamine", status: "deadly", use: "All parts deadly (gelsemine) — paralysis, respiratory failure. Common yellow-flowered vine in the Southeast; its nectar/honey can also be toxic.", lookalikes: "Honeysuckle — don't suck the nectar from yellow trumpet-flowered vines unless certain it's honeysuckle (Lonicera)." },
	{ key: "Pastinaca sativa", common: "Wild parsnip", status: "toxic", use: "Sap + sunlight causes severe burns and blisters (phytophotodermatitis). Root is the cultivated parsnip, but wild ID is risky next to hemlocks.", lookalikes: "Yellow umbels — related to poison/water hemlock." },
	{ key: "Heracleum mantegazzianum", common: "Giant hogweed", status: "toxic", use: "Sap + sunlight causes severe burns and possible blindness." },
	{ key: "Ranunculus", common: "Buttercup", status: "toxic", use: "Fresh plants contain protoanemonin — mouth blistering, GI upset." },
	{ key: "Ornithogalum", common: "Star-of-Bethlehem", status: "toxic", use: "Bulbs and leaves contain cardiac glycosides.", lookalikes: "Wild onion — no onion smell." },
	{ key: "Iris", common: "Iris / flag", status: "toxic", use: "Rhizomes and leaves cause severe GI upset.", lookalikes: "Young cattail shoots." },
	{ key: "Parthenocissus quinquefolia", common: "Virginia creeper", status: "toxic", use: "Berries contain oxalates — toxic. Five leaflets (not three).", lookalikes: "Wild grape berries." },

	// ---------------- FUNGI (danger list only — this plugin does NOT recommend any wild mushroom) ----------------
	{ key: "Amanita", common: "Amanita (death cap, destroying angel, etc.)", status: "deadly", kingdom: "fungus", use: "Responsible for most mushroom deaths. Amatoxins destroy the liver; symptoms are delayed 6–24 h, followed by false recovery, then liver failure. Cooking does not destroy the toxin.", lookalikes: "White button mushrooms, puffballs (cut every puffball top to bottom — an outline of a cap/gills inside means it's an Amanita 'egg'). Look for a cup (volva) at the base and a ring on the stem." },
	{ key: "Galerina marginata", common: "Deadly Galerina", status: "deadly", kingdom: "fungus", use: "Same amatoxins as death cap. Small brown mushroom on wood.", lookalikes: "Honey mushrooms, velvet foot (enoki) — take a spore print: Galerina is rusty brown." },
	{ key: "Lepiota", common: "Lepiota (small parasols)", status: "deadly", kingdom: "fungus", use: "Several small species contain amatoxins." },
	{ key: "Gyromitra", common: "False morel", status: "deadly", kingdom: "fungus", use: "Gyromitrin (converts to rocket-fuel compound monomethylhydrazine) — seizures, liver damage; fumes during cooking are dangerous.", lookalikes: "True morels are completely HOLLOW when sliced lengthwise; false morels are cottony/chambered inside and brain-like." },
	{ key: "Chlorophyllum molybdites", common: "Green-spored parasol", status: "toxic", kingdom: "fungus", use: "The most commonly eaten poisonous mushroom in North America (lawns!). Severe vomiting and diarrhea.", lookalikes: "Edible parasols/shaggy parasols — spore print is green." },
	{ key: "Omphalotus", common: "Jack-o'-lantern mushroom", status: "toxic", kingdom: "fungus", use: "Severe GI poisoning. Orange, clustered on wood/buried roots; gills glow faintly in the dark.", lookalikes: "Chanterelles — chanterelles have false gills (blunt ridges) and grow singly from soil." },
	{ key: "Cortinarius", common: "Webcaps", status: "deadly", kingdom: "fungus", use: "Some species contain orellanine — kidney failure with symptoms delayed days to weeks." },
	{ key: "Clitocybe", common: "Clitocybe (sweating mushrooms)", status: "toxic", kingdom: "fungus", use: "Muscarine poisoning — sweating, salivation, slow heart rate." },
];

export function matchPlant(taxonName: string): PlantInfo | null {
	const parts = taxonName.split(" ");
	const binomial = parts.slice(0, 2).join(" ");
	return PLANT_DB.find((p) => p.key === binomial) || PLANT_DB.find((p) => !p.key.includes(" ") && p.key === parts[0]) || null;
}
