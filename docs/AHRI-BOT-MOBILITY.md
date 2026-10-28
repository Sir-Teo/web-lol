# Ahri bot Fox-Fire and retreat dashes

Development Ahri bots now use Fox-Fire against an observed champion within
550 units of the caster's center. Charm retains first priority; close Fox-Fire
then precedes Q poke. This center cutoff is a conservative local policy, not a
promise that each moving flame will acquire the target. The existing controller
selects each flame's actual visible recipient and applies ordinary/repeated
damage. Bots avoid duplicating their own waiting orbits.

During retreat or the shared outnumbered disengage decision, Charm still comes
first. If it is unavailable or blocked, a learned, ready Spirit Rush can move
away from observed nearby threats. Six directions consider direct escape,
home, diagonal escape and perpendicular escape. The existing bounded endpoint
correction chooses walkable landing ground. A candidate must travel at least
200 units, improve the minimum distance to all observed threats within 1,150
units by at least 150 units, and avoid the existing observed turret-danger
check. The nearest threat must be within 700 units, and the bot must be outside
its 400-unit home radius. Remaining ties retain deterministic candidate order;
clearance is scored with a small homeward preference.

The chosen dash uses the ordinary next-tick cast queue. The bot holds its
evaluated origin until dispatch. Root, silence, stun, committed windups,
recall, mana, rank, cooldown and current-dash restrictions retain their normal
boundaries. Stored R recasts respect their existing one-second lockout, consume
no additional mana and stop at exhaustion. If escape cannot be used, close
Fox-Fire can instead supply its existing decaying movement boost, with an
explicit homeward order continuing after its windup. No offensive R pursuit
is introduced.

Only team-visible champions enter the threat list. Changing an unseen enemy's
position cannot change the escape aim, and losing sight after a decision does
not update the copied command. Physical collision and bolt/flame acquisition
remain the spell controllers' responsibility. Human Ahri remains manual, and
the public champion chooser and ordinary roster remain unchanged.

The subsequent [Q farming step](AHRI-WAVE-CLEAR.md) adds observed wave casts.
This is local tactical tuning. Native AI, offensive R,
prediction and a full Ahri bot Rift trial remain open. No public asset,
renderer, saved field or source spell number changes. Schema remains 163;
the same-build rules fingerprint changes with the simulation sources.

Verification commands:

```sh
npx vitest run tests/ahri*.test.ts tests/bot-disengage.test.ts tests/bot-flash.test.ts tests/bot-tower-safety.test.ts tests/lane-match.test.ts tests/snapshot.test.ts --maxWorkers=1
npx tsc --noEmit
npm run test:qa
npm run build
npx playwright test e2e/ahri-bot-combat.spec.ts e2e/ahri-bot-mobility.spec.ts
```

The focused run passes all 214 cases across eighteen files, including fifteen
new cases for both team orientations, actual three-flame hits, saved futures,
both defensive spells, range and resource boundaries, visibility independence,
unsafe terrain/turrets, multiple observed threats, queued-cast revalidation,
R lockout/free recasts/exhaustion and preserved human/attack control. TypeScript,
all 29 Node QA cases and the production build also pass.

The final browser batch passes all three cases without retries: the preceding
Q/Charm cases and the new W/retreat-R case. The new case renders three visible
orbit markers with the own W clip, records all three actual contacts, renders
the own R dash/bolt, then uses the real Save/reload path for an exact checkpoint
and 180-tick future with 211 finite posed bones. Both 1440×900 W/R captures were
reviewed. The first new run used a nonexistent test-only skeleton property;
the corrected probe traverses the existing model root. Its original trace and
failure remain in `artifacts/ahri-bot-mobility/browser/`; the clean batch is in
`artifacts/ahri-bot-mobility/browser-2/`. This host uses system Chromium through
an external launcher; the repository's default Chrome selection is unchanged.

The broad run passes 3,434/3,440 cases across 406 files. All six failing groups
also fail on untouched starting commit `5d90742`: the three Garen source-cache
checks, Leona's missing Python/native evidence, missing original distortion
libraries and the host-sensitive Lux missile digest. No assertion is relaxed
and no missing source is synthesized. Native fidelity and physical-device
performance are not certified by the fixture/browser checks.
