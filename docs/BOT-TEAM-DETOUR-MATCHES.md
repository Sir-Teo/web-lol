# Long matches with remembered-turret detours

All seven selected runs finish naturally in structurally valid victories under
source commit `807b6bf`. The five combined-roster seeds repeat the preceding
baseline with the same roster, runtime, map inputs, QA Lux mid automation and
60-minute diagnostic horizon. Two ordinary Ashe/Lux roster seeds separately
exercise the public match composition. No clocks, resources, damage or victory
rules are changed, and no horizon forces a winner.

Independent verification passes **1,013,633 checked ticks, 285 exact checkpoint
round-trips and 278 original/restored future comparisons covering 16,680 ticks**.
All archived source bytes, runner, maps and retained snapshots verify. Per-tick
resources, accepted structure dependencies and terminal freezing pass. Every
hundred-seed flag remains false; seven selected games do not satisfy that gate.

## Paired private-roster results

Winners remain the same in these five seeds. Four games finish earlier and one
finishes later; this is not a general speed or balance claim.

| Seed       | Winner | Before detours | With detours |
| ---------- | ------ | -------------- | ------------ |
| 719        | Red    | 37:12.9        | 35:52.8      |
| 927        | Red    | 42:27.0        | 36:40.1      |
| 26018      | Blue   | 40:16.1        | 49:49.5      |
| 2147483648 | Blue   | 41:11.3        | 38:21.5      |
| 4294967295 | Blue   | 45:49.9        | 33:31.4      |

Every corresponding minute checkpoint through 20 minutes is identical after
normalizing only its root rules fingerprint for analyst comparison. No save
migration is performed. Both junglers' 20-minute levels, CS, deaths, companion
feeding and growth clocks therefore remain unchanged in all five comparisons.
The first differing retained minute occurs at minute 21, 35, 27, 23 and 23 in
the table's seed order. Later movement/combat follows different decisions.

The ordinary-roster seeds also pass: 26018 ends in Blue victory at 47:10.6 and
719 ends in Red victory at 40:07.9. They have no paired full-duration baseline
at the preceding rules identity, so no duration comparison is claimed for them.

Schema remains 163; rules fingerprint is
`abc8dc664ed97c0f0cfac64e4eb52b43dbbc593884a6896a47b1e8e0d34bd04f`.
The source commit's [browser/unit/build/production evidence](BOT-TEAM-DETOURS.md)
retains the same identity. These headless runs add no full-match browser,
real-device performance, native-fidelity or new offline acceptance. See the
[verification ledger](reference/bot-team-detour-matches-verification.json).
