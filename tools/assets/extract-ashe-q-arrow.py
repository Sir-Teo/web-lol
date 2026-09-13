from pathlib import Path
import json, hashlib
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive
source=Path('.cache/ashe-vfx/580213cc594896a4.json')
key='Characters/Ashe/Skins/Skin0/Particles/Ashe_Base_Q_mis'
record=json.loads(source.read_text())[key]
e=next(e for e in record['complexEmitterDefinitionData'] if e['emitterName']=='icearrow')
paths=[e['primitive']['mMesh']['mSimpleMeshName'].lower(),e['texture'].lower()]
toc='data/final/champions/ashe.wad.subchunktoc'
a=RiotArchive({f'{xxh64_intdigest(p):016x}':p for p in paths+[toc]},archive_name='DATA/FINAL/Champions/Ashe.wad.client')
a.extract(paths,Path('.cache/q-arrow-sources'))
pin={'status':'Source mesh preparation; no five-arrow launch timing verified','definitionCache':str(source),'definitionSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'record':key,'data':record,'extraction':a.provenance()}
Path('docs/reference/ashe-q-arrow.json').write_text(json.dumps(pin,indent=2)+'\n')
print('Extracted source Q arrow mesh and texture')
