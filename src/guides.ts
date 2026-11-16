/** Static, location-independent survival guides written into the vault. */
export const GUIDES: Record<string, string> = {
"Water Purification": `---
tags: [prepper/guide, prepper/water]
---
# 💧 Water Purification

**Rule of 3s:** ~3 minutes without air, ~3 hours without shelter in harsh weather, ~3 days without water, ~3 weeks without food. Water comes before food.

**Store:** at least **1 gallon per person per day** (drinking + basic hygiene), 2 weeks if you can. More for heat, illness, pregnancy, kids, pets.

> [!warning] Know what each method does and doesn't remove
> | Method | Bacteria | Viruses | Protozoa (Giardia/Crypto) | Chemicals / metals / salt |
> |---|---|---|---|---|
> | Boiling | ✅ | ✅ | ✅ | ❌ |
> | Bleach / chlorine | ✅ | ✅ | ⚠️ Giardia yes, Crypto **no** | ❌ |
> | Chlorine dioxide tabs | ✅ | ✅ | ✅ (Crypto needs up to 4 h) | ❌ |
> | 0.1–0.2 µm hollow-fiber filter | ✅ | ❌ (most) | ✅ | ❌ |
> | Purifier (filter + virus rated) | ✅ | ✅ | ✅ | ❌ |
> | Activated carbon | ❌ | ❌ | ❌ | ⚠️ some chemicals, taste |
> | Distillation | ✅ | ✅ | ✅ | ✅ (not volatile chemicals) |
> | SODIS (sunlight) | ✅ | ✅ | ⚠️ partial | ❌ |

## Step 1 — Clarify
Cloudy water shields germs from treatment and clogs filters. Let it **settle**, then pour off the top through a clean cloth, coffee filter or bandana.

## Step 2 — Disinfect (pick one)
### Boil (most reliable)
- Bring to a **rolling boil for 1 minute** (**3 minutes above 6,500 ft / 2,000 m**). Let cool, store covered.
- Improve flat taste by pouring between clean containers.

### Unscented household bleach
Check the label: plain, unscented, 6% or 8.25% sodium hypochlorite. No "splash-less", scented or color-safe bleach.
| Water | 6% bleach | 8.25% bleach |
|---|---|---|
| 1 quart / 1 liter | 2 drops | 2 drops |
| 1 gallon | 8 drops (⅛ tsp) | 6 drops |
| 2 gallons | 16 drops (¼ tsp) | 12 drops (⅛ tsp) |
| 4 gallons | ⅓ tsp | ¼ tsp |
| 8 gallons | ⅔ tsp | ½ tsp |
- **Double the dose if water is cloudy, colored or very cold.**
- Stir, wait **30 minutes**. It should smell slightly of chlorine. If not, repeat the dose and wait 15 more minutes.
- Bleach loses strength over time (about a year after manufacture) — rotate your stock.

### Iodine (2% tincture)
5 drops per quart of clear water, 10 if cloudy; wait 30 min (longer if cold). **Not for pregnant women, people with thyroid problems or iodine allergy, or long-term use.**

### Commercial tablets / filters
Follow the manufacturer's times exactly. Back-flush hollow-fiber filters and **never let them freeze** once wet (ice cracks the fibers and they'll fail without you knowing).

### SODIS (solar disinfection) — last resort
Clear PET plastic bottles ≤2 L, clear water only, lay on a reflective surface in full sun **6 hours** (2 days if more than half cloudy).

## Finding water
- Best to worst: stored water → municipal water you've treated → springs (at the source) → fast-moving streams → lakes/ponds → stagnant water.
- Your water heater (30–80 gal) and toilet **tank** (not bowl) hold clean water. Shut off the water main if the system is contaminated.
- Collect rain from clean surfaces (not treated-wood roofs or asphalt shingles if avoidable) — still treat it.
- **Floodwater:** assume chemical/sewage contamination. Boiling does not remove fuel, pesticides or heavy metals — use distillation or don't use it.
- Avoid water downstream of farms, mines, industrial sites, or with dead animals, algae blooms, oily sheen or odd smell.

## Signs of dehydration
Thirst, dark urine, headache, dizziness, fatigue → confusion and rapid heartbeat when severe. Sip regularly; add a pinch of salt + sugar per liter during heavy sweating or diarrhea (oral rehydration: 6 level tsp sugar + ½ level tsp salt per liter of clean water).

*Sources: CDC "Making Water Safe in an Emergency"; EPA "Emergency Disinfection of Drinking Water".*
`,

"Foraging Safety Rules": `---
tags: [prepper/guide, prepper/plant]
---
# 🌿 Foraging Safety Rules

1. **100% positive ID or don't eat it.** Use at least two independent field guides plus your own observation of the whole plant (leaves, stem, flowers, fruit, root, smell, habitat, season).
2. **Learn the killers first:** poison hemlock, water hemlock, death camas, jimsonweed, foxglove, oleander, yew, pokeweed, moonseed, Carolina jessamine, and Amanita mushrooms. See [[Plants Index]].
3. **No white umbels** (Queen Anne's lace–type flower clusters) unless you're an expert. The carrot family contains the deadliest plants in North America.
4. **No wild mushrooms** in an emergency unless you are already a trained, experienced mushroom hunter. Many deadly species have delayed symptoms.
5. Avoid roadsides, railways, power-line cuts, lawns, golf courses, farm-field edges, and polluted water (herbicides, lead, runoff).
6. **Start small.** Even safe plants can cause reactions or digestive upset. Eat a small portion and wait 24 h before eating more.
7. **Cook when in doubt** — many greens (dock, lamb's quarters, nettle, amaranth) are safer and easier to digest cooked.
8. Know the plant's **safe part and season**. (Elderberry: ripe cooked berries only. Mayapple: ripe fruit only. Pokeweed: don't.)
9. Harvest sustainably — never take more than ~10% of a patch; leave roots of perennials unless you planted them.
10. Know private property and park rules.

> [!danger] About the "Universal Edibility Test"
> The test from older military manuals takes ~24 hours per plant part, burns calories and water you can't spare, and **will not protect you from slow-acting deadly toxins** (hemlocks, amatoxins, cardiac glycosides). Treat it as a desperate last resort, never a substitute for knowing your plants. Remember: you can survive weeks without food.

## Calories that matter
Greens are nutritious but low in calories. For energy, focus on: **nuts** (hickory, pecan, walnut, leached acorns), **starchy roots** (cattail, Jerusalem artichoke, kudzu, greenbrier), **fruit** in season, and — more realistically — **fish, small game and stored food**.

## Poisoning
- **Poison Control (US): 1-800-222-1222** — free, 24/7.
- Call 911 for breathing trouble, seizures, collapse, or confusion.
- Keep a sample of what was eaten (whole plant or photo). Don't induce vomiting unless told to.
`,

"Fire": `---
tags: [prepper/guide]
---
# 🔥 Fire

**Fire triangle:** heat + fuel + oxygen. Most failures are not enough small fuel and poor airflow.

## Fuel ladder — gather ALL of it before striking
1. **Tinder** (fluffy, dry): dry grass, cattail fluff, birch bark, cedar bark shavings, pine needles, dryer lint, cotton balls + petroleum jelly, char cloth.
2. **Kindling**: pencil-lead to pencil-thick dead twigs — snap cleanly when dry. Take dead branches still on trees (off the wet ground).
3. **Fuel**: thumb to wrist-thick, then larger.

> [!tip] Southeast tip: fatwood
> Resin-soaked heartwood from old **pine stumps** lights even when wet and smells strongly of turpentine. Shave it into curls or scrape fine dust for a ferro rod.

## Ignition (carry 3)
- **Lighter** (Bic-type; keep warm in a pocket in cold weather).
- **Ferro rod** — scrape the rod back toward you while holding the striker still, keeps tinder intact. Works wet.
- **Storm-proof matches** in a waterproof case.
- Backups: magnifying lens (sun), 9V battery + steel wool, flashlight lens.

## Lays
- **Teepee:** fast, hot, good for starting and boiling water.
- **Log cabin:** stable, long-burning coals for cooking.
- **Lean-to:** against a log or rock to block wind.
- **Dakota fire hole:** two connected holes — low smoke and visibility, efficient, wind-resistant.

## Safety
- Clear a 10-ft circle to bare soil; never under overhanging branches or against tree roots.
- **Check local burn bans and permit rules** (in Georgia: Georgia Forestry Commission, gatrees.org).
- **NEVER burn poison ivy/oak/sumac or oleander** — smoke is dangerous to lungs.
- Never run a fire, generator, grill or camp stove inside a tent, house or garage — **carbon monoxide kills**. Get a battery CO alarm.
- Drown, stir, drown again. It should be cold to the touch.
`,

"Shelter & Signaling": `---
tags: [prepper/guide]
---
# ⛺ Shelter & Signaling

## Shelter priorities
1. **Get out of wind and wet** — they steal heat fastest.
2. **Insulate from the ground** — you lose more heat to cold ground than to air. 6+ inches of compressed dry leaves, pine needles, or a pad.
3. **Small is warm** — a shelter just big enough for you traps body heat.

## Quick shelters
- **Tarp A-frame:** ridge line between two trees, tarp over, stake the edges low on the windward side.
- **Debris hut:** ridgepole on a stump/crotch (hip height), ribs along the sides, then 2–3 ft of leaves/debris on top. Stuff the inside with dry leaves.
- **Lean-to:** good with a fire in front and a reflector wall behind the fire.

## Site selection — avoid
Dead trees/branches overhead ("widowmakers"), dry creek beds and flood zones, valley bottoms (cold air pools), hilltops (wind, lightning), ant mounds and game trails.

## Hypothermia & heat illness
- **Hypothermia:** shivering, "umbles" (stumbles, mumbles, fumbles, grumbles). Get dry, insulate, warm sweet drinks if alert, share body heat. Severe (shivering stops, confusion) = emergency; handle gently.
- **Heat exhaustion:** heavy sweating, cool clammy skin, nausea → shade, water, cool down.
- **Heat stroke:** hot skin, confusion, possibly no sweating → **911**, cool aggressively (cold water immersion is best).

## Signaling for rescue
- **Threes = distress:** 3 whistle blasts, 3 fires in a triangle, 3 gunshots, 3 flashes.
- **Whistle** carries farther than a voice and saves energy.
- **Signal mirror:** aim through the V of your fingers at the aircraft/ship; visible for miles.
- **Ground-to-air symbols** (make them at least 10 ft long, high contrast):
  - **V** = need assistance  ·  **X** = need medical assistance  ·  **N** = no  ·  **Y** = yes  ·  **→** = traveling this way
- **Smoke:** green leaves on a hot fire = white smoke (visible on dark terrain); rubber/oil = dark smoke (visible on snow/sky).
- Leave a **note** at your vehicle/campsite: who, when you left, direction, plan.
- Stay put if lost and someone knows your plan — it's much easier to find a stationary person.

## Navigation without GPS
- Use the offline maps in this vault; note major roads, rivers and power lines as "handrails".
- Sun rises roughly east, sets roughly west; at midday in the northern hemisphere it's due south.
- At night, find **Polaris** using the two outer stars of the Big Dipper's cup.
- **Shadow stick:** mark the tip of a stick's shadow, wait 15 min, mark again — the line from first to second mark points roughly east.
`,

"First Aid Quick Reference": `---
tags: [prepper/guide, prepper/medical]
---
# ⛑️ First Aid Quick Reference

> [!danger] This is a reminder card, not training
> Take a Stop the Bleed, CPR/AED, and Wilderness First Aid course. Call **911** whenever you can. **Poison Control: 1-800-222-1222.**

## Order of priorities
1. **Scene safety** — don't become the second victim.
2. **Massive bleeding** → 3. **Airway** → 4. **Breathing** → 5. **Circulation** → 6. **Hypothermia/head injury prevention**.

## Severe bleeding
- **Direct, firm pressure** with gauze/cloth — hold continuously, don't peek.
- Wounds in junctions (armpit, groin, neck): **pack** the wound tightly with gauze and hold pressure.
- Limb bleeding that won't stop: **tourniquet** 2–3 inches above the wound (not on a joint), tighten until bleeding stops, note the time. Don't loosen it.

## CPR (adult)
Unresponsive and not breathing normally → call 911, push **hard and fast** in the center of the chest, 100–120/min, about 2 inches deep. Use an AED as soon as available.

## Burns
Cool with cool (not ice) running water for **20 minutes**. Cover loosely with clean plastic wrap or a clean cloth. Don't pop blisters or apply butter.

## Snakebite (pit vipers in the Southeast: copperhead, rattlesnakes, cottonmouth; also coral snake)
- Move away from the snake, keep calm, call 911 / get to a hospital.
- Remove rings, watches and tight clothing before swelling. Keep the limb still at about heart level.
- **Do NOT** cut, suck, apply ice, use a tourniquet, or drink alcohol.

## Ticks
Grasp close to the skin with fine tweezers and pull straight up steadily. Clean the area. Note the date; watch for rash or fever over the next 30 days.

## Allergic reaction (anaphylaxis)
Swelling of face/throat, trouble breathing, hives, dizziness → **epinephrine auto-injector** in the outer thigh, call 911. A second dose may be needed after 5–15 minutes.

## Wound care without a hospital
Irrigate with lots of clean (treated) water under pressure. Remove debris. Cover with a clean dressing and change daily. Watch for infection: spreading redness, heat, pus, red streaks, fever → needs medical care.
`,

"Go-Bag Checklist": `---
tags: [prepper/guide, prepper/checklist]
---
# 🎒 Go-Bag Checklist (72 hours, per person)

## Water & food
- [ ] Water: 1 gal/person/day stored at home; 2–3 L carried + filter **and** chemical treatment
- [ ] 3 days of no-cook food (bars, nut butter, jerky, dried fruit), manual can opener
- [ ] Metal cup/pot for boiling

## Shelter & warmth
- [ ] Tarp + 50 ft paracord, emergency bivvy/mylar blankets
- [ ] Rain jacket, warm layer (wool/fleece), hat, gloves, extra socks
- [ ] Sleeping pad or bag appropriate to season

## Fire & light
- [ ] Lighter ×2, ferro rod, storm matches, tinder (cotton balls + petroleum jelly)
- [ ] Headlamp + flashlight, spare batteries

## Tools & navigation
- [ ] Fixed-blade knife, multi-tool, duct tape, zip ties
- [ ] Paper maps of your area + compass (print the maps in this vault!)
- [ ] Whistle, signal mirror

## Health
- [ ] First aid kit with tourniquet, pressure bandage, gauze, gloves
- [ ] 7-day supply of prescription meds, copies of prescriptions, spare glasses
- [ ] Hand sanitizer, soap, toilet paper, trash bags, N95 masks
- [ ] Sunscreen, insect repellent

## Communication & documents
- [ ] Battery/hand-crank NOAA weather radio
- [ ] Phone charger + power bank
- [ ] Cash in small bills
- [ ] Copies of IDs, insurance, deeds, medical info in a waterproof bag (or encrypted USB)
- [ ] Written contact list + family meeting places (one local, one out of town)

## Family-specific
- [ ] Kids: comfort item, games, copies of custody/placement paperwork if applicable
- [ ] Pets: food, leash, carrier, vet records
- [ ] Special needs: hearing aids, medical devices, formula/diapers

*Based on Ready.gov build-a-kit guidance — https://www.ready.gov/kit*
`,
};
