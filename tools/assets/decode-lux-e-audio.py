"""Decode pinned Lucent Singularity WEMs without gain, resampling or loop expansion."""
import json
from garen_audio_decode import decode_source_audio
result = decode_source_audio('lux-e')
print(json.dumps([dict(id=m['id'], seconds=round(m['durationSeconds'], 4), peak=round(m['peak'], 4),
                      loop=m['decoderMetadata']['loopingInfo']) for m in result['media']]))
