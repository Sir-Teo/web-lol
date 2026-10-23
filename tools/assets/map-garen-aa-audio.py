"""Pin all six declared basic/critical attack SFX events from frozen Garen banks."""
import json
from garen_audio_graph import map_garen_audio
result=map_garen_audio('aa',6)
print(json.dumps(dict(events=result['events'],media=len(result['media']),nodes=len(result['nodes']),unresolvedHierarchyIds=result['unresolvedHierarchyIds'])))
