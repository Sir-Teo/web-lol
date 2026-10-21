"""Decode the seven pinned R masters without baking in gain, fades or normalization."""
import json
from garen_audio_decode import decode_garen_audio
result = decode_garen_audio('r')
print(json.dumps([dict(id=m['id'], seconds=round(m['durationSeconds'],4), peak=round(m['peak'],4), loop=m['decoderMetadata']['loopingInfo']) for m in result['media']]))
