"""Offline float-master integrity and provenance checks; also run with python -O."""
from pathlib import Path
import hashlib
import json
import struct
import tempfile
import unittest
from unittest.mock import patch
import masteryi_audio_decode as decoder


def fixture(samples=(0.25, -1.25, 2.0, -0.0), channels=1):
    rate = 44100
    pcm = b''.join(struct.pack('<f', v) for v in samples)
    fmt = struct.pack('<HHIIHH', 3, channels, rate, rate * channels * 4, channels * 4, 32)
    body = b'WAVEfmt ' + struct.pack('<I', len(fmt)) + fmt + b'data' + struct.pack('<I', len(pcm)) + pcm
    raw = b'RIFF' + struct.pack('<I', len(body)) + body
    meta = {'numberOfSamples': len(samples) // channels, 'channels': channels, 'sampleRate': rate, 'mixingInfo': {'inputChannels': channels, 'outputChannels': channels}}
    return raw, meta


def changed_fmt(raw, offset, format, value):
    data = bytearray(raw); struct.pack_into(format, data, 20 + offset, value)
    return bytes(data)


class WaveGuards(unittest.TestCase):
    def test_float_headroom_and_original_pcm_bits_are_retained(self):
        raw, meta = fixture(); before = bytes(raw)
        info = decoder.inspect_wave(raw, meta)
        self.assertEqual(info['peak'], 2)
        self.assertEqual(info['samplesOutsideUnitRange'], 2)
        self.assertEqual(info['frames'], 4)
        self.assertEqual(info['endpointDelta'], [-0.25])
        self.assertEqual(info['pcmSha256'], hashlib.sha256(raw[44:]).hexdigest())
        self.assertEqual(raw, before)

    def test_interleaved_channels_stay_unmixed(self):
        raw, meta = fixture((1.25, 0.5, -1.5, -0.25), 2)
        info = decoder.inspect_wave(raw, meta)
        self.assertEqual(info['channels'], 2)
        self.assertEqual(info['frames'], 2)
        self.assertEqual(info['endpointDelta'], [-2.75, -0.75])

    def test_silence_is_not_replaced_or_normalized(self):
        raw, meta = fixture((0, 0, 0))
        info = decoder.inspect_wave(raw, meta)
        self.assertEqual(info['peak'], 0)
        self.assertEqual(info['rms'], 0)

    def test_not_riff(self):
        raw, _ = fixture()
        with self.assertRaisesRegex(ValueError, 'RIFF/WAVE'): decoder.wave_chunks(b'RIFX' + raw[4:])

    def test_riff_extent(self):
        raw, _ = fixture()
        with self.assertRaisesRegex(ValueError, 'RIFF extent'): decoder.wave_chunks(raw[:-1])

    def test_chunk_overrun(self):
        raw, _ = fixture(); data = bytearray(raw); struct.pack_into('<I', data, 40, 999)
        with self.assertRaisesRegex(ValueError, 'chunk extent'): decoder.wave_chunks(bytes(data))

    def test_duplicate_chunk(self):
        body = b'WAVEJUNK' + struct.pack('<I', 0) + b'JUNK' + struct.pack('<I', 0)
        raw = b'RIFF' + struct.pack('<I', len(body)) + body
        with self.assertRaisesRegex(ValueError, 'duplicate'): decoder.wave_chunks(raw)

    def test_incomplete_chunk_header(self):
        body = b'WAVEdata'
        with self.assertRaisesRegex(ValueError, 'chunk header'): decoder.wave_chunks(b'RIFF' + struct.pack('<I', len(body)) + body)

    def test_missing_odd_chunk_padding(self):
        body = b'WAVEJUNK' + struct.pack('<I', 1) + b'x'
        with self.assertRaisesRegex(ValueError, 'padding'): decoder.wave_chunks(b'RIFF' + struct.pack('<I', len(body)) + body)

    def test_integer_pcm_is_not_a_float_master(self):
        raw, meta = fixture()
        with self.assertRaisesRegex(ValueError, 'float32'): decoder.inspect_wave(changed_fmt(raw, 0, '<H', 1), meta)

    def test_reduced_sample_precision(self):
        raw, meta = fixture()
        with self.assertRaisesRegex(ValueError, 'float32'): decoder.inspect_wave(changed_fmt(raw, 14, '<H', 16), meta)

    def test_changed_sample_rate(self):
        raw, meta = fixture(); meta['sampleRate'] = 48000
        with self.assertRaisesRegex(ValueError, 'sample rate'): decoder.inspect_wave(raw, meta)

    def test_changed_channel_count(self):
        raw, meta = fixture(); meta['channels'] = 2
        with self.assertRaisesRegex(ValueError, 'channels'): decoder.inspect_wave(raw, meta)

    def test_downmix_metadata(self):
        raw, meta = fixture(); meta['mixingInfo']['inputChannels'] = 2
        with self.assertRaisesRegex(ValueError, 'mixing'): decoder.inspect_wave(raw, meta)

    def test_byte_rate(self):
        raw, meta = fixture()
        with self.assertRaisesRegex(ValueError, 'byte rate'): decoder.inspect_wave(changed_fmt(raw, 8, '<I', 100), meta)

    def test_alignment(self):
        raw, meta = fixture()
        with self.assertRaisesRegex(ValueError, 'alignment'): decoder.inspect_wave(changed_fmt(raw, 12, '<H', 2), meta)

    def test_lost_frames(self):
        raw, meta = fixture(); meta['numberOfSamples'] += 1
        with self.assertRaisesRegex(ValueError, 'frame count'): decoder.inspect_wave(raw, meta)

    def test_boolean_frame_count(self):
        raw, meta = fixture((0.5,)); meta['numberOfSamples'] = True
        with self.assertRaisesRegex(ValueError, 'frame count'): decoder.inspect_wave(raw, meta)

    def test_nan(self):
        raw, meta = fixture((float('nan'),))
        with self.assertRaisesRegex(ValueError, 'Non-finite'): decoder.inspect_wave(raw, meta)

    def test_infinite_pcm(self):
        raw, meta = fixture((float('inf'),))
        with self.assertRaisesRegex(ValueError, 'Non-finite'): decoder.inspect_wave(raw, meta)

    def test_negative_infinite_pcm(self):
        raw, meta = fixture((float('-inf'),))
        with self.assertRaisesRegex(ValueError, 'Non-finite'): decoder.inspect_wave(raw, meta)


class ManifestGuards(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name); self.path = self.root / 'decoded.json'
        raw, meta = fixture(); (self.root / '7.wav').write_bytes(raw)
        self.graph = {'media': [{'id': 7, 'sha256': 'f' * 64}]}
        self.record = {'sourceGraphSha256': decoder.GRAPH_SHA256, 'decoder': {'binarySha256': 'b' * 64},
            'media': [{'id': 7, 'encodedSha256': 'f' * 64, **decoder.inspect_wave(raw, meta), 'decoderMetadata': meta}]}

    def save(self):
        data = (json.dumps(self.record, indent=2) + '\n').encode(); self.path.write_bytes(data)
        return hashlib.sha256(data).hexdigest()

    def check(self, digest):
        with patch.object(decoder, 'source_media', return_value=self.graph):
            return decoder.check_masters(self.path, masters=self.root, record_sha256=digest)

    def test_independent_check_needs_no_decoder_process(self):
        digest = self.save()
        with patch.object(decoder.subprocess, 'check_output', side_effect=AssertionError('Decoder process invoked')):
            self.assertEqual(self.check(digest), self.record)

    def test_metadata_tampering(self):
        digest = self.save(); self.path.write_bytes(self.path.read_bytes() + b' ')
        with self.assertRaisesRegex(ValueError, 'SHA-256'): self.check(digest)

    def test_missing_member(self):
        self.record['media'] = []
        with self.assertRaisesRegex(ValueError, 'membership'): self.check(self.save())

    def test_wrong_source_identity(self):
        self.record['media'][0]['encodedSha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'Encoded source'): self.check(self.save())

    def test_changed_wav_bits(self):
        digest = self.save(); path = self.root / '7.wav'; data = bytearray(path.read_bytes()); data[-1] ^= 1; path.write_bytes(data)
        with self.assertRaisesRegex(ValueError, 'SHA-256'): self.check(digest)

    def test_missing_master(self):
        digest = self.save(); (self.root / '7.wav').unlink()
        with self.assertRaises(FileNotFoundError): self.check(digest)

    def test_forged_pcm_statistics(self):
        self.record['media'][0]['rms'] = 0
        with self.assertRaisesRegex(ValueError, 'statistics'): self.check(self.save())

    def test_wrong_graph_identity(self):
        self.record['sourceGraphSha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'graph'): self.check(self.save())

    def test_bad_encoded_input_stops_before_decoder_access(self):
        graph = json.loads(decoder.GRAPH.read_text()); media = graph['media'][0]
        (self.root / f"{media['id']}.wem").write_bytes(b'bad')
        with patch.object(decoder, 'decoder_provenance', side_effect=AssertionError('Decoder accessed')):
            with self.assertRaisesRegex(ValueError, 'length'): decoder.decode('unused', 'unused', 'unused', media_root=self.root)


if __name__ == '__main__': unittest.main()
