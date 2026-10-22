"""Export the two script-linked Gromp locators with explicit calendar policies."""
import hashlib
import json
from pathlib import Path

source = Path('docs/reference/jungle-script-source.json')
pin = json.loads(source.read_text())


def point(p):
    return dict(x=p[0] - 7425, y=7425 - p[2])


result = dict(sourcePin=str(source), sourcePinSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
              firstSpawnSeconds=67, respawnSeconds=135,
              firstSpawnEvidence='Published 26.1 standard Rift baseline; later-patch audit and native initialization remain open.',
              firstSpawnUrl='https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/',
              respawnEvidence='Local policy adopts the legacy script default; active 26.18 native configuration remains unverified.',
              camps=[dict(id=('order-gromp' if c['index'] == 13 else 'chaos-gromp'),
                          sourceIndex=c['index'], anchorEntity=c['anchorEntity'],
                          point=point(c['locator']['transform'][3]),
                          facingPoint=point(c['literalSettings']['VisualFacing'])) for c in pin['camps']],
              status='Interim Gromp camps; source locators and legacy membership are data-only. Current native activation, spawn animation, scaling, Smite and jungle roles remain unfinished.')
path = Path('src/content/rift-gromp-camps.json')
text = json.dumps(result, indent=2) + '\n'
if not path.exists() or path.read_text() != text:
    path.write_text(text)
print('Exported two Gromp camps; 67s published baseline and provisional 135s respawn')
