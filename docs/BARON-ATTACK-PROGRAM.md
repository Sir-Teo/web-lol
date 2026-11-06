# Baron attack parameter stage

All nine missile and twelve hit emitter declarations now project into one private
parameter table. Its 216,748 bytes have SHA-256
`f630cfe929cf27895378f91049f84bc4229eef39e52da26d5e2a6f63ac90284d`.
The [reading record](reference/baron-attack-program-reading.json) pins original
source/label/decode/transport/mesh records and the complete helper closure.
No active emitter renderer, public asset or simulation state changes here.

The projection retains 13 billboards, four arbitrary quads, two capsule mesh
primitives, one arbitrary trail and one camera trail. The sphere remains the
separate emission surface of Embers_Blend, with original native-unit vertices
and indices, source scale 0.3 and the external reader's default normal policy.
All 25 texture containers and all 214 mip pixels verify against the decoded
record; both GLBs match the verified loader/attribute identities. No asset
binding is missing or unused.

Every declared curve retains its constants, ordered keys, probability tables
and serialized type. Embers_Add's zero-valued `IntegratedValueVector3` remains
distinct from an ordinary vector. Only declared curve/settings fields project;
empty-value fallbacks follow the established reader schema. Source settings,
UV rotation/frame fields, multipliers, erosion mixers/drive, palette count,
periods, bound-size factors and empty audio declarations remain explicit.
Unknown top-level/nested fields, classes and unexpected audio payloads reject.

Point/sphere/cylinder/legacy shape distinctions stay separate. The original
`{ee39916f}` point class remains its source ID; the external reader's
`VfxShapePointDoNotUse` label is a hash crack rather than an attested native name.
Volume flag 1, omitted primitive -> billboard, omitted trail smoothing -> off
and omitted emission-normal flag -> true are explicit external reader policies,
not native target-patch default certification. The
[verification record](reference/baron-attack-program-verification.json) pins the
parser, enum and timing-reader evidence.

```sh
PYTHONPATH=tools/assets python tools/assets/stage-baron-attack-program.py --check
PYTHONPATH=tools/assets python -O tools/assets/stage-baron-attack-program.py \
  --check --output-dir .cache/baron-attack-program-verified
node --test tools/qa/baron-attack-program.test.mjs
```

First staging requires `--discover`, a missing reading and a fresh output root.
Normal staging reproduces the reading exactly and recovers a missing program;
conflicting programs/readings/assets refuse before writes. Three private program
copies match byte for byte, including the first discovery copy. Completing the
helper provenance changed only the staged reading metadata; the initial reading
is retained under `.cache/baron-attack-program/initial-reading.json`.
An earlier pre-loader mesh audit is retained under
`.cache/baron-attack-packed-initial-unverified`; canonical mesh staging now uses
the fully checked converter and retains the same GLB bytes.

Twenty-one offline projection guards pass normally and with optimization.
Six CLI probes cover conflicting output, corrupt asset before missing-output
creation, repeated discovery, edited reading, exact recovery and repeat identity.
All 48 Node QA checks pass. The first strict pass identified the two previously
unrouted depth-bias/ground settings and the integrated acceleration class; their
explicit mappings now preserve those declarations rather than relaxing the gate.

The in-game Baron missile still uses its provisional marker. Source scheduler,
attachment/flight/contact histories, actor-size inputs, material dispatch and
native visual comparison remain next integration work. Existing simulation
fingerprint `e20bdc…`, schema 163 and prior production/offline pack identities
retain their separate scopes.
