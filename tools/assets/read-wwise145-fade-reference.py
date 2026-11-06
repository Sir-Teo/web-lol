"""Execute pinned external Linear/Exp1 interpolation without an application import."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def require(ok, message):
    if not ok:
        raise ValueError(message)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    source = Path('.tools/wwiser/wwiser/generator/render/bnode_rtpc.py')
    revision = subprocess.check_output(['git', '-C', '.tools/wwiser', 'rev-parse', 'HEAD'], text=True).strip()
    require(revision == '71654ed1a2c4642894bd7e7ed79eba66986fb770' and source.read_bytes() ==
            subprocess.check_output(['git', '-C', '.tools/wwiser', 'show', 'HEAD:wwiser/generator/render/bnode_rtpc.py']),
            'Pinned external interpolation source differs')
    spec = importlib.util.spec_from_file_location('external_wwise_curve', source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    graph = module._AkGraph(None, 0)
    cases = [dict(curve=curve, t=t, initial=initial, target=target,
                  value=graph._AkInterpolation__InterpolateNoCheck(t, initial, target, curve))
             for curve in [4, 6] for initial, target in [(0, 1), (1, 0), (.2, 0), (.7, 0), (.2, .9)]
             for t in [0, .001, .05, .25, .5, .75, .95, .999, 1]]
    record = dict(format=1, referenceRevision=revision, referenceSourceSha256=sha(source.read_bytes()),
                  producerSha256=sha(Path(__file__).read_bytes()), symbol='_AkGraph._AkInterpolation__InterpolateNoCheck',
                  cases=cases, limits=['External reader interpolation fixture, not a native-client fade capture.',
                                      'Application scheduling/voice ownership and global mix are separate policies.'])
    raw = (json.dumps(record, indent=2) + '\n').encode()
    target = Path('docs/reference/wwise145-linear-exp1-reference.json')
    require(not target.exists() or target.read_bytes() == raw, 'Frozen fade reference differs')
    require(not args.check or target.exists(), 'Missing fade reference')
    if not args.check and not target.exists():
        with target.open('xb') as stream:
            stream.write(raw)
    print(json.dumps(dict(status='passed', cases=len(cases), curves=[4, 6], applicationImported=False)))
