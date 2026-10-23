"""Decode attack masters without normalization, resampling or gain/fade baking."""
import json
from garen_audio_decode import decode_garen_audio
result=decode_garen_audio('aa')
print(json.dumps([dict(id=m['id'],frames=m['frames'],peak=m['peak'],loop=m['decoderMetadata']['loopingInfo']) for m in result['media']]))
