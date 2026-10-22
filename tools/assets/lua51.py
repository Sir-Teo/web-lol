"""Read stock little-endian Lua 5.1/64-bit chunks without executing bytecode.

Layout/opcodes follow Lua 5.1.5 src/lundump.c and src/lopcodes.h. This reader
deliberately rejects other ABIs. PCs are one-based, matching `luac -l`.
"""
import hashlib
import math
import struct

HEADER = bytes.fromhex('1b4c75615100010408040800')
OPCODES = ('MOVE LOADK LOADBOOL LOADNIL GETUPVAL GETGLOBAL GETTABLE SETGLOBAL '
           'SETUPVAL SETTABLE NEWTABLE SELF ADD SUB MUL DIV MOD POW UNM NOT LEN '
           'CONCAT JMP EQ LT LE TEST TESTSET CALL TAILCALL RETURN FORLOOP '
           'FORPREP TFORLOOP SETLIST CLOSE CLOSURE VARARG').split()


class Reader:
    def __init__(self, data):
        self.data, self.offset, self.prototypes = data, 0, 0

    def take(self, size):
        if size < 0 or size > len(self.data) - self.offset:
            raise ValueError('Truncated Lua chunk')
        start = self.offset
        self.offset += size
        return self.data[start:self.offset]

    def number(self, fmt):
        return struct.unpack('<' + fmt, self.take(struct.calcsize('<' + fmt)))[0]

    def count(self, minimum_size=1):
        count = self.number('i')
        if count < 0 or count > (len(self.data) - self.offset) // minimum_size:
            raise ValueError('Invalid Lua vector length')
        return count

    def string(self):
        size = self.number('Q')
        if size == 0:
            return None
        raw = self.take(size)
        if raw[-1] != 0:
            raise ValueError('Lua string is not NUL terminated')
        # Byte-preserving JSON representation, including non-UTF8 Lua strings.
        return raw[:-1].decode('latin1')

    def prototype(self, depth=0):
        if depth > 100 or self.prototypes > 10000:
            raise ValueError('Lua prototype limit exceeded')
        self.prototypes += 1
        start = self.offset
        source = self.string()
        first, last = self.number('i'), self.number('i')
        upvalues, params, vararg, stack = self.take(4)
        code = self.take(self.count(4) * 4)
        constants = []
        for _ in range(self.count()):
            tag = self.number('B')
            if tag == 0:
                value = None
            elif tag == 1:
                raw = self.number('B')
                if raw not in (0, 1):
                    raise ValueError('Invalid Lua boolean')
                value = bool(raw)
            elif tag == 3:
                value = self.number('d')
                if not math.isfinite(value):
                    raise ValueError('Non-finite Lua constant')
            elif tag == 4:
                value = self.string()
                if value is None:
                    raise ValueError('Null Lua string constant')
            else:
                raise ValueError(f'Unsupported Lua constant type {tag}')
            constants.append(value)
        children = [self.prototype(depth + 1) for _ in range(self.count())]
        lines = [self.number('i') for _ in range(self.count(4))]
        locals_ = [(self.string(), self.number('i'), self.number('i'))
                   for _ in range(self.count())]
        names = [self.string() for _ in range(self.count())]
        return dict(source=source, firstLine=first, lastLine=last, upvalues=upvalues,
                    params=params, vararg=vararg, stack=stack, constants=constants,
                    words=list(struct.unpack('<' + 'I' * (len(code) // 4), code)),
                    codeSha256=hashlib.sha256(code).hexdigest(), children=children,
                    lines=lines, locals=locals_, upvalueNames=names, offset=start,
                    bytes=self.offset - start)


def read_chunk(data):
    r = Reader(data)
    if r.take(len(HEADER)) != HEADER:
        raise ValueError('Expected Lua 5.1 little-endian 64-bit size_t ABI')
    root = r.prototype()
    if r.offset != len(data):
        raise ValueError('Trailing bytes after Lua chunk')
    return root


def instruction(proto, pc):
    word = proto['words'][pc - 1]
    opcode, a = word & 63, (word >> 6) & 255
    if opcode >= len(OPCODES):
        raise ValueError('Invalid Lua opcode')
    op, b, c, bx = OPCODES[opcode], word >> 23, (word >> 14) & 511, word >> 14
    constants = proto['constants']

    def rk(value):
        return {'constant': constants[value & 255]} if value & 256 else {'register': value}

    if op in ('LOADK', 'GETGLOBAL', 'SETGLOBAL'):
        operands = [a, {'constant': constants[bx]}]
    elif op == 'CLOSURE':
        operands = [a, {'prototype': bx}]
    elif op in ('JMP', 'FORLOOP', 'FORPREP'):
        operands = [a, {'targetPc': pc + 1 + bx - 131071}]
    elif op in ('SETTABLE', 'ADD', 'SUB', 'MUL', 'DIV', 'MOD', 'POW', 'EQ', 'LT', 'LE'):
        operands = [a, rk(b), rk(c)]
    elif op in ('GETTABLE', 'SELF'):
        operands = [a, b, rk(c)]
    else:
        operands = [a, b, c]
    return dict(pc=pc, word=f'{word:08x}', op=op, operands=operands)


def named_functions(root):
    """Recognize direct CLOSURE/SETGLOBAL pairs, never infer a callable runtime."""
    result = {'<main>': root}
    for pc in range(1, len(root['words'])):
        a, b = instruction(root, pc), instruction(root, pc + 1)
        if a['op'] == 'CLOSURE' and b['op'] == 'SETGLOBAL' and a['operands'][0] == b['operands'][0]:
            result[b['operands'][1]['constant']] = root['children'][a['operands'][1]['prototype']]
    return result
