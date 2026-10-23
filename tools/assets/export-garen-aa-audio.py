"""Export every base/critical action, material branch, gain, pitch and source master.

Native script timing, shuffle/random state and bus/listener mix remain unverified.
"""
from pathlib import Path
import hashlib,json,math,subprocess,sys
sys.path.insert(0,'.tools/wwiser')
from wwiser.wfnv import Fnv
sha=lambda b:hashlib.sha256(b).hexdigest()
def write(path,raw):
    if not path.exists() or path.read_bytes()!=raw:path.write_bytes(raw)
graph_path=Path('docs/reference/garen-aa-audio.json');graph=json.loads(graph_path.read_text())
decoded=json.loads(Path('docs/reference/garen-aa-audio-decoded.json').read_text());assert decoded['sourceGraphSha256']==sha(graph_path.read_bytes())
nodes={n['id']:n for n in graph['nodes']}
for n in graph['nodes']:
    assert all(value=='0' for path,kind,value,label in n['parameters'] if 'RANGED_MODIFIERS' in path and path.endswith('/cProps')), n['id']
def parameter(identity,ending):
    f=[p for p in nodes[identity]['parameters'] if p[0].endswith('/'+ending)];assert len(f)==1,(identity,ending)
    return f[0][2]
def properties(identity):
    fields=nodes[identity]['parameters'];result={}
    for p in fields:
        if p[0].endswith('/pID'):
            key=p[3].split('[')[-1].removesuffix(']');assert key not in result
            result[key]=float(next(f[2] for f in fields if f[0]==p[0][:-3]+'pValue'))
    return result
materials={name:Fnv().get_hash(name) for name in ['Flesh','Metal','Stone','Wood']}
assert list(materials.values())==[1153642577,2473969246,1216965916,2058049674]
profiles=[];used=set()
for event in graph['events']:
    phase='cast' if event['name'].endswith('OnCast') else 'hit'
    kind='crit' if 'CritAttack_' in event['name'] else 'attack2' if 'BasicAttack2_' in event['name'] else 'attack1'
    assert len(event['actions'])==(2 if kind=='crit' else 1)
    for action_index,action in enumerate(event['actions']):
        target=action['target'];assert action['type']=='CAkActionPlay' and properties(action['id'])=={}
        assert int(parameter(action['id'],'eFadeCurve'))==4
        switch=nodes[target]['type']=='CAkSwitchCntr'
        assert int(parameter(target,'u16MaxNumInstance'))==(0 if switch else 2)
        targets={None:target}
        if switch:
            assert phase=='hit' and int(parameter(target,'ulGroupID'))==1559186049
            assert int(parameter(target,'ulDefaultSwitch'))==materials['Flesh']
            assert int(parameter(target,'ulNumSwitchGroups'))==4
            targets={}
            for i in range(4):
                label=next(k for k,v in materials.items() if v==int(parameter(target,f'CAkSwitchPackage:{i}/ulSwitchID')))
                assert int(parameter(target,f'CAkSwitchPackage:{i}/ulNumItems'))==1
                targets[label]=int(parameter(target,f'CAkSwitchPackage:{i}/NodeList/NodeID'))
        for material,container in targets.items():
            assert nodes[container]['type']=='CAkRanSeqCntr'
            props=properties(container);assert set(props).issubset({'MakeUpGain','Pitch'})
            if switch:assert properties(target)=={'MakeUpGain':{'attack1':-11,'attack2':-10,'crit':-13}[kind]}
            policy={k:int(parameter(container,k)) for k in ['eMode','eRandomMode','wAvoidRepeatCount','bResetPlayListAtEachPlay','bIsGlobal','bIsContinuous','_bIsUsingWeight','u16MaxNumInstance','bKillNewest','sLoopCount','sLoopModMin','sLoopModMax','eTransitionMode']}
            assert policy==dict(eMode=0,eRandomMode=1,wAvoidRepeatCount=0,bResetPlayListAtEachPlay=1,bIsGlobal=1,bIsContinuous=0,_bIsUsingWeight=0,u16MaxNumInstance=4 if switch else 2,bKillNewest=0,sLoopCount=1,sLoopModMin=0,sLoopModMax=0,eTransitionMode=0)
            variants=[]
            for i in range(int(parameter(container,'ulPlayListItem'))):
                sound=int(parameter(container,f'AkPlaylistItem:{i}/ulPlayID'));assert int(parameter(container,f'AkPlaylistItem:{i}/weight'))==50000
                assert int(parameter(sound,'DirectParentID'))==container
                sp=properties(sound);assert set(sp).issubset({'MakeUpGain','Priority'})
                assert sp.get('Priority',56)==56
                media=int(parameter(sound,'sourceID'));m=next(m for m in decoded['media'] if m['id']==media);used.add(media)
                assert m['sampleRate']==44100 and m['channels']==1 and m['decoderMetadata']['loopingInfo'] is None
                raw=Path(f'.cache/garen-aa-audio-decoded/{media}.wav').read_bytes();assert sha(raw)==m['wavSha256']
                output=Path(f'public/assets/audio/garen-aa-{media}.wav');write(output,raw)
                variants.append(dict(id=media,soundId=sound,url=str(output).removeprefix('public/'),sha256=m['wavSha256'],pcmSha256=m['pcmSha256'],frames=m['frames'],sampleRate=44100,channels=1,durationSeconds=m['durationSeconds'],gainDb=sp.get('MakeUpGain',0),peak=m['peak']))
            gain=props.get('MakeUpGain',0)+(properties(target).get('MakeUpGain',0) if switch else 0)
            profiles.append(dict(kind=kind,phase=phase,actionIndex=action_index,eventId=event['id'],actionId=action['id'],targetId=target,containerId=container,material=material,gainDb=gain,pitchCents=props.get('Pitch',0),policy=policy,variants=variants))
assert len(profiles)==17 and used=={m['id'] for m in graph['media']} and len(used)==34
assert properties(482318675)=={'Priority':56,'AttenuationID':134343538}
assert int(parameter(482318675,'OverrideBusId'))==211064428
assert int(parameter(134343538,'eScaling'))==2
attenuation=dict(id=134343538,scaling=2,unresolvedOutputBusId=211064428,priority=56,points=[dict(distance=float(parameter(134343538,f'AkRTPCGraphPoint:{i}/From')),storedValue=float(parameter(134343538,f'AkRTPCGraphPoint:{i}/To')),interpolation=int(parameter(134343538,f'AkRTPCGraphPoint:{i}/Interp'))) for i in range(3)])
output=Path('src/content/garen-aa-audio.ts')
raw='// Generated by tools/assets/export-garen-aa-audio.py. Native dispatch/shuffle/bus/listening remain open.\nexport const GAREN_AA_AUDIO = '+json.dumps(profiles,indent=2)+' as const;\nexport const GAREN_AA_ATTENUATION = '+json.dumps(attenuation,indent=2)+' as const;\n'
write(output,subprocess.check_output(['npx','prettier','--stdin-filepath',str(output)],input=raw.encode()))
tails={phase:math.ceil(max(v['durationSeconds']/2**(p['pitchCents']/1200) for p in profiles if p['phase']==phase for v in p['variants'])*60) for phase in ['cast','hit']}
write(Path('src/content/garen-aa-audio-timing.ts'),('// Generated from finite source durations, including authored pitch.\nexport const GAREN_AA_CAST_TICKS = '+str(tails['cast'])+';\nexport const GAREN_AA_HIT_TICKS = '+str(tails['hit'])+';\n').encode())
# Keep the armor-material value tied to a particular frozen skin record, including side-specific siege/super bodies.
rigs={};provenance=[]
def add(file,rig,path):
    p=Path('docs/reference/'+file+'.json');d=json.loads(p.read_text())
    for key in path:d=d[key]
    material=d['armorMaterial'];assert material in materials and rig not in rigs;rigs[rig]=material
    provenance.append(dict(rig=rig,path=str(p),sha256=sha(p.read_bytes()),recordPath=path,material=material))
for champ in ['ashe','lux','garen']:add(champ+'-model',champ+'-base',['skin','data',f'Characters/{champ.capitalize()}/Skins/Skin0'])
for side,word in [('blue','Order'),('red','Chaos')]:
    for kind,suffix in [('melee','Melee'),('caster','Ranged'),('siege','Siege'),('super','Super')]:
        name='SRU_'+word+'Minion'+suffix
        add('super-minion-definitions' if kind=='super' else 'minion-skins',side+'-'+kind,[name.lower(),'skins','data',f'Characters/{name}/Skins/Skin0'])
    add('turret-definitions',side+'-turret',[side,'skin','data',f'Characters/Turret/Skins/Skin{0 if side=="blue" else 3}'])
    for kind in ['nexus','inhibitor']:add('base-structure-definitions',side+'-'+kind,[side+'-'+kind,'skin','data',f'Characters/{kind.capitalize()}/Skins/Skin{0 if side=="blue" else 3}'])
for slug,name,pin in [('blue','Blue','jungle-character-source'),('gromp','Gromp','jungle-character-source'),('red','Red','red-brambleback-source'),('murkwolf','Murkwolf','wolf-camps-source'),('murkwolfmini','MurkwolfMini','wolf-camps-source'),('razorbeak','Razorbeak','raptor-camps-source'),('razorbeakmini','RazorbeakMini','raptor-camps-source'),('krug','Krug','krug-camps-source'),('krugmini','KrugMini','krug-camps-source'),('krugminimini','KrugMiniMini','krug-camps-source'),('crab','Crab','scuttler-source')]:
    path=['records',f'data/characters/sru_{slug}/skins/skin0.bin',f'Characters/{"Sru_Crab" if slug=="crab" else "SRU_"+name}/Skins/Skin0']
    add(pin,'sru-'+slug+'-base',path)
add('warding-totem-source','sightward-base',['records','data/characters/sightward/skins/skin0.bin','Characters/SightWard/Skins/Skin0'])
write(Path('src/content/attack-sound-materials.json'),(json.dumps(rigs,indent=2)+'\n').encode())
character=Path('docs/reference/garen-character.json');root=json.loads(character.read_text())['records']['Characters/Garen/CharacterRecords/Root']
for name,animation in [('GarenBasicAttack','Attack1'),('GarenBasicAttack2','Attack2'),('GarenCritAttack','Crit')]:
    spell=json.loads(character.read_text())['records']['Characters/Garen/Spells/'+name]['mSpell']
    assert spell['mApplyMaterialOnHitSound']
    if name=='GarenBasicAttack':assert 'mAnimationName' not in spell
    else:assert spell['mAnimationName']==animation
assert root['basicAttack']['mAttackProbability']==.5 and root['extraAttacks']==[{'mAttackProbability':.5,'mAttackName':'GarenBasicAttack2','__type':'AttackSlotData'}]
write(Path('docs/reference/garen-aa-source-reading.json'),(json.dumps(dict(graphSha256=sha(graph_path.read_bytes()),characterSha256=sha(character.read_bytes()),normalWeights=[.5,.5],firstAttackAnimationOverride=None,firstAttackLocalClip='Attack1',materialGroupId=1559186049,materialGroupNameResolved=False,materialValueHashes=materials,skinMaterials=provenance,limits=['Armor-material field to switch dispatch is a source-informed adapter; no native script/client was executed.','Cosmetic attack/variant choice uses saved identities, not native shuffle/RNG.','Unknown rigs use the authored Flesh default.']),indent=2)+'\n').encode())
print(json.dumps(dict(profiles=len(profiles),media=len(used),bytes=sum(m['wavBytes'] for m in decoded['media']),tails=tails,rigs=len(rigs))))
