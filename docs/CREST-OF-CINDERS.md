# Crest of Cinders

Red Brambleback last hits now grant one refreshing, two-minute champion buff.
It adds a true-damage burn and slow to basic attacks, plus maximum-health
regeneration that pauses after qualifying damage. Champion kills transfer it;
uncredited non-epic monster executions retain its original deadline. Blue and
Red buffs coexist independently. The human HUD uses the original Red icon,
countdown, duration bar and current-value description. Visible targets show a
burning status without revealing hidden units.

## Source evidence and provisional rules

[The source pin](reference/crest-of-cinders-source.json) retains two original
Lua metadata members, selected frozen RST strings, their manifest/chunk/member
hashes and the script-selected 64×64 BuffCampRed DDS conversion. The scripts
name the buff/slow and death persistence but contain no gameplay implementation.
The tooltip describes transfer and health regeneration except after damage from
champions, turrets or epic monsters. Its four numeric formula bindings remain
placeholders. The legacy monster description says two-minute duration and a
three-second burn; it does not establish current native pulse dispatch.

Riot's [26.1 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/)
give healing of 0.5/1/1.5/3% at levels 1/4/6/11, melee slows of 10/15/20%, ranged
slows of 5/7.5/10%, and burn endpoints of 15–54. The earlier unchanged ranged
slow in [13.14](https://www.leagueoflegends.com/en-us/news/game-updates/patch-13-14-notes/)
lists thresholds 1/6/11. The frozen tooltip says the ranged slow is halved.
The [11.16 fix](https://www.leagueoflegends.com/en-us/news/game-updates/patch-11-16-notes/)
supports retention on non-epic executions; 26.1 removes the extra 30 seconds for
jungler champion transfers.

The following are explicit **provisional local policies**, pending native
formula bindings and controlled reference captures:

- Total burn damage interpolates linearly from 15 to 54 over champion levels
  1–18. Three equal true-damage instances occur at application, +1 and +2 seconds.
  This local schedule remains distinct from the legacy three-second description.
- One burn record per target refreshes its owner, captured damage and deadline
  while preserving pulse phase. Refresh adds no extra immediate instance. Ashe's
  Q flurry applies on-hit once, not once per visual projectile.
- Slows last three seconds, use levels 1/6/11 and combine through the existing
  strongest-slow rules. Garen's upfront tenacity shortens them; his Q can cleanse
  the slow without removing the burn. Garen is the current melee kit; Ashe/Lux
  use ranged values.
- Healing uses current maximum health and owner level, with half-second pulses
  and a five-second lockout after positive pre-shield enemy champion/turret
  damage. Non-epic monsters and minions do not block it. Epic monsters are not
  implemented. Damage before acquiring Red still contributes to the lockout.
- Expiry runs before commands; healing runs after combat, so a same-tick hit
  blocks a scheduled pulse. Dead owners receive no healing and bank no pulses.
  Pause freezes simulation clocks. Diagnostic time jumps skip missed pulses.
- Champion transfer uses existing kill credit and refreshes duration/pulse phase,
  including credited executions and posthumous kills. True non-epic execution
  retains the old deadline; an uncredited structure execution removes it.

## Combat and continuation

The shared basic-attack impact path covers ranged impacts and Garen's melee/Q
release. Buff ownership and level are sampled at impact. Lux spell hits and Judgment do not create on-hit burns. Structures,
protected emergence and returning monsters reject the effect. Shields absorb
true damage normally. The existing damage path supplies aggro, recall
interruption, assist/kill credit and neutral rewards. A burn survives the owner's
buff expiry or death, but target death or a monster reset clears it.

Schema 96 retains each owner's buff/pulse clock and healing lockout, plus each
target's burn owner, captured damage, last application, expiry and pulse phase.
It validates finite damage values, source ownership, exact clocks and slow
values/duration, including checkpoints during death or after the holder's buff
has expired. Older schemas remain incompatible without silent migration.
Generated Blue/Red status metadata now describes their implemented rewards.

Native particles/audio, cumulative burn-number presentation, formula/timing
calibration, overlap behavior, Elemental Rift wisps, Smite eligibility/sharing,
other camps and complete jungle-role matches remain unfinished. The new status
text and source HUD icon do not establish native visual parity.

## Reproduction and validation

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-crest-of-cinders.py
npm run check -- --maxWorkers=4 --testTimeout=30000
npx playwright test e2e/red-brambleback.spec.ts e2e/blue-sentinel.spec.ts e2e/garen-player.spec.ts --workers=1 --timeout=60000
npm run test:production
```

Fourteen new source/simulation cases cover grants, refresh, independent crests,
actual attack paths, burn boundaries, shields, protected/structure targets,
level tiers, healing lockouts, death/transfer, posthumous credit, expiry,
neutral last hits and invalid saves. Chrome extends the real-input Red encounter
with both buff icons, a real Cinders attack, target status and exact saved pulse
continuation. Red's final clear and calendar jumps remain diagnostic.
Results, commands, capture hashes and limitations are retained in
[the verification ledger](reference/crest-of-cinders-verification.json).
