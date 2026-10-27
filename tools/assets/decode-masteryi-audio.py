"""Create/check immutable float source masters; bank gains and loops stay separate."""
import argparse
import json
from pathlib import Path
from masteryi_audio_decode import DECODED, DECODED_SHA256, GRAPH, MASTER_ROOT, MEDIA_ROOT, check_masters, decode, sha
from masteryi_audio_graph import write_outputs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--decoder-root', type=Path)
    parser.add_argument('--ogg-root', type=Path)
    parser.add_argument('--vorbis-root', type=Path)
    parser.add_argument('--graph', type=Path, default=GRAPH)
    parser.add_argument('--media', type=Path, default=MEDIA_ROOT)
    parser.add_argument('--masters', type=Path, default=MASTER_ROOT)
    parser.add_argument('--output', type=Path, default=DECODED)
    parser.add_argument('--record-sha256', default=DECODED_SHA256)
    args = parser.parse_args()
    if args.check:
        record = check_masters(args.output, args.graph, args.media, args.masters, args.record_sha256)
    else:
        if not all([args.decoder_root, args.ogg_root, args.vorbis_root]): parser.error('All three pinned source roots are required to decode')
        record, waves = decode(args.decoder_root, args.ogg_root, args.vorbis_root, args.graph, args.media)
        encoded_record = (json.dumps(record, indent=2) + '\n').encode()
        if args.output.resolve() == DECODED.resolve() and sha(encoded_record) != DECODED_SHA256:
            raise ValueError('Different decoded provenance: use separate output/master paths for a reviewed build profile')
        outputs = [(args.masters / f'{identity}.wav', data) for identity, data in sorted(waves.items())]
        outputs.append((args.output, encoded_record))
        write_outputs(outputs)
    print(json.dumps({'media': len(record['media']), 'frames': sum(m['frames'] for m in record['media']), 'bytes': sum(m['wavBytes'] for m in record['media']), 'peak': max(m['peak'] for m in record['media']), 'mode': 'check' if args.check else 'decode'}))


if __name__ == '__main__': main()
