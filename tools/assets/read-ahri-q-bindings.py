"""Freeze Q animation particle declarations and retained transport attachment candidates."""
import argparse
import hashlib
import json
import runpy
from pathlib import Path

PINS = {
    'docs/reference/ahri-model.json': '74d0b55f5aad08646fbd24f660ed533bc8fd5798e8a60dc0983d97960b47a377',
    'docs/reference/ahri/q-particles.json': '613f21651105761810963a32275a52b073189ccdea7286af78980d558b3db2c3',
    'docs/reference/ahri/mesh-submeshes.bin': '787b1b497a7a70af39e8f4bf3ce191c3d17d3bf8a44deee12c018692e036756f',
    'public/assets/models/ahri-base.glb': '587c1741a908e23874a87d069505e0e233d4f88c22a828c9d7edda195328e202',
}


def require(ok, message):
    if not ok: raise ValueError(message)


def sha(raw): return hashlib.sha256(raw).hexdigest()


def name_hash(name):
    value = 0x811c9dc5
    for byte in name.lower().encode('ascii'): value = ((value ^ byte) * 0x01000193) & 0xffffffff
    return '{%08x}' % value


def read():
    inputs = {}
    for name, digest in PINS.items():
        raw = Path(name).read_bytes(); require(sha(raw) == digest, 'Frozen Q binding input differs: '+name); inputs[name] = raw
    model = json.loads(inputs['docs/reference/ahri-model.json']); particles = json.loads(inputs['docs/reference/ahri/q-particles.json'])
    helper_path = Path(__file__).with_name('export-ahri-materials.py'); helper = runpy.run_path(str(helper_path))
    draws = helper['submeshes'](inputs['docs/reference/ahri/mesh-submeshes.bin'])
    glb = helper['glb_json'](inputs['public/assets/models/ahri-base.glb'])
    nodes = {n.get('name'): index for index, n in enumerate(glb['nodes']) if n.get('name')}
    clips = model['animations']['data']['Characters/Ahri/Animations/Skin0']['mClipDataMap']
    rows = []
    for clip_name, clip in clips.items():
        for event_key, event in clip.get('mEventDataMap', {}).items():
            if event.get('__type') != 'ParticleEventData' or not event.get('mEffectKey','').startswith('Ahri_Q'): continue
            key = event['mEffectKey']; require(key in particles['resources'], 'Unjoined Q particle event')
            bones = []
            for pair in event.get('mParticleEventDataPairList', []):
                name = pair['mBoneName']; matches = [n for n in nodes if n.lower() == name.lower()]
                require(len(matches) == 1, 'Unresolved/ambiguous Q transport joint candidate')
                bones.append(dict(declaredName=name, transportName=matches[0], transportNodeIndex=nodes[matches[0]], exactCaseMatch=name == matches[0]))
            resource = particles['resources'][key]
            rows.append(dict(clipName=clip_name, animationPath=clip['mAnimationResourceData']['mAnimationFilePath'], eventKey=event_key,
                             declaration=event, resourceKey=key, sourceRecord=resource['record'], sourceBinSha256=resource['nativeSha256'],
                             sourceEmitterCount=len(resource['definition']['complexEmitterDefinitionData']), transportBoneCandidates=bones))
    require(len(rows) == 2 and {r['resourceKey'] for r in rows} == {'Ahri_Q_Cas','Ahri_Q_Orb_Cast'}, 'Changed Q particle animation closure')
    by_key = {r['resourceKey']:r for r in rows}
    require(by_key['Ahri_Q_Cas']['declaration'].get('mStartFrame') == 5.0 and 'mEndFrame' not in by_key['Ahri_Q_Cas']['declaration'], 'Changed cast start/end declaration')
    require(by_key['Ahri_Q_Orb_Cast']['declaration'].get('mEndFrame') == 7.0 and 'mStartFrame' not in by_key['Ahri_Q_Orb_Cast']['declaration'], 'Changed orb start/end declaration')
    attached = []
    for key, resource in particles['resources'].items():
        for index, emitter in enumerate(resource['definition']['complexEmitterDefinitionData']):
            primitive = emitter.get('primitive', {})
            if primitive.get('__type') != 'VfxPrimitiveAttachedMesh': continue
            selectors = primitive['mMesh'].get('mSubmeshesToDraw', [])
            candidates = [dict(selector=s, matchingRetainedDraws=[d for d in draws if name_hash(d['name']) == s]) for s in selectors]
            attached.append(dict(resourceKey=key, emitterIndex=index, emitterName=emitter['emitterName'], primitive=primitive, retainedDrawCandidates=candidates))
    require(len(attached) == 1 and attached[0]['resourceKey'] == 'Ahri_Q_Cas', 'Changed Q attached mesh closure')
    matches = [c for a in attached for c in a['retainedDrawCandidates'] if c['matchingRetainedDraws']]
    unmatched = [c['selector'] for a in attached for c in a['retainedDrawCandidates'] if not c['matchingRetainedDraws']]
    require(len(matches) == 1 and matches[0]['matchingRetainedDraws'][0]['name'] == 'Tails' and unmatched == ['{62579b4c}'], 'Changed retained submesh selector candidates')
    return dict(format=1, helperSha256=sha(Path(__file__).read_bytes()), inputs=[dict(path=name,sha256=digest,bytes=len(inputs[name])) for name,digest in PINS.items()],
                materialReaderSha256=sha(helper_path.read_bytes()), animationEvents=rows, attachedMeshes=attached,
                summary=dict(animationParticleEvents=2, joinedSystems=2, authoredEmitters=11, transportBoneCandidates=2, attachedMeshEmitters=1, namedSelectorMatches=1, unmatchedRetainedSelectors=unmatched),
                limits=['Raw animation frame fields remain separate from any local clock; missing start/end frames remain omitted.',
                        'Transport joint candidates use case-insensitive name matching; this reading does not establish native joint sampling/attachment transforms.',
                        'Selector candidates use verified lowercase FNV-1a names from the retained native SKN table. One selector matches Tails; {62579b4c} has no retained draw match.',
                        'An unmatched selector is not evidence of global absence or a native fallback policy. No substitute draw is invented.',
                        'Native material arithmetic, lock-to-attachment behavior, callback timing and frame conversion remain unverified.',
                        'No runtime assets, controls, saved history, particle renderer or gameplay rules change.'])


if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',default='docs/reference/ahri/q-particle-bindings.json');p.add_argument('--check',action='store_true');args=p.parse_args();raw=(json.dumps(read(),indent=2)+'\n').encode();target=Path(args.output)
    require(not any(p.is_symlink() for p in [target,*target.parents]),'Binding output cannot contain symlinks');require(not target.exists() or target.read_bytes()==raw,'Existing Q binding output differs');require(not args.check or target.exists(),'Missing Q binding output')
    if not args.check and not target.exists():
        target.parent.mkdir(parents=True,exist_ok=True)
        with target.open('xb') as out:out.write(raw)
    print(json.dumps(dict(status='passed',bytes=len(raw),sha256=sha(raw),**read()['summary'])))
