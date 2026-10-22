# Crest of Insight

Killing Blue Sentinel now grants its champion last hitter a two-minute buff.
It gives 10/15/20 Ability Haste at champion levels 1/6/11 and restores mana.
The human HUD shows the source icon, a countdown and a remaining-duration bar;
a hover description and accessible label expose haste, regeneration and transfer behavior.
Receiving another Crest refreshes one record rather than stacking its effects.

## Evidence and remaining calibration

[The source pin](reference/crest-of-insight-source.json) retains the manifest,
archive/chunk/member hashes, three selected RST strings and the original 64×64
BuffCampBlue DDS conversion. The icon name comes from the previously pinned
Crest script metadata. The frozen `lol.stringtable` describes a two-minute buff,
300-second Blue respawn and transfer to its holder's killer. Its regeneration
formula retains `@f2@ + @f3@%` per five seconds; the numeric bindings were not
recovered. The descriptions alone do not certify active native dispatch.

Riot's [26.14 notes](https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-14-notes/)
establish the haste tiers. Its [11.16 fix](https://www.leagueoflegends.com/en-us/news/game-updates/patch-11-16-notes/)
establishes retention on execution to non-epic jungle monsters. The
[26.1 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/)
remove Baron-corrupted/global buffs and the jungler's extra 30 seconds on
champion transfers; elemental-terrain second drops remain.

The following runtime details are explicit **provisional local policies**:

- Mana regeneration is 25 flat plus 5% maximum mana per five seconds, delivered
  in half-second pulses. A pulse uses the current maximum and clamps at full.
  Garen receives haste with no invented mana pool. Energy champions are absent.
- A champion kill transfers using existing kill credit, refreshes the full
  duration and resets pulse phase. This includes a credited execution or a
  posthumous kill. An uncredited Gromp/Blue/Red execution retains the original buff
  deadline; an uncredited structure execution removes it.
- Buff time continues during death, recall and ordinary play, and freezes with
  the simulation when paused. Dead owners receive no mana and bank no pulses.
  Expiry runs before commands; the final deadline has no regeneration pulse.
  Diagnostic time jumps skip missed pulses rather than awarding a resource burst.

Native formula bindings, pulse phase, transfer refresh, complete death credit
rules, buff particles/audio and comparison with the native game remain open.
Elemental Rift, wisps, Smite eligibility/sharing and jungle-role bots remain
required future work. This increment does not certify a full jungle match.

## Integration and continuation

Item and buff haste add for spell resources and newly captured cooldowns.
Summoners and cast windups retain their existing timing. Running cooldowns,
Hawkshot recharge and Judgment's captured cooldown keep their original deadline;
each later recharge cycle reads current total haste. Level changes update the
buff's haste tier without rewriting a running cooldown.

Schema 94 owns one nullable buff record per champion: start, expiry and next
regeneration tick. It validates duration, phase, ownership and non-expired state,
including dead owners. Old schemas remain incompatible without silent migration.
The ruleset fingerprint includes the new content and simulation modules.

## Reproduction and validation

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-crest-of-insight.py
npm run check -- --maxWorkers=4 --testTimeout=30000
npx playwright test e2e/blue-sentinel.spec.ts e2e/champion-purchases.spec.ts e2e/champion-casting.spec.ts --workers=1 --timeout=60000
npm run test:production
```

The source extractor verifies selected strings and repeats against the committed
pin. Source and gameplay checks cover grants/refresh, independent ownership,
level thresholds, items, kit cooldowns, mana pulses/max-mana changes, death,
execution credit, posthumous transfer, expiry and invalid saves. Chrome extends
the real-input Blue encounter with the source icon, HUD countdown, exact buff
reload and removal after expiry. The clear itself uses a diagnostic final hit;
this is not a complete seeded match or native visual comparison.

Final commands, counts, capture hashes and limitations are in
[the verification ledger](reference/crest-of-insight-verification.json).
