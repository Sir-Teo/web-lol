# Summoner loadouts and base Smite

New match setup now lets the player choose two distinct spells for D and F from
Flash, Heal and base Smite. Choosing a spell already in the other slot swaps the
two assignments. Practice and the interim lane match retain the selected loadout
through saves and restarts. Other champions keep their existing Flash/Heal
defaults; role allocation and jungler decisions remain unfinished.

## Source evidence

[The source pin](reference/summoner-smite-source.json) retains the complete standard
16.18 `Shared/Spells/SummonerSmite` record and first-charge BuffData, selected
English strings, the official Data Dragon icon, eleven monster Root tag sets and
three original Scripts archive members. The shared-record mirror's SHA matches
the source already pinned for Heal. Original script chunks come from frozen Riot
manifest `29CE6E781C3B6368` (16.18.8175716).

Standard data gives 600/1,000/1,400 damage, two maximum charges, a 15-second cast
cooldown, 90-second recharge, 500 cast range and bounding-box range checks. The
cooldown ignores ordinary ability haste. Disabled casting and channel preservation
are explicit source fields. Riot's [26.1 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/)
also publish the damage progression and associate evolution with the jungle
quest. The older Duel and alternate-mode records are separate evidence; their
900/1,200 values do not drive standard Smite.

The selected scripts contain only metadata assignments and RETURN. The
first-charge script retains `PersistsThroughDeath`; the initializer has unrelated
Rumble display metadata. Neither supplies an active charge startup or damage
callback. This pin does not claim to recover server behavior from these stubs.

Reproduce the finite original-script extraction and generated runtime profile:

```sh
curl -fLsS https://raw.communitydragon.org/16.18/game/shared.cdtb.bin.json -o .cache/smite/shared.json
curl -fLsS https://raw.communitydragon.org/16.18/game/en_us/data/menu/en_us/lol.stringtable.json -o .cache/smite/strings.json
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-smite.py
```

The extractor checks both full mirror digests, selected Root tags and original
archive bytes. It rejects a changed pin and emits `summoner-smite.ts`. The icon's
official URL and digest are retained separately in the pin.

## Runtime policy

Base Smite deals 600 immediate true damage to an eligible visible large/medium
monster or enemy lane minion. Monster eligibility follows pinned Root tags:
medium Krugs are valid; small wolves, raptors and mini Krugs are not. The two
hashed required tags resolve to `Monster_Epic` and `Monster_Medium` by their exact
FNV hash. Epic monsters are not yet implemented. Base Smite cannot target a
champion, structure or dummy. Champion pets are also not yet implemented.

Target range compares center distance against 500 plus both gameplay radii.
Shared team sight is sufficient; a visible target can be cast on across terrain.
Protected emergence, returning resets, missing/dead targets and failed range
checks consume neither charges nor cooldown. The queued target ID is validated
again when the command executes. Damage uses the normal last-hit, reward and camp
death paths, while a summoner damage category prevents Doran's Blade omnivamp.
Smite neither applies nor detonates Lux Illumination.

The local startup policy grants one charge at creation and schedules another one
90 seconds later, independent of first use. Each subsequent charge uses a
sequential 90-second interval, capped at two; spending from full starts a fresh
interval. A 15-second lockout applies after a successful cast. This initial
charge count/anchor is provisional: the native startup phase, early-game offset,
special first-charge behavior and summoner haste need matched runtime evidence.
Ordinary ability haste changes neither clock. Recharge continues through death.

The current control model maps source disabled-cast permission to stun, root and
silence, while preserving recall and champion cast commitments. It does not model
every native disable type. Smite retains the source no-channel-break behavior
during Final Spark; Flash in either slot retains the existing Final Spark blink
policy. Heal targeting, speed, repeat reduction and cooldown follow the selected
slot, as do the existing defensive bot planners.

The HUD shows the selected source icon, charge count, cast lockout and recharge
progress. Holding the selected key previews a range ring; release on a legal
target casts. The scoreboard exposes public spell identities without enemy
cooldowns. Practice cooldown reset restores both charges. Native Smite particles,
animation dispatch and sound are unfinished; the ordinary local cast/damage
feedback remains in use.

## Saves and remaining work

Schema 98 stores each champion's two spell identities and optional Smite charge
state. It rejects duplicate identities, missing/invented charge state, counts
outside zero–two, recharge clocks on a full stock and expired or too-distant
recharge deadlines. Queued Smite target IDs survive exact checkpoint reloads.
Existing incompatible-schema/fingerprint handling still applies.

[Companion source preparation](JUNGLE-COMPANIONS.md) now supplies all three
source skins, both forms and the item/controller evidence. It also records the
unresolved counter-direction discrepancy and metadata-only callback boundary.

This adds the base summoner dependency for jungle play. Companion items, pets,
quest counters and evolution are still required before upgraded Smite can be
earned. No champion-level substitution or manual upgrade selector is provided.
Standard role binding, jungle damage/healing modifiers, pet targets, native
forgiveness/latency, effects/audio, role AI, epic objectives and complete seeded
matches remain unfinished. Current commands, results and hashes belong in
[the verification ledger](reference/summoner-smite-verification.json); they do not
certify native or full-match completion. The full project goal remains active.
