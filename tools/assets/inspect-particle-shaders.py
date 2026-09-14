"""Disassemble the pinned Metal samples without executing them.

Requires an existing llvm-dis executable supplied through --llvm-dis.
Raw programs and disassembly stay in the ignored cache.
"""
import argparse
import hashlib
import json
import struct
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--llvm-dis', required=True)
args = parser.parse_args()
pin_path = Path('docs/reference/particle-shaders.json')
pin = json.loads(pin_path.read_text())
results = []
for entry in pin['selections']:
    path = Path(entry['output'])
    raw = path.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == entry['sha256']
    # LLVM bitcode wrapper: magic, version, payload offset, payload size, CPU.
    marker = bytes.fromhex('dec0170b')
    start = raw.find(marker)
    assert start >= 0 and raw.find(marker, start + 1) == -1
    magic, version, offset, size, cpu = struct.unpack_from('<5I', raw, start)
    assert version == 0 and offset == 20 and cpu == 0xffffffff
    assert start + offset + size <= len(raw)
    bitcode = raw[start + offset:start + offset + size]
    assert bitcode[:4] == b'BC\xc0\xde'
    bc = path.with_suffix('.bc')
    ll = path.with_suffix('.ll')
    bc.write_bytes(bitcode)
    subprocess.run([args.llvm_dis, str(bc), '-o', str(ll)], check=True)
    text = ll.read_text()
    assert '@wrapped_main' in text and 'air64-apple-macosx10.11.0' in text
    results.append({'source': str(path), 'sourceSha256': entry['sha256'],
                    'bitcodeOffset': start + offset, 'bitcodeBytes': size,
                    'bitcodeSha256': hashlib.sha256(bitcode).hexdigest(),
                    'disassembly': str(ll),
                    'disassemblySha256': hashlib.sha256(ll.read_bytes()).hexdigest()})
report = {'pinSha256': hashlib.sha256(pin_path.read_bytes()).hexdigest(),
          'llvmDisVersion': subprocess.check_output([args.llvm_dis, '--version'], text=True).strip(),
          'programs': results}
Path('artifacts/particle-shader-disassembly.json').write_text(json.dumps(report, indent=2) + '\n')
print(f'Disassembled {len(results)} pinned Metal programs; none executed')
