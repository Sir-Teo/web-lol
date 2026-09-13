# Ashe cast timing audit and implementation requirements

W, E and R currently create their projectiles immediately in `World.cast`. They do not yet have a saved windup state, movement lock or source cast animation. This is a material gameplay and presentation gap. Adding a clip alone would preserve the incorrect projectile timing.

## Verified selection

`python3 tools/assets/audit-ashe-cast-timing.py` verifies the cached character response against all four existing spell pins, resolves the character root's Q/W/E/R spellbook slots, joins each selected animation to the pinned base graph, and verifies the shipped GLB hash. The resulting [cast timing profile](reference/ashe-cast-timing.json) records exact values and hashes. Missing fields remain null; they are not silently interpreted as false or as engine defaults.

| Slot | Declared spellCastTime | castFrame | useAnimatorFramerate | Cannot cancel during windup | Source clip | Full clip duration |
|---|---:|---:|---|---|---|---:|
| Q | 0.25 s | absent | absent | absent | Spell3 | 1.633333 s |
| W | 0.25 s | 7.5 | true | true | Spell2 | 1.800000 s |
| E | 0.25 s | 11.3100004196167 | absent | true | Spell3 | 1.633333 s |
| R | 0.25 s | 7.5 | true | true | Spell4 | 2.100000 s |

Q additionally has `flags: 4` and `Trait_AttackReset`. The bitmask's complete meaning is not established by this audit. Q activation and E both reference Spell3; Q's empowered attack references Spell1 separately. Animation suffixes cannot safely be treated as ability-slot identifiers.

The [animation authoring guide](https://wiki.divineskins.gg/en/docs/lol/animations/animation-frame-rate) describes a 30 fps animation convention. That provides context for frame-valued data, but does not establish precedence between spellCastTime, castFrame, useAnimatorFramerate and spell-script overrides. In particular, E's frame value differs from W/R and its animator flag is absent. Do not derive a universal delay from castFrame alone. The current source profile preserves the distinction for implementation and capture comparison.

Q's explicit reset is corroborated by [Riot's patch 9.19 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-9-19-notes/). Its existing immediate reset must not acquire a generic quarter-second movement lock merely because the spell record has that declared cast-time field. Its activation animation and any animation mask/transition treatment remain separate research.

## Required runtime work

Introduce a renderer-independent pending cast containing ability identity, start/release deadlines, selected target point/direction and any required origin policy. Persist it in the strict snapshot schema. Successful cast validation must happen once, and spending mana/cooldown/charges must not happen a second time when releasing the projectile.

Separate cast start, release and recoverable animation playback. W/E/R must not release before the resolved windup deadline. Their full 1.6–2.1-second clips must not become movement locks. Render from saved simulation timing so late frames, pause, graphics recovery and restored games seek the same stage. Keep the source release-frame mapping separate from total clip length and attack-speed scaling.

Movement/attack orders issued during an uninterruptible windup need a defined deferred-order policy, rather than being dropped or cancelling the pending spell accidentally. Resolve native behavior for stun, death, Flash, Heal, other ability input, target invalidation and rapid queued commands before claiming complete interruption parity. `mCantCancelWhileWindingUp` alone does not classify each of those causes. Record any provisional policy explicitly.

Resolve whether direction, origin and target point are sampled at start or release, particularly when Flash or another displacement occurs during the windup. E's per-flight animation/particle launch epoch must begin at actual release; its charge spending and recharge deadlines need explicit start/release semantics. Existing minimap aiming should feed the same cast path.

## Acceptance coverage

- Check no projectile exists before release, exactly one release occurs at the deadline, and first-tick travel follows the chosen epoch.
- Verify mana, cooldown and ammo are spent exactly once through save/restore and repeated input.
- Verify movement and attack lock/deferred order behavior, cancel/reject cases, stun and death, and permitted summoner-spell interactions.
- Compare start/direction/origin behavior for battlefield and minimap targeting, including displacement during a cast.
- Check source animation phase at start, just before release, release, recovery and interruption; repeat after a late first render, pause, fresh saved rig and graphics loss.
- Update projectile-travel tests to use actual release as their epoch. Do not weaken their distance, collision, reveal or expiry assertions merely to accommodate the added windup.
- Capture reference spells at known simulation/animation phases and record tolerances before claiming exact timing or pixel parity.

This audit prepares the source contract and exposes unresolved semantics. It does not implement the pending cast state or change gameplay behavior.
