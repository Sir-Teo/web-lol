"""Decode the complete original Ahri SFX corpus privately with immutable helpers."""
from pathlib import Path
from audio_float_corpus import main, require, sha

CORE_SHA = 'f43f4476cfad0ecbc2f0cd10be2a0e99d616f072f8ec8a80dedcc310c5bb42a5'
SPECIFICATION = {
    'graph': 'docs/reference/ahri-audio-graph.json',
    'graphSha256': '489b0ab33120dc347a8d8a6cbf5f70dc6818a81c7dbab85f540b1e70efa1ecf0',
    'mediaCount': 83,
    'encodedDirectory': '.cache/ahri-audio-media-v1',
    'decoderReference': 'docs/reference/baron-basic-audio-decoded.json',
    'decoderReferenceSha256': 'ce3dbe0278046a10a2899e41416f260e62fe96a98e1356e809f20879b137d908',
    'decoderHelper': 'tools/assets/decode-baron-basic-audio.py',
    'decoderHelperSha256': '5cbd26831b27bf5be77ac210470145f67ca8dc73f839fa3eabdb79884341933d',
    'record': 'docs/reference/ahri-audio-decoded.json',
    'outputDirectory': '.cache/ahri-audio-decoded-v1',
}

if __name__ == '__main__':
    require(sha(Path(__file__).with_name('audio_float_corpus.py').read_bytes()) == CORE_SHA,
            'Frozen float-corpus core differs')
    main(SPECIFICATION, __file__)
