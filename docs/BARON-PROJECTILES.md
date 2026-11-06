# Private Baron ranged basic attacks

The controlled Baron encounter now releases a travelling attack rather than
applying damage instantly at release. Root's ordinary attack slot has probability
zero; its sole extra attack has probability one and selects `BaronBasicAttack`,
record `{ce95a4c4}` in the frozen character pin. That spell agrees with Root's
cast time and declares a `FixedSpeedMovement` missile at 1,300 units/second.
The profile generator now verifies that selection and preserves the declared
start/hit bones, height offsets, cast type and effect keys separately.

The existing local attack adapter supplies homing, an eight-unit collision
radius, a 4,000-unit flight budget and ground-relative presentation. These are
adapter policies, not recovered native width, targeting or range semantics.
Source JawBot/chest attachment, height offsets and particle/audio dispatch are
not yet implemented. A small, explicitly named provisional sphere marks the
flight in this private scene; it does not borrow Ashe's arrow or claim native
appearance. No new external asset or public encounter is activated.

Windup remains 17 ticks and attack period 96 ticks. At the existing stationary
450-unit encounter distance, damage now follows release by 18 more ticks (19
movement updates including the release tick). This timing includes the local
collision radii and is not native-client calibration. Damage is captured at
release. Source death preserves a released attack; target death retires it.
A target Flash extends the homing flight, without an immediate hit or a speed
change. No corrosion, cleave, poison, full boss kit, reward or live calendar is
added by this change.

## Saves and validation

In-flight state uses existing projectile fields. The previous decoder assumed
that every monster missile required Gromp presentation history. Baron now has a
separate checked path: neutral team, declared speed, local radius/range budget,
valid launch/origin and eligible target. Gromp and other monsters retain their
existing history guard. The private host/encounter admission remains required.
No snapshot field changes; schema stays 163, with fingerprint
`e20bdcb81f74cf79399347c31c7b163879eb1541316841afc382ac03a365d853`.
Older snapshots retain their earlier build identities.

Three initial tests reproduce the original gap: speed zero instead of 1,300 and
health already reduced from 610 to 331.837 at release. Twelve new tests now pass,
including in-flight saves/futures, source/target death, Flash and seven edited
projectile rejections. All 169 focused cases pass across thirteen files, as do
source-profile reproduction, TypeScript and production build.

All five Baron browser scenarios pass. A real right-click starts combat, pauses
at the first missile and observes full player health during flight. Its
provisional marker is visible; Save match/reload restores exactly and the next
180 ticks match. Existing file isolation, ordinary-save preservation, Lux root
resistance, Smite and cleared-save cleanup also pass. The flight screenshot was
reviewed. The [verification summary](reference/baron-projectile-verification.json)
records the observed packet and scope. Earlier production/offline reports are
not relabeled as checks of this new build; full-match checks follow separately.
