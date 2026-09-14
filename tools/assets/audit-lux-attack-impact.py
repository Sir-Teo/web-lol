"""Normalize verified impact metadata without replacing preserved source records."""
import hashlib, json, re
from pathlib import Path
from cdtb.binfile import compute_binhash
pin_path = Path('docs/reference/lux-attack-impact.json')
pin = json.loads(pin_path.read_text())
schema_path = Path('.tools/league-toolkit/src/LeagueToolkit.Meta.Classes/Classes.cs')
schema = schema_path.read_text()
names = {compute_binhash(name): name for name in re.findall(r'MetaPropertyAttribute\("([^"]+)"', schema)}
fields = ['disabled', 'startFrame', 'miscRenderFlags', 'paletteDefinition', 'directionVelocityScale', 'directionVelocityMinScale', 'FlexShapeDefinition']
resolved = {f'{compute_binhash(name):08x}': name for name in fields}
assert all(names[int(h,16)] == name for h,name in resolved.items())
def value(e, name, default=None): return e.get(name, e.get('{'+f'{compute_binhash(name):08x}'+'}', default))
variants = {}
for key, record in pin['records'].items():
    emitters = []
    for e in record['complexEmitterDefinitionData']:
        emitters.append(dict(name=e['emitterName'], disabled=bool(value(e,'disabled',False)),
            single=bool(e.get('isSingleParticle',False)),rate=e['rate']['constantValue'],
            particleLife=e['particleLifetime']['constantValue'],emitterLife=e['lifetime'],
            texture=e.get('texture'),colorLookup=e.get('particleColorTexture'),
            palette=value(e,'paletteDefinition'),startFrame=value(e,'startFrame',0),
            texDiv=e.get('texDiv',[1,1]),numFrames=e.get('numFrames',1),blendMode=e.get('blendMode',0)))
    variants[key.rsplit('/',1)[1]] = emitters
normal,critical = [pin['records']['Characters/Lux/Skins/Skin0/Particles/'+name]['complexEmitterDefinitionData'] for name in ['Lux_Base_BA_tar','Lux_Base_BA_tar_crit']]
strip_name = lambda e: {k:v for k,v in e.items() if k!='emitterName'}
shared = {e['emitterName']:[n['emitterName'] for n in normal if strip_name(n)==strip_name(e)] for e in critical}
report={'sourcePinSha256':hashlib.sha256(pin_path.read_bytes()).hexdigest(),
    'schema':{'revision':'76bf57bf4fd195343dec610bf0f912a06b910914','path':str(schema_path),'sha256':hashlib.sha256(schema_path.read_bytes()).hexdigest()},
    'resolvedFields':resolved,'variants':variants,'identicalCriticalEmitters':{k:v for k,v in shared.items() if v},
    'textureCount':len(pin['textures']),'textureBytes':sum(t['bytes'] for t in pin['textures']),
    'limitations':['Source metadata only; exact native material variants remain unverified','Palette definition is preserved, not substituted with color multiplication','Target bone attachment, target-follow binding and impact playback are not integrated']}
Path('docs/reference/lux-attack-impact-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'textures':report['textureCount'],'bytes':report['textureBytes'],'enabledEmitters':{k:sum(not e['disabled'] for e in v) for k,v in variants.items()},'shared':report['identicalCriticalEmitters']}))
