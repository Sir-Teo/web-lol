"""Inspect verified source banks with pinned wwiser; no runtime audio conversion."""
from pathlib import Path
import collections,hashlib,json,subprocess,sys
import xml.etree.ElementTree as ET

revision='71654ed1a2c4642894bd7e7ed79eba66986fb770'
tool=Path('.tools/wwiser')
assert subprocess.check_output(['git','-C',str(tool),'rev-parse','HEAD'],text=True).strip()==revision
pin_path=Path('docs/reference/lux-audio-extraction.json')
pin=json.loads(pin_path.read_text())
files=[Path('.cache/lux-audio-sources')/f['path'] for f in pin['files']]
for f,p in zip(pin['files'],files):
    raw=p.read_bytes()
    assert len(raw)==f['bytes'] and hashlib.sha256(raw).hexdigest()==f['sha256']
dump=Path('.cache/lux-audio-banks.xml')
subprocess.run([sys.executable,str(tool/'wwiser.py'),'-d','xml','-dn',str(dump.with_suffix('')),*map(str,files)],check=True)
root=ET.fromstring(b'<banks>'+dump.read_bytes()+b'</banks>')
banks=[]
for bank in root:
    counts=collections.Counter(o.get('name') for o in bank.iter('object'))
    banks.append(dict(name=bank.get('filename'),version=int(bank.get('version')),
        mediaCount=counts['MediaHeader'],soundObjects=counts['CAkSound'],events=counts['CAkEvent'],
        playActions=counts['CAkActionPlay'],stopActions=counts['CAkActionStop'],
        randomSequenceContainers=counts['CAkRanSeqCntr'],attenuations=counts['CAkAttenuation']))
result=dict(extractionSha256=hashlib.sha256(pin_path.read_bytes()).hexdigest(),
    parser=dict(repository='https://github.com/bnnm/wwiser',revision=revision),
    banks=banks,
    status='Source-bank inventory only; no event-to-media mapping, media decoding, listening comparison or runtime replacement has been completed.')
Path('docs/reference/lux-audio-inventory.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(banks))
