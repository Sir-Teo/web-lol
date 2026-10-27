"""Complete authored Double Strike trail profiles using explicit current joint adapters."""
from masteryi_primary_trail_particles import profiles as trail_profiles
from masteryi_attack_trails import require
SYSTEMS=('MasterYi_P_Trail_1','MasterYi_P_Trail_2')
BINDINGS=tuple(zip(SYSTEMS,('Passive','Passive'),(6.,9.)))
def profiles(pin,textures,mesh_url,defaults):
 rows=trail_profiles(pin,textures,mesh_url,defaults,systems=SYSTEMS,role='double-strike-trail')
 require(all(p['blend']==4 and p['rawFlags']=={'blendMode':4,'isLocalOrientation':None,'particleIsLocalOrientation':None}for p in rows),'Passive requires authored blend4 and omitted local flags')
 return rows
