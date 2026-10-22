"""Decode the three pinned Oracle masters without changing any source samples."""
from garen_audio_decode import decode_source_audio
import json
report = decode_source_audio('oracle')
print(json.dumps([dict(id=m['id'], frames=m['frames'], peak=m['peak']) for m in report['media']]))
