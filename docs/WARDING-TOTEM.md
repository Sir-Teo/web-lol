# Stealth Ward foundation

Every champion now starts with a Stealth Ward trinket in its separate slot.
Hold **4**, aim over the battlefield and release, or click the trinket and choose
a location. Escape or a movement/attack order cancels targeting. A distant order
walks the champion into cast range before spending a charge, then stops. The HUD
shows charges, recharge or cast cooldown and the owner's placed count. The two
range guides indicate cast distance and the proposed ward's sight radius.

This supplies usable ward vision in Rift practice and the interim lane match.
Bots consume the shared team sight but do not yet plan their own ward placements.
Control Wards, sweepers, true sight, support ward items, Faelights and complete
role-aware vision play remain required work.

## Frozen evidence

[The source pin](reference/warding-totem-source.json) retains nine original Riot
Map11 members and seven Scripts archive members from build 16.18.8175716,
manifest `29CE6E781C3B6368`. It includes the base SightWard character, skin,
animation graph, mesh, skeleton, texture and animation dependencies. The base
rig has 336 triangles, four bones and five atomic entries; multiple entries
reference the same static idle animation. Spawn and death animations last about
0.4 and 0.767 seconds. Zero-duration idle poses are retained rather than invented
as looping motion. The normal skin is the current local default; cosmetic
selection, native graph dispatch, attachment, lighting and scale calibration
remain open.

Root supplies three health, 900 sight, radius one, pathfinding radius five,
180 health-bar height, zero regeneration and the Ward/Special tags, including
`Special_TurretIgnores` and `Special_UntargetableBySpells`. Root supplies zero
gold and XP; it does not establish the trinket's spawned bounty override.

The frozen 16.18 item and shared exports retain item 3340, its unique Trinket
group, two maximum charges, three placed wards, 90–120-second duration endpoints,
210–90-second recharge endpoints and 625-unit cast range. The selected spell
also retains a 1.25-second cast cooldown, channel preservation, ability-haste
exclusion and `NudgeIntoBrush` targeting. Its travel spell specifies a fixed
~0.325-second flight. These fields do not prove active server callback behavior.
The original 16.18.1 trinket PNG is local and hashed in the icon manifest.

All seven scripts contain only metadata/table assignments and return, with no
child functions or active placement, stealth, reward or recharge callback.
REA rejected the proprietary BIN format. The repository's existing Riot archive,
BIN and static Lua readers provide the retained byte/hash evidence; no REA
analysis or executed Lua behavior is claimed.

Riot's [26.3 change](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-3-notes/)
corroborates the 210–90 recharge endpoints. The named `GameTimeThreshold=14` in
the frozen item is retained without assigning it a fourteen-minute recharge
formula. Native scaling, current dynamic bindings and server timing remain
unverified. The [26.1 Faelight rules](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/)
are an additional system; ordinary ward sight does not implement them.

## Explicit local policies

- Start with one charge and a level-one recharge span. Duration and each new
  recharge span interpolate linearly from the average level of all existing
  champions, clamped to levels 1–18, including dead champions. A running span
  keeps its captured deadline. Ability haste does not change these clocks.
- An in-range accepted cast spends one charge without interrupting its current
  order or Recall. Roots and silence permit placement; stun and death reject it.
  A distant placement instead becomes a movement intent and interrupts Recall.
  Other movement/attack orders cancel that intent without spending a charge.
- Placement lands 20 fixed steps after acceptance and then starts its captured
  lifetime, becoming targetable at delivery. Already committed placement survives the caster's later movement,
  death and practice cooldown reset. Reset refills two charges and clears cast
  and recharge cooldowns; it neither duplicates nor cancels a delivery in flight.
- Ground placement uses the existing nearest walkable point with radius five.
  Exact native wall-edge and brush nudging are not recovered. The 900-unit guide
  is a range boundary; actual sight still obeys terrain and brush occlusion.
- The ward is initially visible for two seconds. A champion basic hit removes
  exactly one health and extends that reveal by two seconds. Ordinary enemy sight
  and Hawkshot do not reveal a stealthed ward. Allies retain its model and marker.
  Ward detection and disabling require the still-unfinished vision tools.
- Existing supported spells pass through or ignore wards: they do not spend a
  Light Binding hit slot, apply control/Illumination, or damage them. Minions,
  structures and ordinary monsters do not attack them. Garen's Q consumes its
  empowered attack while still removing one health and applying no silence.
- A champion's last hit gives a provisional ten gold, with no XP, CS or champion
  kill credit. The source Root's zero rewards remain separate. Riot's historical
  [11.17 clone fix](https://www.leagueoflegends.com/en-gb/news/game-updates/patch-11-17-notes/)
  supports a ten-gold ward candidate; current trinket-specific dispatch, revealer
  rewards and champion proc/attack-reset interactions remain unverified.
- A fourth arriving ward removes only that owner's oldest living ward, ordered
  by creation tick then ID. Expiry and replacement grant no combat rewards.
  Wards retain the full source death clip before corpse removal. Owner death
  does not remove an existing ward or stop its lifetime/recharge clock.

The body uses its original rig and clips. Range guides, health divisions and
minimap markers are local UI aids. The source idle/stealth/placement/death
particles and audio, native material/graph transitions and pixel comparison
remain unfinished. This is a gameplay foundation, not native ward certification.

## Persistence and verification

Schema 103 stores trinket charges, captured recharge spans, short cast cooldown,
a pending approach, committed deliveries with captured origin/range/lifetime,
and each placed ward's owner, reveal and expiry clocks. A committed delivery is
independent of later practice refills. Restoration neither replays a cast nor
creates a duplicate ward. Validation rejects crossed/orphan ownership, foreign
ward fields, over-health/moving/controlled wards, duplicate commits, impossible
ranges/deadlines and excess living wards. Earlier formats remain incompatible.

[The verification ledger](reference/warding-totem-verification.json) records the
commands, source reproduction, asset validation, tests, captures and production
result. Simulation coverage includes all three supported attackers, pending and
engaged saves, death, expiry, source scalars, scaling, charge capture, placement
cancellation and reset during multiple committed deliveries. Browser coverage
uses real key/button targeting, Volley, basic attacks and saved reloads, plus
controlled camera/position/time setup for later sight and expiry boundaries.
It does not establish a natural full jungle route or full-match performance.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-warding-totem.py
node tools/assets/convert-roster-base.mjs SightWard
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/export-warding-totem.py
```
