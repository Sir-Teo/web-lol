/** League BIN's lowercase ASCII FNV-1a names; accepts unresolved JSON field hashes. */
export function binFieldHash(name) {
  let hash = 0x811c9dc5;
  for (const char of name.toLowerCase())
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return `{${hash.toString(16).padStart(8, '0')}}`;
}
export function binField(record, name) {
  const hash = binFieldHash(name);
  const keys = Object.keys(record).filter(
    (key) => key === hash || key.toLowerCase() === name.toLowerCase()
  );
  if (keys.length > 1) throw new Error(`Ambiguous duplicate BIN field: ${name}`);
  return keys.length ? record[keys[0]] : undefined;
}
