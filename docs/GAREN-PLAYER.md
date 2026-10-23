# Garen player-control fixture

During `npm run dev`, open `/?scene=fixture&champion=garen` to exercise Garen as
the human-controlled champion on the small development map. This is the player
integration instrument for the source-backed kit described in
[ROSTER-EXPANSION.md](ROSTER-EXPANSION.md). The production roster and lane matches
remain Ashe/Lux while Garen's complete effects/audio and native comparisons are open.

Garen begins at level one with one skill point and no learned abilities. Use the
upgrade buttons or Ctrl+Q/W/E/R to learn, subject to the ordinary level gates.
The existing development `window.__GAME__` hook supplies fixed-step setup and
experience grants for controlled high-level cases. Regular farming still grants
experience through the shared simulation.

## Input and presentation

- Q/W/E activate immediately from their keys or HUD buttons. E retains its
  one-second recast lock; the button displays the lock, then `RECAST`, then its
  actual post-spin cooldown when the effect ends.
- Hold R, point at a visible enemy champion within 400 units, and release. The
  guide is a ground-following circle at the accepted center-distance range.
  Keyboard release captures that unit's ID. Ground, dummies, allies, dead/hidden
  champions and the minimap do not supply an R target. The simulation revalidates
  the queued identity and all cast gates before spending cooldown.
- Existing movement, attack-move, stop, Flash, Heal, learning, pause and recall
  controls continue through the common input path. A valid R retains its captured
  identity through the committed windup; it never reselects from an old point.
- Portrait/title, spell names, rank previews, tooltips, cooldowns and active Q/W/E
  states use Garen data. The mana bar, Ashe Focus pips and Hawkshot charges are
  absent. A passive strip displays Perseverance readiness/recovery and learned
  Courage stacks. Regeneration includes current Perseverance when available.

Garen's source selection cylinder uses the pinned 120-unit radius and
188.8889-unit height instead of Ashe's dimensions. The four local spell icons
come from Data Dragon 16.18.1. Names, IDs and title are retained in
[garen-player-ui.json](reference/garen-player-ui.json); icon URLs, byte counts and
hashes extend `public/assets/reference-manifest.json`. The icon importer includes
all four files. Runtime needs no CDN requests.

This HUD describes the implemented kit, including captured E count, current AD,
bonus-health W shielding and the current R formula. It does not establish native
event timing, source particle/audio playback or animation-graph equivalence.
Those remaining limits in the individual ability documents still apply.

## Fixture and checkpoint boundaries

The URL flag is considered only when Vite's development build has selected
`practice-fixture`. Production ignores both diagnostic flags. The World
constructor and decoder permit a Garen player only on that battlefield; a Garen
player on Rift is rejected. `selectableChampion` and ordinary new-match UI still
exclude him. This is not a newly certified production roster entry.

An explicit Garen fixture URL starts Garen when an older fixture checkpoint uses
another champion; it does not overwrite that checkpoint until Save or Restart.
A matching Garen checkpoint restores paused. Pause → Save match, file transfer,
reload, and Restart practice retain the Garen identity. Restart creates a fresh
level-one Garen fixture. Fixture files remain incompatible with the Rift map.

Snapshot version 75 permits this constrained player identity and retains the
existing kit state and targeted-command schema. No spell-state validation is
bypassed. Earlier builds are incompatible under the same-build checkpoint policy.

Validation: all 911 simulation/source tests and TypeScript pass. Seven new tests
cover the fixture boundary, controls, target eligibility, recast deadline,
player-owned spell/save continuation, live tooltip calculations, and icon metadata/
hashes. Twenty-one focused browser cases pass across Garen player controls,
Ashe tooltips, Lux controls/HUD, champion choice and match-file/recovery flows.
Garen's real Q/W/E keys, targeted R, active-spin save/reload, restart, passive
recovery and Courage display are exercised. Captures at 1440×900 and 1120×720
were visually reviewed. Production smoke additionally opens the diagnostic flags
and verifies that Ashe and the ordinary roster remain in use.

Small-window review also exposed combat text painting over the HUD. The HUD now
has an explicit stacking level above world labels/combat text. A browser hit-test
probe verifies tooltip paint order over the combat layer, in addition to bounds.

The production build and nested static-host smoke pass with 17 source recordings;
the existing large-bundle warning remains. A later [Judgment particle increment](GAREN-SPIN.md)
now covers all six source spin layers. [Judgment audio](GAREN-E-AUDIO.md) adds
source cast/active/ending/hit cues and schema-77 shared presentation history.
Complete spell effects/audio, directional spin
blending, native timing/cancellation captures, complete build/role policy and
full-match certification remain required before Garen's production selection.

[R particles](GAREN-R-PARTICLES.md) now exercise the source caster flash, falling
sword and impact layers in this fixture, including schema-78 release persistence
through kills, later caster death and reload. Distortion and native audiovisual
comparison remain open; production selection stays Ashe/Lux.

[R source audio](GAREN-R-AUDIO.md) adds three cast variants, three hit variants
and a stereo lethal-result cue. Schema 79 retains sound after particles expire;
source-ready casts bypass synthesis and missing/late files retain a single
fallback cast. Q/W/basic/voice audio and native comparison remain unfinished.

[R kill particles](GAREN-R-PARTICLES.md#lethal-result-particle-adapter--october-21-2026)
now add a shockwave, three rays and flash only on the recorded lethal R result.
Those six draws retain their release point and clocks through caster death and
checkpoint reload; both source distortion layers and native comparison remain open.

[Courage source audio](GAREN-W-AUDIO.md) now supplies cast, sustained loop and
ending phases. Schema 80 retains those clocks through shield loss, defense
expiry and death, including saved loop offsets and a partial stop fade. Source
Q/basic/voice audio, Q/W particles and native calibration remain unfinished.

[Courage cast/ground/shoulder particles](GAREN-W-PARTICLES.md#live-cast-and-sustained-adapter--october-21-2026)
now add the source shield, activation glow/energy/flash and sustained glow/wings/
waves, plus separate left/right shoulder streaks and hoop/glint layers. They follow
posed rig/ground anchors, retain bounded death/stop tails and restore from the
existing W presentation interval. Native deflection dispatch and character material/attached-skin
effects remain open, as does native attachment/composition.

[Courage damage reactions](GAREN-W-PARTICLES.md#damage-reaction-adapter--october-21-2026)
now add the source rotating shield on positive physical/magic hits reduced by W,
including fully shielded and lethal hits. The local policy coalesces hits within
one simulation tick and excludes true damage. Schema 81 keeps independent
reaction clocks through practice recasts, defense expiry, death and reload.
Native dispatch and the remaining body effects remain open.

[Decisive Strike source audio](GAREN-Q-AUDIO.md) now supplies activation, one-shot
active, ending and both committed-swing actions with their authored delay.
Schema 82 preserves original clocks, stop fades and accepted swings through
target loss, death, practice recasts and reload. Source-ready casts/attacks bypass
their generic cues; late-loading fallback does not double those keys. The
development audition page remains available for explicit variant selection.
Native script/mix/listening calibration and the remaining Q particle layers remain open.

[Decisive Strike particle sources](GAREN-Q-PARTICLES.md) now include every base Q
resource key, 29 lossless textures, four meshes and four unchanged Spell1 bindings.
The development source inspector shows the complete set. Schema 83 now records
confirmed impacts and attack-presentation stop clocks independently of audio. The
weapon trail uses its explicit frame-8 event and center-bone binding. Target loss,
death, recasts, terminal matches and post-contact pose changes stop that trail.
Eight activation/armed emitters now add the source bubbles, flash, flare, rising
glow, spinning sword mesh and activation quad. Their independent activation and
armed-stop clocks restore from the same schema-83 history. Native attachment and
stop dispatch and the remaining source layers remain open. Seven target-impact
layers now use confirmed contact history: two source-mesh layers, flash, slash,
camera-facing ray and two directed spark emitters. They retain the contact point
and heading through later movement, death and reload, with per-particle enemy
fog gating. The target distortion layer and native attachment/composition remain open.

Five jump/landing layers now add the source jump mesh, outward dirt spikes,
waves, smoke and delayed ground decal. Schema 84 saves the frame-9 landing
event's point/heading; the missing jump start frame remains an explicit local
commitment policy. Accepted ground bursts finish naturally through later movement,
death and reload. RGB scrolling and locked unscrolled alpha now have independent
GPU checks, including the existing sword mesh. Ten emitter records and native
timing/attachment/material calibration remain open.

The Q silence icon now follows the living recipient from accepted control
history. Schema 85 retains its actual deadline, including Courage tenacity;
generic silence cannot create or extend it. Overlapping Q sources coalesce one
icon using the oldest active contact's clock. Target fog/death and match end
remove the icon, while caster death/recast leaves accepted control intact.
The local health-bar-plus-source-offset anchor is provisional: source Flex
bound-size offset scaling and native attachment remain unverified. Q now renders
twenty-two emitter records; nine others remain deferred.

The recipient icon now clears its own measured DOM info bar by four CSS pixels,
including wrapped names and minions with hidden names. The local screen-space
lift preserves source scale/appearance and the original control clock through
zoom, resizing and checkpoints. Native attachment/Flex sizing remains open; see
[label clearance](GAREN-Q-PARTICLES.md#recipient-label-clearance--october-21-2026).


[Perseverance recovery sparks](GAREN-PASSIVE-PARTICLES.md) now render the source
healing emitter during recovery in this fixture. Schema 112 preserves emission
intervals and stopped roots through saves, death and terminal playback. The
source recovery audio now follows those intervals with its authored fade-in/stop.
The boost trail and native dispatch/composition comparison remain open; production
selection stays Ashe/Lux.


[Basic-attack source audio and ordinary swing selection](GAREN-AA-AUDIO.md) now
add both source normal animations, four hit-material branches and separate
critical layers in the fixture. Schema 113 saves accepted ordinary swings and
confirmed contacts independently of Q. Native attack particles/voice, contact
calibration, the remaining kit and production acceptance remain open.
