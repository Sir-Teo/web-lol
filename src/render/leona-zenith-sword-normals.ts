import * as THREE from 'three';
import pin from '../content/leona-e-sword-normals.json';

export const ZENITH_SWORD_NORMALS = pin;

async function digest(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', copy.buffer)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Attach only the separately derived stream, after checking its bytes and the
 * original expanded source-position order. No authored attribute is rewritten.
 * The geometry becomes the caller's derived render geometry; it stays owned by
 * that caller. This is a static algorithm delivery, not native GPU parity. */
export async function attachZenithSwordNormals(
  geometry: THREE.BufferGeometry,
  bytes: ArrayBuffer
): Promise<void> {
  const source = geometry.getAttribute('_source_position'),
    position = geometry.getAttribute('position');
  if (
    geometry.hasAttribute('normal') ||
    !source ||
    !(source.array instanceof Float32Array) ||
    source.itemSize !== 3 ||
    source.count !== pin.stream.corners ||
    !position ||
    !(position.array instanceof Float32Array) ||
    position.itemSize !== 3 ||
    position.count !== source.count
  )
    throw Error('Zenith sword normals require the original unmodified source corner streams');
  if (bytes.byteLength !== pin.stream.bytes)
    throw Error('Zenith sword normal byte length differs from the derived stream');
  // GLTFLoader may expose the original accessor as an interleaved view. Hash
  // only that attribute's expanded values, preserving the source corner order.
  const attributeBytes = (attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
    const values = new Float32Array(attribute.count * 3);
    for (let i = 0; i < attribute.count; i++) {
      values[i * 3] = attribute.getX(i);
      values[i * 3 + 1] = attribute.getY(i);
      values[i * 3 + 2] = attribute.getZ(i);
    }
    return new Uint8Array(values.buffer);
  };
  const [normalHash, sourceHash, positionHash] = await Promise.all([
    digest(new Uint8Array(bytes)),
    digest(attributeBytes(source)),
    digest(attributeBytes(position)),
  ]);
  if (
    normalHash !== pin.stream.sha256 ||
    sourceHash !== pin.sourceModel.sourcePositionSha256 ||
    positionHash !== pin.sourceModel.positionSha256
  )
    throw Error('Zenith sword normal or source-position identity differs');
  const input = new DataView(bytes),
    values = new Float32Array(pin.stream.corners * pin.stream.components);
  for (let i = 0; i < values.length; i++) values[i] = input.getFloat32(i * 4, true);
  for (let i = 0; i < values.length; i += 3)
    if (
      !Number.isFinite(values[i]) ||
      !Number.isFinite(values[i + 1]) ||
      !Number.isFinite(values[i + 2]) ||
      Math.hypot(values[i], values[i + 1], values[i + 2]) === 0
    )
      throw Error('Zenith sword derived normal is nonfinite or zero');
  geometry.setAttribute('normal', new THREE.BufferAttribute(values, 3));
  geometry.userData.derivedNormalSha256 = pin.stream.sha256;
}
