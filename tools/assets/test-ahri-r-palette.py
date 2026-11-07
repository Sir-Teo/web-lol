"""Guard native palette identity and preserve omitted constructor declarations."""
from pathlib import Path
import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
from copy import deepcopy
root = Path.cwd()
spec = importlib.util.spec_from_file_location('r_palette', root/'tools/assets/read-ahri-r-palette.py')
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
source = json.loads((root/module.SOURCE).read_bytes())
content = json.loads((root/module.CONTENT).read_bytes())
base = module.build(root)
def require(ok, message):
    if not ok:
        raise ValueError(message)
def reject(action, message):
    try:
        action()
    except (ValueError, KeyError, TypeError):
        return
    raise ValueError(message)
original_checked = module.checked
original_name = module.NAME
module.NAME = 'paletteSrcMixColor'
reject(lambda: module.build(root), 'Corrected spelling accepted instead of native spelling')
module.NAME = original_name
for case in range(7):
    changed_source, changed_content = deepcopy(source), deepcopy(content)
    emitter = changed_source['resources']['Ahri_R_mis_02']['definition']['complexEmitterDefinitionData'][8]
    palette = emitter['paletteDefinition']
    published = changed_content['profiles'][30]
    if case == 0: palette[module.FIELD]['__type'] = 'ValueVector4'
    if case == 1: palette[module.FIELD]['constantValue'][0] = 0.95
    if case == 2: changed_source['resources']['Ahri_R_mis_02']['definition']['complexEmitterDefinitionData'].append(deepcopy(emitter))
    if case == 3: palette['paletteCount'] = 1
    if case == 4: published['palette']['count'] = 1
    if case == 5: published['sourceDeclaration']['paletteDefinition'][module.FIELD]['constantValue'][0] = 1
    if case == 6: published['palette']['unresolvedFields'] = {}
    module.checked = lambda _root,name,_sha: deepcopy(changed_source if name == module.SOURCE else changed_content)
    reject(lambda: module.build(root), 'Altered palette structure accepted: '+str(case))
module.checked = original_checked
with tempfile.TemporaryDirectory(prefix='ahri-r-palette-') as tmp:
    target = Path(tmp)
    for name in [module.SOURCE,module.CONTENT,module.OUTPUT]:
        path = target/name; path.parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(root/name,path)
    flags = ['-O'] if sys.flags.optimize else []
    def run():
        return subprocess.run([sys.executable,*flags,str(root/'tools/assets/read-ahri-r-palette.py'),'--check'],cwd=target,capture_output=True)
    require(run().returncode == 0, 'Portable reading requires private references')
    for name in [module.SOURCE,module.CONTENT]:
        path = target/name; raw = path.read_bytes(); path.write_bytes(raw[:-1])
        require(run().returncode != 0, 'Changed source pin accepted: '+name); path.write_bytes(raw)
    path = target/module.CONTENT; raw = path.read_bytes(); path.unlink(); path.symlink_to(root/module.CONTENT)
    require(run().returncode != 0, 'Linked public profile accepted'); path.unlink(); path.write_bytes(raw)
    path = target/module.OUTPUT; raw = path.read_bytes(); path.write_bytes(raw[:-1])
    require(run().returncode != 0, 'Corrupt reading accepted')
print(json.dumps(dict(result='passed',optimized=bool(sys.flags.optimize),structuralRejections=8,sourcePinMutations=2,privateInputsRequired=False,runtimeChanged=False)))
