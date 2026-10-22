"""Retain every selected/inherited parameter and encoded Oracle audio master."""
import json, struct, subprocess, sys, xml.etree.ElementTree as ET
from pathlib import Path
from riot_archive import sha
sys.path.insert(0,'.tools/wwiser')
from wwiser.wfnv import Fnv
revision='71654ed1a2c4642894bd7e7ed79eba66986fb770'
assert subprocess.check_output(['git','-C','.tools/wwiser','rev-parse','HEAD'],text=True).strip()==revision
pin_path=Path('docs/reference/oracle-audio-extraction.json');pin=json.loads(pin_path.read_text())
binding_path=Path('docs/reference/oracle-audio-bindings.json');binding=json.loads(binding_path.read_text())
files=[Path('.cache/oracle-audio-sources')/f['path'] for f in pin['extraction']['files']]
for path,item in zip(files,pin['extraction']['files']):assert sha(path.read_bytes())==item['sha256'] and path.stat().st_size==item['bytes']
subprocess.run([sys.executable,'.tools/wwiser/wwiser.py','-d','xml','-dn','.cache/oracle-audio-banks',*map(str,files)],check=True,stdout=subprocess.DEVNULL)
root=ET.fromstring(b'<banks>'+Path('.cache/oracle-audio-banks.xml').read_bytes()+b'</banks>')
assert all(int(b.get('version'))==145 for b in root)
index={}
for o in root.iter('object'):
    field=o.find("field[@name='ulID']")
    if field is not None:
        identity=int(field.get('value'));assert identity not in index;index[identity]=o
def number(node,key,default=None):
    f=node.find(f".//field[@name='{key}']");return default if f is None else int(f.get('value'))
def parameters(node,path=''):
    for child in node:
        here=path+'/'+child.get('name',child.tag)+(':'+child.get('index')if child.get('index')is not None else '')
        if child.tag=='field':yield[here,child.get('type'),child.get('value'),child.get('valuefmt')]
        yield from parameters(child,here)
selected=set();events=[];media_ids=set()
for name in [binding['activeEvent'],binding['activeEvent'].replace('Play_','Stop_',1),binding['endingEvent']]:
    identity=Fnv().get_hash(name);event=index[identity];assert event.get('name')=='CAkEvent';selected.add(identity);actions=[]
    for f in event.iter('field'):
        if f.get('name')!='ulActionID':continue
        action_id=int(f.get('value'));action=index[action_id];kind=action.get('name')
        assert kind in ['CAkActionPlay','CAkActionStop']
        target=number(action,'idExt');assert index[target].get('name')=='CAkSound'
        media=number(index[target],'sourceID');selected.update([action_id,target])
        if kind=='CAkActionPlay':media_ids.add(media)
        actions.append(dict(id=action_id,type=kind,target=target,mediaId=media))
    events.append(dict(name=name,id=identity,actions=actions))
inherited=set();unresolved=set();queue=list(selected)
while queue:
    o=index[queue.pop()];deps=[number(o,'DirectParentID',0),number(o,'OverrideBusId',0)]
    for prop in o.iter('object'):
        p=prop.find("field[@name='pID']")
        if p is not None and '[AttenuationID]'in p.get('valuefmt',''):deps.append(number(prop,'pValue',0))
    for dep in deps:
        if not dep or dep in selected or dep in inherited:continue
        if dep not in index:unresolved.add(dep)
        else:inherited.add(dep);queue.append(dep)
audio=next(p for p in files if p.name.endswith('_audio.bnk'));raw=audio.read_bytes();chunks={};offset=0
while offset<len(raw):
    tag,size=struct.unpack_from('<4sI',raw,offset);start=offset+8
    assert tag not in chunks and start+size<=len(raw);chunks[tag]=(start,size);offset=start+size
assert offset==len(raw)
start,size=chunks[b'DIDX'];assert size%12==0
entries={i:(o,s)for i,o,s in struct.iter_unpack('<III',raw[start:start+size])}
parsed={number(o,'id'):(number(o,'uOffset'),number(o,'uSize'))for o in root.iter('object')if o.get('name')=='MediaHeader'}
assert entries==parsed
out=Path('.cache/oracle-audio-media');out.mkdir(exist_ok=True);media=[]
for identity in sorted(media_ids):
    relative,length=entries[identity];base,size=chunks[b'DATA'];assert relative+length<=size
    encoded=raw[base+relative:base+relative+length];assert encoded[:4]==b'RIFF'
    (out/f'{identity}.wem').write_bytes(encoded);media.append(dict(id=identity,bankOffset=base+relative,bytes=length,sha256=sha(encoded)))
result=dict(extractionSha256=sha(pin_path.read_bytes()),bindingsSha256=sha(binding_path.read_bytes()),parserRevision=revision,
    events=events,nodes=[dict(id=i,type=index[i].get('name'),role='selected'if i in selected else'inherited',parameters=list(parameters(index[i])))for i in sorted(selected|inherited)],
    media=media,unresolvedHierarchyIds=sorted(unresolved),limits=['Full static parameter graphs do not recover native event dispatch, runtime RTPC values, bus processing, spatialization or audible native mix.'])
Path('docs/reference/oracle-audio.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(dict(events=events,media=media,nodes=len(result['nodes']),unresolved=result['unresolvedHierarchyIds'])))
