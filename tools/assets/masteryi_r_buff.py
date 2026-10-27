"""Lossless sustained Highlander source selection; no renderer defaults or dispatch."""
import copy,hashlib,json
from masteryi_r_particles import require
SYSTEMS=('MasterYi_R_Buf','MasterYi_R_Buf_Lvl2','MasterYi_R_Buf_Lvl3')
SELECTED_SHA256='32f4b53dadc30feea4a6f82848e0c98a3f55e6d8bebc5c8eb9ffbeda60580ce2'
def selected(pin):
 definitions={name:pin['resources'][name]['definition']for name in SYSTEMS}
 require(hashlib.sha256(json.dumps(definitions,sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest()==SELECTED_SHA256,'Frozen sustained Highlander definitions differ')
 require([len(definitions[name]['complexEmitterDefinitionData'])for name in SYSTEMS]==[3,3,4],'Sustained Highlander closure differs')
 require(all(d['soundPersistentDefault']=='Play_sfx_MasterYi_Highlander_trail'for d in definitions.values()),'Sustained Highlander persistent declaration differs')
 require(all('flags'not in d and 'soundOnCreateDefault'not in d for d in definitions.values()),'Sustained Highlander omissions differ')
 return copy.deepcopy(definitions)
