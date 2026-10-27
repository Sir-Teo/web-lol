"""Pin the declared Master Yi base SFX graph and encoded media without flattening it."""
import argparse
import json
from pathlib import Path
from masteryi_audio_graph import generate, write_outputs
from masteryi_audio_source import BANK_ROOT


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--parser-root', type=Path, required=True)
    parser.add_argument('--banks', type=Path, default=BANK_ROOT)
    parser.add_argument('--output', type=Path, default=Path('docs/reference/masteryi/audio-graph.json'))
    parser.add_argument('--media', type=Path, default=Path('.cache/masteryi-audio-media'))
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    graph, media = generate(args.parser_root, args.banks)
    outputs = [(args.output, (json.dumps(graph, indent=2) + '\n').encode())]
    outputs += [(args.media / f'{identity}.wem', data) for identity, data in sorted(media.items())]
    write_outputs(outputs, args.check)
    print(json.dumps({'events': len(graph['events']), 'nodes': len(graph['nodes']), 'media': len(media), 'encodedBytes': sum(len(data) for data in media.values()), 'unresolvedHierarchyIds': graph['unresolvedHierarchyIds']}))


if __name__ == '__main__': main()
