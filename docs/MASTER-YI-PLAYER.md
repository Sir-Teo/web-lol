# Master Yi human development fixture

Open `/?scene=fixture&champion=masteryi` on the development server. This private
practice scene gives the human player Yi's own stats, melee attacks, Double
Strike and [Q](MASTER-YI-Q.md)/[W](MASTER-YI-W.md)/[E](MASTER-YI-E.md)/
[R](MASTER-YI-R.md) controllers. Production and the Ashe/Lux chooser remain gated.
Role AI, native timing/presentation calibration and full champion delivery remain
open.

Hold Q over a visible eligible enemy within 600 range and release to cast Alpha
Strike. Its circle previews the cast range; ground-only release does not cast.
Right-click during the vanished phase to choose a return side. W/E/R activate
immediately. Move or Stop ends Meditate. Shared summoners, learning buttons,
practice tools and ordinary orders continue through their existing controls.

The HUD uses Yi's portrait, title and five exact Data Dragon 16.18.1 passive/spell
PNGs. Tooltips use own rank/resource/damage values, and the passive counter shows
0–3 stacks with a ready state. Q/W/E/R buttons show their active states. None of
these imply recovered native effects, sound or animation dispatch. The rig still
uses the documented development material and own source aliases; shared generic
feedback sounds remain local presentation.

Schema 144 permits a human Yi only when the caller supplies the trusted
`developmentMasterYi` practice context. That permission is never serialized.
Rift, ordinary fixture decoding, forged permission fields and lane-mode human
Yi saves reject. The private `development-masteryi-player-fixture` save key is
separate from ordinary practice and `development-masteryi-npc-fixture`. Loading
match files also requires the human champion identity before persistence.
Restart retains the human champion and resets through the same trusted scene.
There is no save migration across earlier schemas/fingerprints.

The five new icons total 27,656 bytes. Their exact URLs, byte counts and hashes
are retained in `public/assets/reference-manifest.json`; the fetcher can restore
them from the pinned source. Existing icon records remain intact. The Cinders
HUD description now follows the same melee classification as combat, including
Yi and Leona.

Validation evidence is recorded in
[player-verification.json](reference/masteryi/player-verification.json).

The focused run passes 87 cases in five files, including eight new player cases.
The full one-worker run passes 2,387/2,390 cases across 345 files, including all
208 Master Yi cases. The three prior failures remain the missing Leona research
input, missing original distortion inputs and unchanged Lux sampler digest.
TypeScript and three Node QA cases pass.

Seven distinct Yi browser cases have passing runs across retained batches. They
cover own HUD/icons/instant keys/Meditate pose/passive feedback and restart,
real unit-targeted Q with a mouse-selected return side, exact vanished human-Q
save/300-tick future after a separate real NPC save, three old NPC Q checkpoints,
and ordinary entry's closed selection/asset gate. The visible human reveal has
90 finite bones. This is not a single clean full-browser run.

Intermediate test failures are retained: ground-height pointer coordinates,
counting extra attacks after live frames had already advanced the passive, and
a development reload caused by preparing the baseline checkout inside the
watched project. The checkout was moved outside the project and the affected
Yi checks pass. Existing Garen browser deadlines and Ahri's transient windup
checkpoint are recorded separately. Ahri now pauses immediately after actual
keyboard release queues the command; all original assertions pass and its proof
is written, but the run exceeds the original 120-second deadline during cleanup.
Assertions, deadlines and quality settings were not reduced; automatic retries
remain zero.

Both existing Garen browser deadlines reproduce on unchanged commit `ee4948b`
with the exact same test file and system-Chromium launcher. The first times out
at the same Q-contact assertion; the R case exceeds its unchanged 30-second
deadline in both checkouts. These are retained failed runs, not passing browser
certification. The temporary baseline checkout was removed after capturing its
identity and traces.

Nested production hosting passes all existing spell/save/purchase/restore checks,
32 recordings, exact human/NPC Yi URL rejection, no development hook and zero Yi
rig preloads. The existing large-bundle warning remains. Ruleset:
`58d4bb60164c316712b1f3b92eff8ec71be784db6ab7bf3cba9c03ada4d6cdab`.
Pack `f43a7afcb43f3510af23f3ffc6650e6849ff8f7e45d8c81d97b7ec66974015c6`
contains 1,073 files / 526,661,647 bytes. No fresh offline/native/full-match
performance certification follows from these checks.

## Vanish selection follow-up

The body, cursor picker, selection ring and hover ring now share the same
visibility predicate. A known position does not make vanished Yi clickable.
The selected identity remains stored, so picking and the selection ring recover
on reappearance. Damage protection stays separate: protected structures remain
visible and selectable. Q descriptions now include their rank-specific monster
bonus and critical-strike capability.

A direct real-controller/picker test failed before the fix and passes after it.
The 67 focused cases cover reappearance, fog, death, protected turret selection
and existing Q/player behavior. TypeScript and build pass. The real keyboard/
mouse Q browser case additionally checks vanished body/rings/picking and restored
selection/picking. Schema 144 and its ruleset remain unchanged; public assets
are unchanged. This follow-up does not repeat the full unit/browser/production/
offline suites. See [visibility verification](reference/masteryi/visibility-verification.json).
