"""Deliver the reviewed finite Meditate profiles and unchanged float masters for runtime use."""
from pathlib import Path
import argparse
import copy
import json
import subprocess
from masteryi_w_audio import generate
from masteryi_audio_source import checked_bytes
from masteryi_audio_graph import write_outputs
from masteryi_w_particles import require

READING = Path('docs/reference/masteryi/w-audio-reading.json')
READING_SHA256 = '3c49d4a653422133b7a23f4a250dd5c5d7c7b3a366683f91d4c611c4c830c7bc'


def generate_outputs():
    raw = checked_bytes(READING, READING_SHA256); record = json.loads(raw)
    require(generate() == record, 'Reviewed Meditate audio source reading differs')
    profiles = copy.deepcopy([p for p in record['profiles'] if p['kind'] in ('cast','deactivate')]); outputs = {}
    require([p['kind']for p in profiles]==['cast','deactivate'], 'Finite Meditate profile closure differs')
    for p in profiles:
        p.update(pitchCents=0, delaySeconds=0)
        for clip in p['variants']:
            clip['sha256']=clip.pop('wavSha256'); clip['bytes']=clip.pop('wavBytes'); clip['gainDb']=0
            path = Path(f"public/assets/audio/masteryi-w-{clip['id']}.wav")
            outputs[path] = checked_bytes(clip.pop('privatePath'), clip['sha256'], clip['bytes'])
            clip['url'] = str(path).removeprefix('public/')
    path = Path('src/content/masteryi-w-audio.ts')
    text = '// Declared finite Meditate spell sounds. Dispatch, queue admission and bus mix are local adapters.\n'
    text += 'export const MASTER_YI_W_AUDIO = ' + json.dumps(profiles, indent=2) + ' as const;\n'
    text += 'export const MASTER_YI_W_ATTENUATION = ' + json.dumps(record['attenuation'], indent=2) + ' as const;\n'
    outputs[path] = subprocess.check_output(['npx','prettier','--stdin-filepath',str(path)],input=text.encode())
    outputs[Path('src/content/masteryi-w-audio-timing.ts')] = (
        '// Source recording bounds at unchanged 1x playback.\n'
        f"export const MASTER_YI_W_CAST_AUDIO_TICKS = {record['finiteTailTicks']['cast']};\n"
        f"export const MASTER_YI_W_END_AUDIO_TICKS = {record['finiteTailTicks']['deactivate']};\n").encode()
    return list(outputs.items()), record


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('--check',action='store_true');args=parser.parse_args()
    outputs, record = generate_outputs(); write_outputs(outputs,args.check)
    print(json.dumps({key:record[key] for key in ['finiteTailTicks']}))
