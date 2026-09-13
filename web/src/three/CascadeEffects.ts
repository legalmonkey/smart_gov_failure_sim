import * as THREE from 'three';
import { AssetRenderer } from './AssetRenderer';

interface PulseRing {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  scale: number;
  maxScale: number;
  speed: number;
  assetId: string;
}

export class CascadeEffects {
  public group: THREE.Group = new THREE.Group();
  private pulseRings: PulseRing[] = [];
  private ringGeometry: THREE.RingGeometry;

  constructor() {
    this.group.name = 'CascadeEffectsGroup';
    this.ringGeometry = new THREE.RingGeometry(2, 4, 32);
    this.ringGeometry.rotateX(-Math.PI / 2);
  }

  public triggerFailurePulse(assetId: string, assetRenderer: AssetRenderer, colorHex: number = 0xef4444): void {
    const pos = assetRenderer.getAssetWorldPosition(assetId);
    if (!pos) return;

    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });

    const mesh = new THREE.Mesh(this.ringGeometry, mat);
    mesh.position.set(pos.x, pos.y + 0.8, pos.z);
    this.group.add(mesh);

    this.pulseRings.push({
      mesh,
      material: mat,
      scale: 1,
      maxScale: 9,
      speed: 8,
      assetId,
    });
  }

  public update(deltaTime: number): void {
    for (let i = this.pulseRings.length - 1; i >= 0; i--) {
      const ring = this.pulseRings[i];
      ring.scale += ring.speed * deltaTime;
      ring.mesh.scale.set(ring.scale, 1, ring.scale);

      const progress = ring.scale / ring.maxScale;
      ring.material.opacity = Math.max(0, 0.9 * (1 - progress));

      if (progress >= 1.0) {
        this.group.remove(ring.mesh);
        ring.material.dispose();
        this.pulseRings.splice(i, 1);
      }
    }
  }
}
