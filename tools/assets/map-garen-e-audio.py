"""Map every declared Judgment play/stop event and retain its full source policy."""
import json
from garen_audio_graph import map_garen_audio
result = map_garen_audio('e', 6)
print(json.dumps({key: result[key] for key in ['events', 'media', 'unresolvedHierarchyIds']}))
