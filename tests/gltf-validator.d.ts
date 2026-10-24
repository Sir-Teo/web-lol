// The installed Khronos validator ships JavaScript only. Type the byte-validation
// surface used by the source-asset audit; conversion scripts use the same API.
declare module 'gltf-validator' {
  const validator: {
    validateBytes(data: Uint8Array): Promise<{
      issues: { numErrors: number; numWarnings: number };
    }>;
  };
  export default validator;
}
