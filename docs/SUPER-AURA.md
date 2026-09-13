# Super-minion aura evidence

Research checked September 13, 2026. This is an unresolved specification, not an implemented gameplay effect.

## What the pinned sources establish

The selected standard super CharacterRecords carry cosmetic items 1511 and 1512. Item 1512 is named Super Mech Power Field. Its 16.18 English tooltip describes 35 armor and 35 magic resistance for nearby minions, but the item has no numeric data values for range, duration, filtering, or stacking.

The matching shared table has `SuperMinionBuff_Blue` and `SuperMinionBuff_Red`. Both reference the same Minion Commander description. That description instead claims 70 armor and magic resistance plus 70% increased damage. The two shared records contain identifiers and tooltip links, with no range or application logic. A shared-table entry's presence does not establish that the current standard mode executes it.

All five selected records, source URLs, and whole-response SHA-256 hashes are retained in [super-aura.json](reference/super-aura.json). `python3 tools/assets/verify-super-aura.py` verifies the raw cached responses and selected records, downloading a missing response from its pinned URL. The records are research inputs and are deliberately not exported as runtime rules.

## Interpretation and unresolved behavior

The cosmetic item's description is the stronger current candidate for the resistance amount because the selected standard super records explicitly carry that item. The shared description may be stale or used by another mode. This is an inference; the available records do not establish which script applies the actual effect. Do not reintroduce the described damage multiplier merely because a versioned string contains it.

Before implementing the aura, establish:

- Effective radius and whether distance uses centers or collision edges.
- Eligible units, including whether other supers are excluded and whether summoned minions qualify.
- Whether multiple supers stack the bonus or only maintain one effect.
- Apply/refresh cadence and removal delay when moving away or killing the source.
- Whether terrain or vision affects application.
- Current armor/MR amount, with the obsolete-looking damage modifier tested separately.

Use a matched standard-Rift reference session with one super and an ordinary minion. Measure the recipient's resistances inside/outside several distances, repeat with a second super, then remove each source and record frame times. Keep damage measurements separate from the wave's normal stat upgrades and team-level modifiers. Repeat across both teams and minion types. A numeric radius must not be inferred from an icon, effect mesh, or the word “nearby.”

The aura remains unimplemented. No runtime or visual fidelity claim follows from verifying these source records. This unresolved item does not block independent champion, map, bot, or presentation work.
