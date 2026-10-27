"""Deliver the reviewed finite Wuju Style profiles and unchanged float masters for runtime use."""
from pathlib import Path
import argparse
import copy
import json
import subprocess
from masteryi_e_audio import generate
from masteryi_audio_source import checked_bytes
from masteryi_audio_graph import write_outputs
from masteryi_e_audio import require

READING = Path('docs/reference/masteryi/e-audio-reading.json')
READING_SHA256 = '0ad6ee647ee981544da8e49752dd3be8577d1020f3eff2a299d41cb414799f54'


def generate_outputs():
    raw = checked_bytes(READING, READING_SHA256); record = json.loads(raw)
    require(generate() == record, 'Reviewed Wuju Style audio source reading differs')
    profiles = copy.deepcopy(record['profiles']); outputs = {}
    require([p['kind']for p in profiles]==['cast','activate','deactivate'], 'Finite Wuju Style profile closure differs')
    for p in profiles:
        p.update(pitchCents=0, delaySeconds=0)
        for clip in p['variants']:
            clip['sha256']=clip.pop('wavSha256'); clip['bytes']=clip.pop('wavBytes'); clip['gainDb']=0
            path = Path(f"public/assets/audio/masteryi-e-{clip['id']}.wav")
            outputs[path] = checked_bytes(clip.pop('privatePath'), clip['sha256'], clip['bytes'])
            clip['url'] = str(path).removeprefix('public/')
    path = Path('src/content/masteryi-e-audio.ts')
    text = '// Declared finite Wuju Style spell sounds. Dispatch, queue admission and bus mix are local adapters.\n'
    text += 'export const MASTER_YI_E_AUDIO = ' + json.dumps(profiles, indent=2) + ' as const;\n'
    text += 'export const MASTER_YI_E_ATTENUATION = ' + json.dumps(record['attenuation'], indent=2) + ' as const;\n'
    outputs[path] = subprocess.check_output(['npx','prettier','--stdin-filepath',str(path)],input=text.encode())
    outputs[Path('src/content/masteryi-e-audio-timing.ts')] = (
        '// Source recording bounds at unchanged 1x playback.\n'
        f"export const MASTER_YI_E_CAST_AUDIO_TICKS = {record['finiteTailTicks']['cast']};\n"
        f"export const MASTER_YI_E_ACTIVATE_AUDIO_TICKS = {record['finiteTailTicks']['activate']};\n"
        f"export const MASTER_YI_E_END_AUDIO_TICKS = {record['finiteTailTicks']['deactivate']};\n").encode()
    return list(outputs.items()), record


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('--check',action='store_true');args=parser.parse_args()
    outputs, record = generate_outputs(); write_outputs(outputs,args.check)
    print(json.dumps({key:record[key] for key in ['finiteTailTicks']}))
