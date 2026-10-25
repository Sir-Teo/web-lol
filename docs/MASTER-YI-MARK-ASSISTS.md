# Alpha Strike mark assist credit

Schema 145 adds incoming `alphaMarkContributors` to each champion. An accepted
local Q mark records its caster and current tick on a champion target before
first-contact damage. Later marks refresh that source's single entry. Dummy,
monster, structure and ward targets do not receive champion assist history.

The retained community reference's V6.21 note states that Yi becomes eligible
for assists when Alpha Strike bounces to a target, before its delayed damage.
This is a historical behavioral lead, not a controlled standard 26.18 native
callback/timing capture. The exact retained quote, revision/hash and standard-mode
configuration are in [q-assist-reference.json](reference/masteryi/q-assist-reference.json).
The mark callback uses the existing local fourteen-update pulse; it does not
relabel that cadence or the development presentation as recovered native behavior.

Incoming marks are separate from actual damage and execution-credit history.
When an allied champion receives a kill, recent markers join the existing direct
assist set, using the pinned standard-mode 15-second window with the existing
inclusive tick convention. Multiple marks, damage and reveal participation still
produce one awarded assist per caster. Existing one-hop allied support rules
continue to apply. A marker cannot replace the actual attacker for turret
execution credit or turn an otherwise uncredited execution into a Yi kill.

An awarded mark assist uses the existing Highlander takedown callback once. A
live active R extends; learned R refunds remaining Q/W/E cooldowns. Posthumous
eligibility can trigger its passive refund without recreating an active buff.
This change adds no assist-gold formula, target-area vision, turret-aggro policy,
source effect or audio binding. Those systems retain their existing scope.

Histories are saved even after they cease to qualify; the time filter controls
eligibility. Victim respawn clears them alongside incoming damage/support/reveal
history. Decoding rejects duplicate, unknown, allied, foreign or unlearned
sources, future/fractional/negative ticks and records after the victim's death.
A dead Yi with learned Q can remain a valid source. The field is mandatory under
schema 145; older schemas and fingerprints remain incompatible without migration.

The original focused reproduction lost an assist while Q's first mark was
pending and the target still had full health. The expanded checks cover the
qualifying boundary, repeats, independent casters, execution attribution,
Highlander, posthumous credit, respawn and exact saved futures. Validation and
build evidence are recorded in
[mark-assist-verification.json](reference/masteryi/mark-assist-verification.json).

The 23 new cases pass alongside the existing Q/R checks (109 focused cases).
The full one-worker run passes 2,413/2,416 across 347 files, including all 234
Master Yi cases. The same three source-audit failures remain: missing Leona
research input, missing original distortion artifacts and the unchanged Lux
sampler digest. TypeScript, three Node QA cases and build pass.

All three focused browser cases pass: an actual pending Q mark and later assisted
kill/Highlander extension through real Save/reload, the existing NPC marked-Q
checkpoint, and human/NPC private save isolation. The new case proves full target
health and empty damage history before saving, identical checkpoint bytes and a
300-tick future after the same allied kill, one assist, one R extension, and the
visible personal score. It reports no page errors. The final tooltip copy also
explains assist eligibility. Native timing, presentation and full-match gates
remain open.

Nested production smoke passes 32 recordings and the existing real spell,
purchase and save/restore checks under a host prefix. Both exact Yi fixture URLs
remain disabled, with no development hook or Yi rig preloads. Ruleset
`01df38573feae5954330b5a1a2ca9dad87d320d0ec3b024ba2a31d971bb96022`; pack
`e663ac994747306aa587d489212542c13de96c9afd874a6f26966f743f834011` has
1,073 files / 526,662,603 bytes. Public asset bytes are unchanged.
No fresh full-browser/offline/native/performance certification is claimed.
