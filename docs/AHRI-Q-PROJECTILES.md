# Ahri Q projectile rendering

The implementation branch draws both declared Q missile systems from the saved
projectile observer: 16 outgoing profiles and 20 return profiles. The native
spell declarations bind `Ahri_Q_mis` and `Ahri_Q_mis_02` to the ordinary and
return missiles. Dispatching them at the local gameplay launch and turn remains
an explicit adapter choice; these declarations contain no native script bodies.
Hit systems and the other Q resources are not dispatched from their names.

The renderer uses the 17 published textures (151 authored mips) and three mesh
transports. Fifteen textures and two meshes are new files; two textures and the
swirl mesh are borrowed from the caster pack. The caster loader already scales
its mesh and derives shader BGRA, so the projectile loader does neither twice.
Owned meshes convert native centimetres to scene metres once. The sphere's
missing color stream remains absent, and no mesh normals are fabricated.

An Ahri roster lazily loads the pack. Failed loads require explicit retry;
successful verified resources survive retries. Disposal during loading cannot
construct a late renderer. The development sphere remains the fallback until
the source renderer is ready. Ordinary rosters request no projectile resources.

Each phase owns a deterministic particle sampler with bounded cached birth and
float32 motion rows. Backward seeks and cache disposal preserve the same output.
The adapter uses 60 Hz updates, a first update at tick one, nearest-tick delay,
and the existing kind-zero total-lifetime cap at stop. Missing linger does not
invent a tail. The source 75-particle return burst, five sphere particles, and
distinct delayed return glow remain intact. No World ID or RNG is consumed.

Surface particles share the existing source surface path. Ribbons use the
separate packed writer with all three smoothing modes, preserving authored mode
2 instead of remapping it. Omitted smoothing uses the pinned external reader's
off default; quality reach three, missing cutoff zero, and material defaults
remain local bindings. Erosion, HDR tint and independent secondary UVs reach
each ribbon vertex. The quad-family fragment arithmetic is reused.

Both paths use the saved projectile frame and source-X reflection. World
acceleration remains outside the missile rotation. The airborne root keeps the
existing local 0.9-metre height; ground quads project onto actual terrain with
the shared two-centimetre lift. Saved mathematical heading converts to scene
yaw. Ribbon UV distance follows the complete retained path, rather than a
shrinking set of live particles.

Bound hostile cores can enter sight after hidden launch. Unbound particles need
known saved birth endpoints as well as current placed-point visibility. Hidden
trail points remain separators before smoothing. These are local presentation
policies, distinct from the native return missile's declared visibility flags.
Restore or World replacement resets owned drawings and caches. Ended roots stop
future emission; virtual terminal time drains finite particles without stepping
or mutating the winning World.

The [history verification](reference/ahri/q-projectile-history-verification.json)
retains its own schema 177 / `3421b665` frozen cohort. Later renderer changes
receive a separate fingerprint and source comparison; the older cohort is not
relabeled. Renderer tests cover all 36 profiles, exact restored packets, real
return Flash, hidden entry, terminal cleanup, and borrowed-resource ownership.
Browser and production acceptance are recorded separately when complete.

External writer agreement, source asset verification and browser rendering do
not establish native callback chronology, target-patch pixel equivalence or
device performance. Browser QA uses software Chromium and is functional only.
