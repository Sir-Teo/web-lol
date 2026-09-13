/** Warm every shipped interface face before exposing the battlefield or opening menus. */
export async function loadInterfaceFonts(): Promise<void> {
  const faces = [
    '500 14px "Beaufort for LOL"',
    '700 24px "Beaufort for LOL"',
    '400 14px "Spiegel"',
    '600 14px "Spiegel"',
    '700 14px "Spiegel"',
  ];
  const results = await Promise.allSettled(faces.map((face) => document.fonts.load(face)));
  // A missing cosmetic asset must not prevent the match from being playable.
  if (results.some((result) => result.status === 'rejected'))
    console.warn('Some interface fonts could not load; using fallback text.');
}
