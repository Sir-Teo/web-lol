"""Pin all Courage SFX play/stop graphs from the frozen Garen soundbank."""
import json
from garen_audio_graph import map_garen_audio
result = map_garen_audio('w', 4)
print(json.dumps(dict(events=result['events'], media=len(result['media']), nodes=len(result['nodes']), unresolvedHierarchyIds=result['unresolvedHierarchyIds'])))
