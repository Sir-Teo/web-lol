import * as THREE from 'three';

/** A caller-selected distortion display list. Copy the actual canvas bytes and
 * render over the existing color/depth without re-rendering the color scene or
 * converting it through a render target. No E mode is implicitly mapped here.
 * Owns only its lazy framebuffer copy; callers own scene geometry/materials. */
export class ParticleDistortionPass {
  readonly scene = new THREE.Scene();
  frame: THREE.FramebufferTexture | undefined;
  private size = new THREE.Vector2();
  private viewport = new THREE.Vector4();
  render(renderer: THREE.WebGLRenderer, camera: THREE.Camera): boolean {
    const materials = new Set<THREE.ShaderMaterial>();
    this.scene.traverseVisible((object) => {
      if (
        !(object instanceof THREE.Mesh) ||
        !camera.layers.test(object.layers) ||
        object.geometry.drawRange.count === 0
      )
        return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!material.visible) continue;
        if (
          !(material instanceof THREE.ShaderMaterial) ||
          !material.uniforms.backBuffer ||
          !material.uniforms.screenRect
        )
          throw Error('Distortion display list requires a source distortion material');
        materials.add(material);
      }
    });
    if (!materials.size) {
      this.dispose();
      return false;
    }
    if (renderer.getContext().isContextLost()) return false;
    if (
      renderer.getRenderTarget() !== null ||
      this.scene.background !== null ||
      this.scene.overrideMaterial !== null
    )
      throw Error('Distortion copy requires the canvas and an unmodified display list');
    // RGB opaque canvases cannot be copied into RGBA8 storage in WebGL2.
    // Keep raw bytes and match the source channel format without color decoding.
    const format = renderer.getContext().getContextAttributes()?.alpha === false ? 'RGB8' : 'RGBA8';
    renderer.getDrawingBufferSize(this.size);
    renderer.getCurrentViewport(this.viewport);
    if (
      !this.frame ||
      this.frame.image.width !== this.size.x ||
      this.frame.image.height !== this.size.y ||
      this.frame.internalFormat !== format
    ) {
      this.frame?.dispose();
      this.frame = new THREE.FramebufferTexture(this.size.x, this.size.y);
      this.frame.internalFormat = format;
      this.frame.minFilter = this.frame.magFilter = THREE.LinearFilter;
      this.frame.wrapS = this.frame.wrapT = THREE.ClampToEdgeWrapping;
      this.frame.colorSpace = THREE.NoColorSpace;
    }
    for (const m of materials) {
      m.uniforms.backBuffer.value = this.frame;
      m.uniforms.screenRect.value.set(
        this.viewport.x / this.size.x,
        this.viewport.y / this.size.y,
        this.viewport.z / this.size.x,
        this.viewport.w / this.size.y
      );
    }
    const autoClear = renderer.autoClear,
      shadows = renderer.shadowMap.autoUpdate,
      autoReset = renderer.info.autoReset;
    try {
      renderer.autoClear = false;
      renderer.shadowMap.autoUpdate = false;
      renderer.info.autoReset = false;
      renderer.copyFramebufferToTexture(this.frame);
      renderer.render(this.scene, camera);
    } finally {
      renderer.autoClear = autoClear;
      renderer.shadowMap.autoUpdate = shadows;
      renderer.info.autoReset = autoReset;
    }
    return true;
  }
  dispose() {
    this.frame?.dispose();
    this.frame = undefined;
  }
}
