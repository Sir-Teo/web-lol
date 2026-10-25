# Ahri E — Charm development controller

Target: standard PC Summoner's Rift 26.18, frozen Riot build 16.18.8175716.
This checkpoint adds manual Charm learning and casting to the existing non-player
Ahri fixture. Ahri remains outside player selection and the production Rift roster.
R, the passive and native presentation remain unfinished.

## Source contract

`tools/assets/export-ahri-e.py` guards the committed character, names, Data Dragon,
declarations and model identities through the existing declaration loader. It checks
all four named values, the root damage calculation, client first-enemy intent,
directional child movement and ordered child behaviors. Normal Python and `-O`
checks both pass; a differing existing generated table is rejected.

| Declaration                 | Retained value                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| Root cast time / commitment | 0.25 seconds; cannot cancel while winding up; always snap facing.                                        |
| Cooldown / mana             | 12 seconds / 60 at all ranks.                                                                            |
| Named magic damage          | 80/120/160/200/240 + 0.8500000238418579 AP.                                                              |
| Named Charm duration        | Approximately 1.2/1.35/1.5/1.65/1.8 seconds; original floats retained.                                   |
| Named slow                  | Negative SlowPercent −0.6499999761581421; movement multiplier is 1 + this value.                         |
| Child missile               | Fixed speed 1550; no tracking; projected to its cast range; authored width 60.                           |
| Distinct ranges             | Client/root display 975; root raw 10000; child cast range 1000 and display override 1175.                |
| Distinct generic speed      | Root generic missile speed 1200 is retained separately from the child speed.                             |
| First-hit intent            | Client tooltip, Ranged_StopsFirstHit tag and child CastOnHit → DestroyOnMovementComplete → DestroyOnHit. |

The child legacy damage/duration tables differ from root named calculations and
remain in the source reference. The root buff contains description and VFX data;
it does not provide native forced-walk, cleanse or tenacity code. Root and child
omit disabled/dead permissions. The numeric ability-slot control value 3 has not
been decoded as a native priority rule.

The independent cache-only audit reparses all 64 committed BIN records and checks
six input identities. Its findings SHA-256 is
`a1c718273e4d9029cc153794a2ba6ec79a89c55ea9941bdf814d5775ed6cbb2c`;
its checker SHA-256 is
`28797962b9046c444a55d5fb46acf446d16bf8a80b2de45fbece8c7f6c53e1ff`.
The checker passes normally and under `-O`; no client process or native frames were used.

## Explicit local policies

- Acceptance pays resources, starts the hasted cooldown, cancels recall and an
  ordinary attack, and commits a 15-tick pending cast. Later control does not
  cancel this non-channel windup; death before release does. The imported
  `spell3_north` body clip is an explicit binding. Native directional graph rules
  are open. Shared pending-cast exclusion permits Heal; E/Flash windup combos
  are not implemented or claimed as native behavior.
- A linear missile projects 1000 units even for a nearby aim. Width 60 is treated
  as collision radius. Sweeps select the first living vulnerable enemy by
  contact fraction, then unit ID. Allies, structures, wards, emerging protected
  monsters and resetting monsters do not consume it. Terrain does not intercept
  it. Collision masks, native width semantics and endpoints remain unverified.
- On contact, apply captured magic damage, then attach Charm only if the target
  survives. Latest Charm replaces previous Charm source and clock. Duration
  rounds to 60 Hz and samples the existing Courage tenacity policy on impact;
  the saved flag is checked against that buff's retained clock.
- Charm cancels recall and ordinary attack windup, suppresses new orders, attacks,
  wards, recall and non-permitted spells, and leaves permitted Heal available.
  Existing non-channel casts and authored uncancellable empowered attacks can
  finish. Existing Judgment behavior continues, consistent with this simulator's
  stun policy. This is a local control model, not recovered native CC precedence.
- Forced walking uses ordinary wall-aware movement toward the caster's current
  position and stops at summed body radii. Root blocks walking; stun suspends it.
  Slow stacking takes the strongest multiplier. Leona's dash stops immediately
  and records the actual Charm deadline as its interruption cause.
- Charm suspends jungle movement decisions while preserving emergence housekeeping.
  Scuttler's lifecycle deadlines continue before control takes movement ownership.
  Resetting monsters remain protected. Ordinary behavior resumes at expiry; an
  expired Charm clears its owned move order and path before accepting new commands.
- A launched missile and attached Charm can outlive the caster, following its
  retained corpse. Target death clears Charm; terminal settlement clears both
  control and flights. These ownership policies remain unverified against native play.
- The pink sphere is a named development marker. Native missile/impact/target VFX,
  audio, forced-walk animation, hair/tail dynamics and full material rendering are open.

## Save and verification boundary

Schema 134 adds mandatory nullable Charm control and a strict Charm projectile
variant. Saves validate source/rank ownership, sampled control duration, eligibility,
missile origin, normalized direction, speed, width, travel, remaining range and
previous position. Old schemas intentionally reject under the same-build policy.

The full check passes 2,133 tests across 335 files, TypeScript and three Node QA
checks. Twenty-three Charm tests cover all ranks and captured AP, first-hit and
stable tie ordering, terrain/range, protection, forced walking, death, control
interactions, Courage sampling, committed attacks/casts, dash interruption,
terminal settlement, edited-save rejection and 300-tick continuation.
A regression test first exposed the neutral-order save restriction; its failing
and repaired runs are retained. Two earlier fixture failures (wrong owner charge
assertion and regenerating damage target) were corrected without weakening the
combat assertions.

Thirty-four targeted Chrome scenarios pass in one run. The four Charm cases
cover the source body clip, pink marker, visible CHARMED status, forced walking
and actual Save match/reload in windup, flight and control. Every reload preserves
the exact saved bytes and 300 future ticks. Flight/control screenshots were reviewed
at 1440×900. The other cases retain Ahri NPC/Q/W, Leona rig recovery, Garen/Lux
controls, champion selection, animation and match-file coverage.

Production smoke passes 32 recordings from a nested path, with no development
hook, no Ahri fixture and no unrequested Ahri preload. Offline checks pass with
963 service-worker responses and no production errors. Pack `f71553bde9aa7bb59aa464955a5ff85a59e1fc56af452d4cf4f49c1e503d6ac9` has
1,064 files / 520,027,022 bytes. Ruleset:
`70aed54770ed65de1c7c43ee21cadea61b495a0fbe6abfce55819bcf6cb0a567`.

The new pinned Data Dragon 16.18.1 `AhriE.png` is 6,464 bytes, SHA-256
`f17a5c92b47e07664b9248428e4ff577b4ece3ebc24cd166b0710457497788f5`.
All 1,012 other prior public files remain byte-identical; the reference manifest
changes only to retain the new icon. No production champion option is added.

Frozen evidence: [e-verification.json](reference/ahri/e-verification.json).
Run `node tools/qa/verify-ahri-e.mjs` for the current checkpoint, or add
`--historical` after later edits to verify the retained source/build closure.
Native behavior/presentation, full Ahri kit, performance and full-project flags
remain false. This checkpoint does not satisfy those remaining gates.
