# Baron private-pose regression

The private target sampler matches direct Three playback of the pinned original
Baron GLB on eight joints across six idle/attack poses, including the source
release time .28299999237060547. The shared pose-only transport keeps the original
binary, geometry, skins, nodes and animation channels while omitting image bindings
for Node. Original GLB SHA-256 is checked before either path loads it.

The fixture producer never imports the application sampler. Tests compare source
joint positions to 12 decimal places and verify the reference scene stays unposed.
The head-to-jaw direction has positive local Z at all sampled times, consistent
with the current forward interface; an absolute mouth offset from the actor root
is not a separate facing calibration. No orientation correction is introduced.

Seven cases and TypeScript pass. Regeneration executes the independent direct
clip path. This checks private-clone/binding behaviour, not native animation graph
selection, parametric angle dispatch, client cadence or complete body shading.
See reference/baron-real-rig-poses-verification.json.
