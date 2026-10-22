# Jungle map source foundation

The project now has a reproducible catalog of the frozen Rift's **18 camp
anchors, 53 neutral character objects and 16 recommendation positions**. The
development map inspector displays these layers independently. Live neutral
camp spawning, combat, rewards, resets, objectives and jungle-role AI remain
unfinished. This preparation supplies source data for those systems.

The next [character-source increment](JUNGLE-CHARACTERS.md) adds eleven ordinary
monster definitions with 35 CharacterRecord variants and isolated Blue/Gromp
base-rig review. It preserves the distinction between the placed Blue skin 4
objects and the separately converted base skin 0.

## Original client files

`reference/jungle-map-source.json` pins two BINs in Riot 16.18.8175716's
`DATA/FINAL/Maps/Shipping/Map11.wad.client`, using manifest
`29CE6E781C3B6368`:

| File | Bytes | Purpose |
| --- | ---: | --- |
| `data/maps/shipping/map11/map11.bin` | 4,937,067 | Standard-mode links, camp identifiers, recommendation locations and paths |
| `data/maps/mapgeometry/map11/base_srx.materials.bin` | 1,770,390 | Camp and neutral-character entities with original transforms/components |

The extraction ledger retains manifest, compressed-chunk ranges/hashes, WAD
paths and individual file hashes. The material BIN also matches the existing
terrain extraction's independently retained hash. The public JSON mirror returned
HTTP 403 during this investigation; reproduction uses original Riot archive bytes.

Initial labels came from FNV-verified field/type dictionaries and four existing
source pins. Their hashes are retained as naming evidence. Subsequent runs use
the selected source records and original naming seeds, without the discovery
dictionaries. Newly encountered literal strings cannot silently relabel
previously unresolved entity-name hashes. Unknown names remain hashes.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-jungle-map.py
python3 tools/assets/export-jungle-map.py
```

The extractor requires exact equality with the existing pin. The exporter only
rewrites changed output and keeps absent optional fields as null. It generates
`src/content/jungle-map-inspection.json`; ordinary game startup does not import it.

## Distinctions required for gameplay integration

The standard mode's `JungleRecommendationMapInformation` and
`DefaultJunglePathRecommendation` links resolve independently of the material
entities. Their positions are recommendations, not exact camp anchors. For
example, Order Blue's source anchor is
`[3893.85107421875,28.06399917602539,7869.8251953125]`, while its recommendation
is `[3700,0,8000]`. The separate minimap offset `[-80,0,40]` does not move the anchor.

Recommendation Index and Location also remain separate: Chaos OwlBear has index
14 and location 6; Order Owlbear has index 13 and no authored Location. The last
Order TakeCamp step omits Camp. Those absences remain null rather than an inferred
zero. These records do not yet drive bot paths.

The 53 selected character objects have source team 300 and a Character component;
twelve are faelight ward pads. Dragon character objects include off-map positions;
their runtime use remains unverified. A single small-wolf object per half does
not prove the spawned wolf count.
Proximity, template count and shared containers do not establish camp membership
or activation.

There are twenty NeutralCampIdentifier records but eighteen placed anchors.
Atakhan and ElderDragon lack separate anchors in these files. This is not a
general disabled-camp rule: Dragon explicitly includes a DragonElder type.
Selection, cloning and relocation require separate evidence.

Camp components contain icons, timer metadata and some stop-spawn fields. This
audit identified no explicitly named first-spawn field; hashed fields remain
uninterpreted. Riot's [26.1 Game Start Time notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/)
provide a separate baseline: wolves/buffs/raptors at 55 seconds, krugs/gromp at
67 seconds and scuttlers at 175 seconds. This published baseline is not an
executable calendar here. Later changes, script initialization, respawn rules and
current-mode activation must be reconciled before enabling live camps.

## Inspecting the coordinates

Run the development server, open `/map.html`, and choose **Jungle sources**.
Gold rings mark actual camp anchors; cyan dots show neutral character objects;
pink rings show recommendation positions. Select an anchor and use **Show
selected anchor** to center it. The panel retains identifiers, component fields,
identifier definitions and recommendation metadata.

Markers use the existing Rift transform: X is `(sourceX - 7425) * 0.01`, Y is
`sourceY * 0.01`, and Z is `(7425 - sourceZ) * 0.01`. Depth testing is disabled for
these annotations so anchors remain visible inside terrain. Coordinates are not
lifted or clamped. Annotation colors/geometry are local inspection UI.

The catalog/module load on demand. Panel/layer toggles reuse geometries and
materials. A failed module fetch offers a map reload because Chrome retains the
failed import in the current document. Production excludes the source button,
catalog and annotations. No simulation, snapshot, roster or binary assets changed.

Live camps still need an explicit neutral faction with correct targeting, vision
and rewards; a verified roster/calendar; monster rigs/animations/audio; scaling,
buff and Smite rules; leash/reset/clear/respawn state; and saved continuation.
Jungle bots then need team-visible camp knowledge and role planning. The complete
role-match objective remains in scope. Checks and captures are recorded in
[PROGRESS](PROGRESS.md).
