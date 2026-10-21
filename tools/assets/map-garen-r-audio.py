"""Pin every declared Demacian Justice SFX graph, including the Champ_Kill particle event."""
import json
from garen_audio_graph import map_garen_audio
result = map_garen_audio('r', 3)
print(json.dumps(dict(events=result['events'], media=len(result['media']), nodes=len(result['nodes']), unresolvedHierarchyIds=result['unresolvedHierarchyIds'])))
