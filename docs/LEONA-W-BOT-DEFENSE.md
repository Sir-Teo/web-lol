# Development Leona's defensive Eclipse

AI-controlled Leona fixtures can now queue Eclipse against visible committed
champion/turret attacks. They use the ordinary cast command and existing W
simulation/presentation paths. This adds local self-defense to the
[bot setup](LEONA-BOT-SETUP.md); tactical Q/E/R, proactive engage/peel and complete
support-role match behavior remain open. It does not enable player or ordinary
Rift Leona selection and is not recovered native bot AI.

## Decision and command contract

The local anticipation horizon is 45 ticks. The planner considers an observed
attack windup directed at Leona or a visible launched basic-attack missile that
can reach her before its remaining travel expires. It requires more than one
tick until the estimated contact, leaving time for next-tick command dispatch.
The source must be a champion or turret. A visible missile remains observable
when its attacker leaves sight; a hidden missile or hidden attack intent cannot
trigger defense. Proximity alone is insufficient.

W must be learned, ready, affordable and inactive; stun and silence suppress the
decision. Root allows W through the existing cast rules. The defensive check
runs before the ordinary action/windup path, so it can queue protection during
an accepted Zenith windup. Command dispatch still validates the cast and pays
mana/starts cooldown. The existing W path preserves the E animation and captured
windup; no spell-state bypass or direct defense toggle is added.

The shared observable-attack forecast also serves Garen's existing Courage
planner. A regression exposed an incorrect second range check: a captured attack
can still land in this implementation after its target moves beyond nominal
reach. The forecast now follows the committed windup and remaining flight time.
It continues to exclude interrupted ordinary windups while treating the existing
noncancellable Garen/Leona Q captures as threats through their allowed disable
states. Sight is checked before reading opposing intent, health and position.
This change matches the local combat scheduler; it does not certify native
range-leeway or cancellation behavior.

## Verification

Eleven new unit cases cover both teams, a paid queued cast with real damage
reduction, exact saved futures, observed missiles after source sight loss,
hidden missiles/intent, other targets, resource/control/cooldown/horizon guards,
active-W/proximity rejection, root, an accepted Zenith windup and displaced
committed attacks against both Garen and Leona. The two displaced-Garen regressions
fail before the range correction; their original failure log remains retained.
The final focused set passes 37 cases with existing Garen W, Eclipse and bot setup.

The full standard check passes 1,903 units in 312 files, TypeScript and three Node
QA tests. Nine browser cases pass the new defense, existing bot setup, Garen
protection and all six Eclipse surface/recovery/visibility/lifecycle checks. In
the new browser encounter, hidden intent queues zero W casts, the visible attack
queues one, and its saved future stays identical. At the sampled active frame,
30 surface models contribute 38,632 changed pixels when isolated from the frame;
GL errors are zero. That is a model/pixel observation, not all-family or native
frame acceptance. The source screenshot is inspected.

The [verification ledger](reference/leona/w-bot-defense-verification.json) records
exact source, test, browser, production and offline-pack evidence. The offline
verifier checks their frozen hashes without launching the game or browser. Production passes 32 nested-path recordings with no development hook or
unrequested Leona preload. All 966 public files remain byte-identical. Offline
pack `81b2a1a69f51cb8eb69e6edaf26f0589524c83b2a8a700e2520efe5e9b7baacf`
contains 1,012 files / 513,310,008 bytes; integrity, repair, saved offline boot
and atomic version controls pass with 963 worker responses and zero production
errors. Schema 126 uses ruleset
`2e3fa5b7448b670769c35a31c97071db899644f67e678246829503e5d0175fb6`.

No new source asset is introduced. There is no new normal-match
cohort, performance, native AI or full support/player acceptance claim.
