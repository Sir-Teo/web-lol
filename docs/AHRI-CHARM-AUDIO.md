# Charm source audio staging

The isolated `dev/ahri-charm-audio` branch stages nine unchanged mono 44.1 kHz float masters from the frozen Ahri SFX graph and decoded corpus. Three source play profiles retain their container gains and voice limits. The flight play action fades in over 50 ms with Linear curve 4; the stop action fades over 1.55 seconds with Exp1 curve 6. Export preflight verifies the complete output closure before writing.

`wwise145-linear-exp1-reference.json` records 90 direct evaluations of the pinned external reader's interpolation implementation. The app helper matches those evaluations, including the Exp1 midpoint of 0.625 for a fade from one to zero.

`ahri-charm-gameplay-reference.json` contains 48 full gameplay projection hashes generated with the frozen 7ae8e0 cohort source. Six scenarios cover hit, miss, death during windup, death during flight, Flash and overlapping casts. Only schema version, ruleset and the proposed root audio history are excluded. This independent baseline will check that audio tracking preserves gameplay, IDs and RNG.

Validation at staging: 12 asset/fade tests, the 48-projection comparison and TypeScript pass. This stage adds no playback or simulation history. Native dispatch, shuffle, global bus, listener behavior and virtualization remain unverified. The running 100-seed roster cohort remains on the primary branch and frozen ruleset.

## Saved history

Schema 168 adds bounded root Charm audio history for accepted cast, missile launch, swept contact and range or match-end stop. The history uses existing caster/projectile identities, with no allocated IDs or random draws. Birth audiences are saved separately for cast, launch and contact. A later reveal cannot rewrite an earlier audience. Unreleased casts cancel on death; released missiles retain their existing gameplay behavior. Tail pruning uses the longest selected source master and source stop fade, preserving late save playback.

Strict snapshot checks link pending casts and live projectiles to history and reject duplicate identities, detached clocks/points, conflicting cancellation and invented contacts. Seven history tests, the existing 23 Charm tests and the independent 48-projection comparison pass. The broader worktree suite is being checked separately; missing private reader fixtures are not acceptance evidence.

## Playback

Charm now lazy-loads its nine masters only when Ahri is present. Saved cast, launch and swept contact clocks drive finite source playback; the caster position follows its current point, while stopped flights and contacts retain their saved endpoint. Both saved birth audience and current enemy visibility gate playback. A deterministic cosmetic identity selects variants independently of World RNG. Global per-profile limits of 2/4/2 retire the oldest local voice; naturally ended or stolen voices cannot restart at a frozen tick. Mute and suspension stop owned nodes; resumed playback seeks to simulation time. Replacement worlds and rewinds reset ownership. Terminal audio time drains source tails while the winning world remains frozen.

Source gains and the source attenuation curve feed a local 0.2 mix. A separate envelope node samples the original Linear play fade and Exp1 stop fade into 128 Web Audio values over the remaining finite span. Early stops retain the level reached during fade-in. Late seeking evaluates the original stop domain rather than restarting it. This sampled scheduling and dispatch/variant policy are local implementations, not native client capture or shuffle/listener/bus certification. Ready source playback replaces the generic E cast tone; unavailable audio retains the existing fallback.

Validation: the complete unit run passes 8,490 of 8,492 tests, with only the previously documented missing Leona reader archive and Lux sampler FMA golden mismatch. Two additional integration checks pass separately. All 70 Node QA cases pass across the initial run and two export-guard reruns after staging the missing unchanged private masters. New Charm publication guards pass in normal and optimized Python using committed master fixtures. Both browser cases pass together (`artifacts/ahri-charm-browser-v4.log`), verifying a real keyboard cast, all nine exact decoded PCM hashes, mute/resume, checkpoint restoration and zero Charm fetches without Ahri. The contact screenshot was reviewed; software Chromium reports about 2 FPS and does not establish device performance. The test explicitly resets audio ownership before fresh checkpoint seeking because screenshot capture can outlast a finite clip; separate tests preserve natural-end suppression.

Production and offline delivery acceptance are recorded separately when complete. The primary 100-seed 7ae8e0 baseline continues unchanged; this branch has not been merged or published.
