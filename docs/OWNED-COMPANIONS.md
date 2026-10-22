# Owned companion encounter

The controlled development Gromp encounter now supports Gustwalker, Scorchclaw
and Mosstomper ownership, following, monster combat assistance, feeding and earned
Smite evolution. This is the shared runtime foundation for the jungle role.
Companion purchases, final item passives, production role assignment and complete
jungle matches remain unfinished. The full project goal stays active.

Open one of these development URLs:

```text
/?scene=fixture&encounter=gromp&companion=gustwalker
/?scene=fixture&encounter=gromp&companion=scorchclaw
/?scene=fixture&encounter=gromp&companion=mosstomper
```

The fixture grants the selected companion and equips D Flash/F Smite. Ordinary
practice and lane matches do not grant companions. Production ignores the
development query. There is no manual evolution selector or champion-level
upgrade: earned feeds determine the Smite stage.

## Source boundary

[The companion source pin](reference/jungle-companions-source.json) and
[source preparation](JUNGLE-COMPANIONS.md) retain the three original rigs,
Adult/Baby submeshes, atomic animations, item records, controller values and
metadata-only script boundary. Their original files are unchanged by this
runtime milestone. The companion CharacterRecord's neutral-looking tags and
rewards do not define the owned actor. A companion is separate saved state,
without a neutral unit, targetable health pool, collision body, bounty or vision
source.

The generated `src/content/owned-companions.json` links source digests, selected
animation roles, controller/calculation inputs and the four upgrade icons.
[The icon pin](reference/owned-companion-icons.json) retains original DDS paths,
archive/chunk evidence and output hashes. These icons came from the frozen Riot
`DATA/FINAL/DATA.wad.client` archive, rather than invented URLs or painted
replacements. Pillow decodes DDS to RGBA PNG without creative changes.

Reproduce icons and the runtime profile from the existing source pin:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-owned-companion-icons.py
.tools/cdtb-venv/bin/python tools/assets/export-owned-companions.py
```

The standard items contain 35 total counters and a breakpoint of 20, while their
extended tooltip labels the breakpoint as treats fed. The published 26.1 change
says first evolution takes 15 kills. This adapter uses 15 and 35 earned feeds,
consistent with the published baseline. The possible remaining-counter
interpretation remains unproven by native callbacks; it is not silently treated
as recovered server behavior.

## Combat and following

Damaging a live monster activates the owner's companion for six seconds. A valid
target must remain visible, vulnerable, alive, within 1,000 units of the owner
and outside a returning reset. A local strike starts every 120 ticks and releases
after 28 ticks. It deals two seconds of the retained DPS calculation as true
damage to monsters within 235 units of the primary target, then heals the owner
once for two seconds of HPS. Target loss cancels an unfinished release.

The DPS adapter interpolates 20–150 over levels 1–18 and adds 10% bonus AD,
16% AP, 4% bonus HP and 25% each of bonus armor/MR. HPS is six through level
three, increasing by two per level thereafter. The values and calculation parts
are retained source inputs; stat-enum bindings, delivery timing, area and target
gates still need native comparison. Companion damage and Smite do not receive
the companion's outgoing monster multiplier or Doran's Blade omnivamp.

Owned champions deal the retained ~1.1 multiplier to monsters and take the
retained 0.5 multiplier from non-epic monsters. Large/epic last hits also grant
the adapter's 80 XP, with 150 extra XP for the first such kill. Kill recovery
uses `min(250, 70 + 20 × level)` times missing-health fraction, and
`(15 + 4 × level) × missing-mana fraction × 2.25`. These formula bindings are
local; the recovered healing record does not establish the complete native
formula. Energy restoration has no implemented resource model.

Navigation uses the existing battlefield paths with a 20-unit actor radius,
650-unit movement speed, a 12-tick path refresh and a 100-unit trailing offset.
Combat uses a 70-unit target offset. An owner separation over 1,000 units snaps
the actor to a reachable destination and resets interpolation. These are explicit
local movement policies, not timings inferred from generic spell metadata.

## Feeding, growth and Smite

Each qualifying large/epic monster last hit feeds once, or twice when bonus
stock is available. Consuming one bonus treat grants 20 gold. Medium and small
monsters do not feed the quest. Feed count caps at 35; later kills retain the
current kill recovery/XP adapter without consuming bonus stock. Native kill-credit
sharing and the complete post-quest reward lifecycle remain unfinished.

The local bonus clock starts 90 seconds after ownership, adds stock every
60 seconds before first evolution and caps stock at five. First evolution resets
the next deadline to 90 seconds later, with 90-second intervals thereafter.
Full growth stops this bonus clock. Source values retain 60/90-second intervals;
startup, phase reset and stock cap are local bindings requiring comparison.

| Earned feeds | Smite | Monster damage | Additional behavior |
| ---: | --- | ---: | --- |
| 0–14 | Smite | 600 | Existing base targeting |
| 15–34 | Unleashed Smite | 1,000 | Enemy champions: 40 true damage and 20% slow for two seconds |
| 35 | Primal Smite | 1,400 | Same champion effect; monsters within 425 units of the primary target are also hit |

All stages retain the existing two-charge system, 15-second cast lockout,
90-second sequential recharge and bounding-radius cast range. Area damage
spends one charge. Growth changes the source icon and HUD description; full
growth chooses the corresponding variant icon. Upgrades do not grant the
unimplemented final shield, movement or burn/slow item passives.

The renderer loads only requested companion rigs and uses selected source spawn,
idle, run, attack, heal, Smite and transform clips. Saved pose clocks drive
absolute mixer sampling. Baby remains visible until 35 feeds, when Adult is
selected. This form rule is a local lifecycle binding: the authored initial
hidden Baby flag alone does not establish native pet growth. Owner death hides
the actor and clears combat/path commitments while preserving feeding and
bonus clocks. Visibility follows owner visibility; the pet does not reveal fog.
Native scale, graph transitions, effects, audio and visual parity remain open.

## Saves and verification

Schema 99 captures owner, variant, movement interpolation/path clocks, target,
strike/release clocks, source pose, feed/bonus stock, first-monster flag, treat
deadline and both evolution ticks. It also saves independent Smite slows. Strict
validation checks ownership, Smite loadouts, fixture scope, phase-aligned treat
deadlines and consistent earned evolution. Existing incompatible save handling
applies.

[The current verification ledger](reference/owned-companions-verification.json)
records exact checks, browser setup limits, rendering evidence, captures and
production results. Unit and controlled Chrome checks do not certify native
behavior, full-match balance or performance. Purchased-item consumption, final
passives, standard role binding/modifiers, jungle bot decisions, epic objectives
and complete seeded browser matches remain required work.
