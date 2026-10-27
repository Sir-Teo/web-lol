export interface FloatMasterSpec {
  frames: number;
  sampleRate: number;
  channels: number;
}
/** Read authored float PCM directly: no decoder clipping, gain or resampling. */
export function floatSourceChannels(
  raw: ArrayBuffer,
  expected: FloatMasterSpec
): Float32Array<ArrayBuffer>[] {
  const bytes = new Uint8Array(raw),
    view = new DataView(raw);
  const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (
    bytes.length < 12 ||
    tag(0) !== 'RIFF' ||
    tag(8) !== 'WAVE' ||
    view.getUint32(4, true) + 8 !== bytes.length
  )
    throw Error('Invalid source WAV extent');
  const chunks = new Map<string, { start: number; length: number }>();
  let offset = 12;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw Error('Truncated source WAV header');
    const key = tag(offset),
      length = view.getUint32(offset + 4, true),
      start = offset + 8;
    if (chunks.has(key) || start + length > bytes.length) throw Error('Invalid source WAV chunk');
    chunks.set(key, { start, length });
    offset = start + length + (length % 2);
  }
  if (offset !== bytes.length) throw Error('Invalid source WAV padding');
  const format = chunks.get('fmt '),
    data = chunks.get('data');
  if (!format || format.length < 16 || !data) throw Error('Source WAV lacks format/data');
  const at = format.start,
    channels = view.getUint16(at + 2, true),
    rate = view.getUint32(at + 4, true),
    alignment = view.getUint16(at + 12, true);
  if (
    view.getUint16(at, true) !== 3 ||
    view.getUint16(at + 14, true) !== 32 ||
    !Number.isSafeInteger(channels) ||
    channels < 1 ||
    !Number.isSafeInteger(rate) ||
    rate < 1 ||
    channels !== expected.channels ||
    rate !== expected.sampleRate ||
    alignment !== channels * 4 ||
    view.getUint32(at + 8, true) !== rate * alignment ||
    !Number.isSafeInteger(expected.frames) ||
    expected.frames < 1 ||
    data.length !== expected.frames * alignment
  )
    throw Error('Source float PCM format or frame count differs');
  const result = Array.from({ length: channels }, () => new Float32Array(expected.frames));
  for (let i = 0; i < expected.frames; i++)
    for (let c = 0; c < channels; c++) {
      const value = view.getFloat32(data.start + i * alignment + c * 4, true);
      if (!Number.isFinite(value)) throw Error('Non-finite source float PCM');
      result[c][i] = value;
    }
  return result;
}
export function floatSourceBuffer(raw: ArrayBuffer, spec: FloatMasterSpec): AudioBuffer {
  const channels = floatSourceChannels(raw, spec);
  const buffer = new AudioBuffer({
    numberOfChannels: spec.channels,
    length: spec.frames,
    sampleRate: spec.sampleRate,
  });
  channels.forEach((data, c) => buffer.copyToChannel(data, c));
  return buffer;
}
export async function verifySourceWave(raw: ArrayBuffer, expectedSha256: string): Promise<void> {
  const digest = await crypto.subtle.digest('SHA-256', raw);
  const actual = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join(
    ''
  );
  if (actual !== expectedSha256) throw Error('Source WAV SHA-256 differs');
}
