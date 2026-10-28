# Baron resists root, stun, silence and Charm

The private `/?scene=fixture&encounter=baron` target now rejects these four
controls. Their incoming spells and empowered attacks still deal damage and
consume their ordinary casts. A resisted Charm does not replace Baron's attack
order or cancel its pending release. Light Binding still consumes one body hit
on Baron and can root an eligible second target. Ordinary monsters retain their
existing control behavior.

The common control entry points read the explicit private Baron policy. Snapshot
decoding also rejects a Baron carrying one of these controls, including an edited
expired control clock. The profile checker binds this local subset to its
[rule reading](reference/baron-control-source.json). It preserves source stats,
clips, Smite eligibility and reward restrictions.

The frozen client record provides the `Monster_Epic` identity tag. The two
retained secondary wiki descriptions state that Baron/epic monsters resist
crowd control except stasis; the Baron description also discusses terrain and
external-stat immunity. Those pages were last edited after the frozen 26.18
target. Their original bytes, revision IDs, dates and quotes are retained;
historical/API requests were denied. This is a local implementation consistent
with those descriptions. It does not establish native-client or exact-patch
certification.

Slow/Frost damage interactions, external stat changes, stasis, boss abilities,
native timing, sound, rewards/buffs and live calendars remain unfinished. This
increment does not activate Baron in public gameplay. It does not change the
existing slow handling or claim complete control immunity.

Eighteen new unit cases cover direct control admission, unchanged ordinary
targets, real Lux/Ahri/Leona/Garen impacts, preserved mid-windup futures and edited
save rejection. The focused seven-file run passes its first 100 tests, and the added Garen
impact case passes. The full run reports 3,628/3,630 across 420 files, with the
same historical Leona archive and Lux sampler failures. The real-input
Lux browser scenario imports its private fixture through Match files, casts Q,
observes damage with no root, saves/reloads exactly and compares 180 future
ticks. Its reviewed capture shows Illumination and damage without a root label.

The simulation fingerprint changes while schema 163 and snapshot fields stay
unchanged. Earlier `25f21e…` saves and selected match runs retain their frozen
checkout at `/workspace/web-lol-recovery-baseline`; no migration is performed.
The two original hundred-seed audits remain at their separate `abc8dc…` source.
Their accepted and archived evidence stays unchanged.

Full unit and production checks are recorded in the
[verification ledger](reference/baron-control-verification.json).

Production passes all 32 expected recordings, public Ashe/Lux selection, no
development hook and zero Baron preloads. Node QA passes 39/39; build, format,
profile reproduction and type-checking including the new browser file pass.
Current fingerprint is `5a53795c8d62dac8ec171d6021a4e4f4d29c9946fe186076ec33fea2e0c0f1b9`. Pack
`e54b212c52e30d2a79c89390f14e3ec3dd414bd595af875840336fd682ddc393` contains
1,204 files / 551,658,221 bytes. No current-fingerprint full-match
or fresh-offline certification is claimed in this increment.
