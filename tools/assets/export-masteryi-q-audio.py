"""Deliver the reviewed Q profiles and unchanged float masters for runtime use."""
from pathlib import Path
import argparse
import copy
import json
import subprocess
from masteryi_q_audio import generate
from masteryi_audio_source import checked_bytes
from masteryi_audio_graph import write_outputs
from masteryi_q_particles import require

READING = Path('docs/reference/masteryi/q-audio-reading.json')
READING_SHA256 = '343b05746caf37dddc151b92246861b11fb09270344c080e879d3f9c8531250e'


def generate_outputs():
    raw = checked_bytes(READING, READING_SHA256); record = json.loads(raw)
    require(generate() == record, 'Reviewed Q audio source reading differs')
    profiles = copy.deepcopy(record['profiles']); outputs = {}
    for p in profiles:
        for clip in p['variants']:
            path = Path(f"public/assets/audio/masteryi-q-{clip['id']}.wav")
            outputs[path] = checked_bytes(clip.pop('privatePath'), clip['sha256'], clip['bytes'])
            clip['url'] = str(path).removeprefix('public/')
    path = Path('src/content/masteryi-q-audio.ts')
    text = '// Declared Q particle sounds. Dispatch, indexed choices, queue admission and bus mix are local adapters.\n'
    text += 'export const MASTER_YI_Q_AUDIO = ' + json.dumps(profiles, indent=2) + ' as const;\n'
    text += 'export const MASTER_YI_Q_ATTENUATION = ' + json.dumps(record['attenuation'], indent=2) + ' as const;\n'
    outputs[path] = subprocess.check_output(['npx','prettier','--stdin-filepath',str(path)],input=text.encode())
    outputs[Path('src/content/masteryi-q-audio-timing.ts')] = (
        '// Source recording bounds include the slowest authored pitch endpoint.\n'
        f"export const MASTER_YI_Q_CAST_AUDIO_TICKS = {record['tails']['cast']};\n"
        f"export const MASTER_YI_Q_HIT_AUDIO_TICKS = {record['tails']['hit']};\n").encode()
    return list(outputs.items()), record


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('--check',action='store_true');args=parser.parse_args()
    outputs, record = generate_outputs(); write_outputs(outputs,args.check)
    print(json.dumps({key:record[key] for key in ['media','wavBytes','tails','peaksAboveOne']}))
