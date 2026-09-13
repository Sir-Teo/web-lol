"""Reproduce frame inspection of Riot's Q demonstration, without inferring runtime constants."""
from pathlib import Path
import hashlib
import json
import subprocess

pin = json.loads(Path('docs/reference/ashe-q-video.json').read_text())
video = Path(pin['cache'])
raw = video.read_bytes()
assert len(raw) == pin['bytes'] and hashlib.sha256(raw).hexdigest() == pin['sha256']
page = Path(pin['pageCache']).read_bytes()
assert hashlib.sha256(page).hexdigest() == pin['pageSha256']
assert pin['url'] in page.decode()
metadata = json.loads(subprocess.check_output([
    'ffprobe', '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,r_frame_rate,duration', '-of', 'json', str(video)
]))['streams'][0]
assert metadata['width'] == pin['width'] and metadata['height'] == pin['height']
assert metadata['r_frame_rate'] == pin['fps']
assert float(metadata['duration']) == pin['durationSeconds']
output = Path('artifacts/ashe-q-reference')
output.mkdir(parents=True, exist_ok=True)
for selection in pin['inspectedFrames']:
    first, last = selection['first'], selection['last']
    grid = '4x4' if last-first+1 == 16 else '5x6'
    destination = output / f'frames-{first}-{last}.png'
    subprocess.run([
        'ffmpeg', '-v', 'error', '-i', str(video), '-vf',
        f'select=between(n\\,{first}\\,{last}),crop=390:310:510:80,tile={grid}',
        '-frames:v', '1', '-y', str(destination)
    ], check=True)
print('Verified official video provenance and reproduced three ordered frame sheets.')
print('These sheets are observations, not a validated current-patch timing specification.')
