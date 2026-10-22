# Krug camps and saved split waves

Both source-linked Krug camps now enter the interim lane match at the published
67-second first-ready baseline. Each starts with one Ancient Krug and one medium
Krug. The Ancient's death queues four minis; the medium queues two. The lane
catalog now has twelve calendars and ten source monster rigs. Initial complete
camp emergence adds four monsters to the preceding 24; descendants replace their
parents as they die. This does not complete jungle roles, objectives or the full
match goal.

## Source and explicit adapters

[The new source pin](reference/krug-camps-source.json) retains all three base
skins/graphs, 35 unique Map11 archive members, six original script files and the
legacy construction/locator windows for camps 5/11. The original character,
script and map parent pins remain unchanged. Four unique named locators link the
two initial members on each side; descendant positions are not invented source
locators.

The three character scripts contain only RETURN. The three spell scripts,
including `sru_krugspawnmanager`, contain metadata rather than death callbacks.
They do not establish the active native split controller or respawn-timer anchor. Root also contains
legacy child-spawn missile definitions with 1.25-second fixed travel; those are
retained in the character parent pin, rather than interpreted as an active
modern callback.

Riot's [12.22 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-12-22-notes/)
change Ancient death to four minis and publish a one-second death/smaller-spawn
baseline, a four-CS camp total, a 650-unit leash and marked cleanup. The local
adapter uses that published Ancient split and one-second delay. Medium-to-two
minis remains an explicit local retained policy, consistent with Root's 0.5
medium CS and 0.25 mini CS; the current native callback is still unverified.
Riot's [26.1 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/)
supply the 67-second first-ready baseline. These choices combine frozen client
records with published gameplay baselines; they do not certify one native server
version.

Legacy SpawnDuration 0.86 rounds to 52 protected ticks. The legacy leash is 900,
while local gameplay uses the published 650 baseline. The existing 135-second
respawn adopts the legacy shared default. Base skin 0 is selected locally; both
legacy `SkinOverrides` reads remain unresolved external globals.

Order initially uses `spawn` on both parents. Chaos uses `spawn_nj` on the
Ancient and `spawn_north_jung` on the medium. Source pose tails continue beyond
readiness. Atomic aliases preserve exact graph keys, including the unresolved
small normal-idle key. Source corpse animation lasts about 3.933 seconds and is
retained at its source duration; the native death-playback/one-second split
relationship remains uncalibrated.

| Root scalar | Ancient | Medium | Mini |
| --- | --- | --- | --- |
| HP | 1400 | 650 | 60 |
| Damage | 57 | 20 | 13 |
| Armor / MR | 42 / 42 | 20 / 20 | 20 / 20 |
| Movement speed | 250 | 400 | 400 |
| Attack range | 150 | 110 | 110 |
| Base attack speed | 0.6129999756813049 | same | same |
| Primary cast frame | 18 | 12.555000305175781 | same |
| Local contact / period, ticks | 36 / 98 | 25 / 98 | 25 / 98 |
| Gold / XP | 15 / 15 | 10 / 10 | 14 / 16 |
| CS | 2 | 0.5 | 0.25 |
| Gameplay / navigation radius | 100 / 85 | 50 / 50 | 25 / 30 |

A local complete clear pays four CS, 109 gold and 121 XP under the current
Root-only reward policy. No buff is granted. Native scaling, role/item reward
modifiers, percentage-current-health on-hit damage and small-Krug attack-speed
initialization remain unfinished; tool metadata is not treated as a live modifier.

Large/medium/mini rigs contain 2,477/1,624/1,624 triangles, 46 bones each and
17/16/16 atomic clips. Source skinScale is approximately 1.15/0.75/0.475; original
diffuse assignments use the existing unlit conversion. Repeated extraction
matches the pin and all three GLBs/manifests/export reproduce byte-identically.

## Ownership, births and cleanup

Each camp owns eight ordered slots: two initial parents, four Ancient offspring
and two medium offspring. Only the first two spawn with the calendar. A split
wave captures its parent slot/ID, death point/facing, death/ready ticks, champion
attacker and pending/spawned/cancelled status. It is independent of the corpse.
Even if both parents die and every live slot is temporarily empty, the camp
waits for its queued descendants instead of scheduling respawn early.

After exactly 60 ticks each pending wave creates its children once. The local
layout places them radially 90 units from the captured death point and projects
their homes through the imported navigation grid using the source navigation
radius. Initial homes use the same reachable-placement adapter. Original parent
locators remain unchanged in content. These positions and the choice to reset
to each birth home require native comparison.

Children enter ready without a launch animation or missile. They inherit the
captured champion attacker when it is alive, valid and within their leash;
otherwise they enter idle. Native launch particles/audio, child movement and
aggro ordering remain open. The loader prepares all three rigs before the match
resumes, including saves containing only pending offspring.

A living Ancient still provides nearby shared reset behavior. After its death,
each live descendant owns a ten-second marked clock, refreshed by the existing
local champion-combat classification. Offspring receive their clock at birth.
Marked cleanup cancels any new split from an unclaimed medium and gives no
last-hit rewards. Native cleanup/split ordering remains unverified. Only final
removal with no pending wave starts the respawn calendar; the next cycle clears
all wave metadata and creates two fresh parents.

## Saved continuation and verification

Schema 96 retains wave metadata and eight-slot ownership. It checks parent and
child slots, duplicate parent identities, available corpse/death evidence,
exact pending deadlines, lifecycle status, captured champion identity, derived
child homes, marked clocks and the empty-pending distinction. It rejects a lost
wave, an early child, a crossed parent or a forged child home. Fractional scores
retain the six-decimal policy and whole-number HUD display from raptors.

Eight new checks cover source/rig/script linkage, both initial emergence
variants, corpse-independent pending continuation, simultaneous parent deaths,
medium-first shared reset, reward-free cleanup cancellation, partial descendant
clears through respawn and invalid wave saves. The explicit corpse removal in
the pending-wave check is diagnostic; ordinary source corpse retention exceeds
the one-second birth delay.

Commands, final hashes, focused Chrome results, reviewed captures and production
results are recorded in [the verification ledger](reference/krug-camps-verification.json).
Native rendering/graph parity, the complete browser suite, full-role matches,
performance and delivery/offline certification remain open.

Reproduce the sources with:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-krug-camps.py
node tools/assets/convert-roster-base.mjs SRU_Krug
node tools/assets/convert-roster-base.mjs SRU_KrugMini
node tools/assets/convert-roster-base.mjs SRU_KrugMiniMini
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/export-krug-camps.py
```

All 1,167 checks across 229 files and TypeScript pass. All seven focused Chrome
camp cases pass together, including initial/descendant GPU contributions, real
Lux attacks/Binding/Singularity, exact fighting/pending/partial/cleared reloads,
2.75 internal CS with HUD 2 and a fresh parent-pair respawn. Setup, final kills
and calendar jumps are diagnostic. Both captures were visually reviewed.
Production build and `/nested/rift/` static-host smoke pass with 17 recordings,
all three Krug rigs across lane start/restart, no jungle preview requests and no
development hook. All GLBs and the map validate with zero errors/warnings.
The existing bundle warning remains (635.99 KB game and 659.92 KB Three chunks).
