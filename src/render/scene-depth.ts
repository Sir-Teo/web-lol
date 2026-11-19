import * as THREE from 'three';

/** Capture actual depth-writing materials, including their skinning and alpha tests. */
export class SceneDepth {
  target?: THREE.WebGLRenderTarget;
  private size = new THREE.Vector2();
  private frustum = new THREE.Frustum();
  private projScreen = new THREE.Matrix4();
  private pureBones = new WeakSet<THREE.Object3D>();
  private viewport = new THREE.Vector4();
  private scissor = new THREE.Vector4();
  private fullRegion = new THREE.Vector4();
  private isPureBoneSubtree(root: THREE.Object3D): boolean {
    for (let i = 0; i < root.children.length; i++) {
      const c = root.children[i];
      if (!(c as THREE.Bone).isBone || !this.isPureBoneSubtree(c)) return false;
    }
    return true;
  }
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
    // Refresh dirty transforms once while respecting frozen terrain and sleeping rigs.
    camera.updateMatrixWorld();
    scene.updateMatrixWorld();
    this.projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projScreen, camera.coordinateSystem);
    const hidden: THREE.Object3D[] = [];
    const visit = (o: THREE.Object3D) => {
      if (!o.visible || this.pureBones.has(o)) return;
      if ((o as THREE.Bone).isBone && this.isPureBoneSubtree(o)) {
        this.pureBones.add(o);
        return;
      }
      const material = (o as THREE.Mesh).material;
      if (material) {
        const materials = Array.isArray(material) ? material : [material];
        if (materials.every((m) => !m.depthWrite)) {
          hidden.push(o);
          o.visible = false;
          return;
        }
        const skinned = o as THREE.SkinnedMesh & {
          intersectsFrustum?: (f: THREE.Frustum) => boolean;
        };
        if (
          skinned.isSkinnedMesh &&
          (!skinned.frustumCulled ||
            !skinned.intersectsFrustum ||
            skinned.intersectsFrustum(this.frustum))
        ) {
          skinned.skeleton.update();
        }
      }
      for (let i = 0; i < o.children.length; i++) visit(o.children[i]);
    };
    visit(scene);
    const previous = renderer.getRenderTarget(),
      matrixUpdate = scene.matrixWorldAutoUpdate,
      shadows = renderer.shadowMap.autoUpdate,
      shadowsEnabled = renderer.shadowMap.enabled,
      scissorTest = renderer.getScissorTest();
    renderer.getViewport(this.viewport);
    renderer.getScissor(this.scissor);
    try {
      scene.matrixWorldAutoUpdate = false;
      renderer.shadowMap.autoUpdate = false;
      // A restored effect can request depth before the first normal frame has
      // allocated shadow maps. Sampling their null color-texture fallback as a
      // shadow sampler is invalid in WebGL2. Lighting cannot affect this depth
      // capture, so compile/render these same materials without shadow sampling.
      renderer.shadowMap.enabled = false;
      // Render-target rectangles are physical pixels, independent of the canvas pixel ratio.
      this.target.scissor.copy(
        region ?? this.fullRegion.set(0, 0, this.target.width, this.target.height)
      );
      this.target.scissorTest = !!region;
      renderer.setRenderTarget(this.target);
      renderer.setScissorTest(!!region);
      renderer.clear();
      renderer.render(scene, camera);
    } finally {
      for (const o of hidden) o.visible = true;
      scene.matrixWorldAutoUpdate = matrixUpdate;
      renderer.shadowMap.autoUpdate = shadows;
      renderer.shadowMap.enabled = shadowsEnabled;
      renderer.setRenderTarget(previous);
      renderer.setViewport(this.viewport);
      renderer.setScissor(this.scissor);
      renderer.setScissorTest(scissorTest);
    }
    return this.target;
  }
  dispose() {
    this.target?.dispose();
    this.target = undefined;
  }
}
