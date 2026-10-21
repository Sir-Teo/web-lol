"""Pin Decisive Strike's declared Q/QAttack play and stop graphs."""
import json
from garen_audio_graph import map_garen_audio
result = map_garen_audio('q', 5)
print(json.dumps(dict(events=result['events'], media=len(result['media']), nodes=len(result['nodes']), unresolvedHierarchyIds=result['unresolvedHierarchyIds'])))
