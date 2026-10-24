import * as THREE from 'three';

/** Capture actual depth-writing materials, including their skinning and alpha tests. */
export class SceneDepth {
  target?: THREE.WebGLRenderTarget;
  private size = new THREE.Vector2();
  capture(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    region?: THREE.Vector4 | null
  ) {
    renderer.getDrawingBufferSize(this.size);
    if (!this.target) {
      this.target = new THREE.WebGLRenderTarget(this.size.x, this.size.y);
      this.target.depthTexture = new THREE.DepthTexture(
        this.size.x,
        this.size.y,
        THREE.UnsignedIntType
      );
    } else if (this.target.width !== this.size.x || this.target.height !== this.size.y)
      this.target.setSize(this.size.x, this.size.y);
    // A first depth pass must see the current pose, before the normal renderer
    // has initialized or refreshed each skinned mesh's GPU bone data.
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) (o as THREE.SkinnedMesh).skeleton.update();
    });
    const hidden: THREE.Object3D[] = [];
    scene.traverse((o) => {
      const material = (o as THREE.Mesh).material;
      if (!o.visible || !material) return;
      const materials = Array.isArray(material) ? material : [material];
      if (materials.every((m) => !m.depthWrite)) {
        hidden.push(o);
        o.visible = false;
      }
    });
    const previous = renderer.getRenderTarget(),
      shadows = renderer.shadowMap.autoUpdate,
      shadowsEnabled = renderer.shadowMap.enabled;
    const viewport = renderer.getViewport(new THREE.Vector4()),
      scissor = renderer.getScissor(new THREE.Vector4()),
      scissorTest = renderer.getScissorTest();
    try {
      renderer.shadowMap.autoUpdate = false;
      // A restored effect can request depth before the first normal frame has
      // allocated shadow maps. Sampling their null color-texture fallback as a
      // shadow sampler is invalid in WebGL2. Lighting cannot affect this depth
      // capture, so compile/render these same materials without shadow sampling.
      renderer.shadowMap.enabled = false;
      // Render-target rectangles are physical pixels, independent of the canvas pixel ratio.
      this.target.scissor.copy(
        region ?? new THREE.Vector4(0, 0, this.target.width, this.target.height)
      );
      this.target.scissorTest = !!region;
      renderer.setRenderTarget(this.target);
      renderer.setScissorTest(!!region);
      renderer.clear();
      renderer.render(scene, camera);
    } finally {
      for (const o of hidden) o.visible = true;
      renderer.shadowMap.autoUpdate = shadows;
      renderer.shadowMap.enabled = shadowsEnabled;
      renderer.setRenderTarget(previous);
      renderer.setViewport(viewport);
      renderer.setScissor(scissor);
      renderer.setScissorTest(scissorTest);
    }
    return this.target;
  }
  dispose() {
    this.target?.dispose();
    this.target = undefined;
  }
}
