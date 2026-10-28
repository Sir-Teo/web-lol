# Current control build: full match and offline delivery

The control-policy build at `3c461ce`, fingerprint `5a5379…`, completes the
ordinary roster's seed 26018 naturally in Blue victory at tick 169,837
(47:10.617 simulation time). QA automation controls the human carry for this
headless check; production player control remains manual.

Independent verification passes 169,837 checked ticks, 48 exact checkpoint
round-trips and 47 restored-future comparisons. All frozen source, runner, map,
checkpoint and final hashes verify, as do resources, protected structures,
victory and terminal freezing. Every retained checkpoint and the final file are
byte-identical to the preceding `25f21e…` run after normalizing only the root
ruleset identifier for comparison. Original files and runtime admission remain
unchanged.

The same production pack passes a fresh full-pack download beneath a nested
host path. Checks exercise corrupt-download recovery, cancellation/retry,
keyboard focus, saved offline boot, offline repair, a new Lux lane match, pack
removal preserving saved bytes, refusal to update other open tabs, explicit
atomic version switching and revocation of readiness after a missing entry.
The run observes 978 service-worker responses and no page errors.

The completed-match gate uses the actual retained victory file with this
fingerprint. Its offline preview, result, restoration and exact export checks,
captures and counts are recorded in the
[verification ledger](reference/baron-control-delivery-verification.json).
This is completed-state delivery, not a complete browser simulation of the
headless match or a physical-device performance measurement.

The checked pack is
`e54b212c52e30d2a79c89390f14e3ec3dd414bd595af875840336fd682ddc393`:
1,204 files / 551,658,221 bytes. The application is unchanged from the checked
control-policy build. The [previous control checks](BARON-CONTROL.md) retain
their scope, including the two historical full-unit failures and the remaining
native-boss fidelity work. One selected game does not satisfy a hundred-seed
gate; both original hundred-seed audits remain at their frozen `abc8dc…` source.

The completed-state run passes offline preview, exact import/export, reload
and another exact export with 975 service-worker responses. There are no page
errors, failed requests or requests outside the host prefix. Its input report,
snapshot and manifest remain unchanged. Both reviewed captures and downloaded
files are retained. The quiet-check pause resumes both original audits.
