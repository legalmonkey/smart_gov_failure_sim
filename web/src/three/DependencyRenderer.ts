import * as THREE from 'three';
import type { Edge } from '../types/asset';
import { AssetRenderer } from './AssetRenderer';

interface EdgeVisual {
  edge: Edge;
  curve: THREE.QuadraticBezierCurve3;
  line: THREE.Line;
  pulseParticles: THREE.Points;
  originalColor: number;
}

export class DependencyRenderer {
  public group: THREE.Group = new THREE.Group();
  private edgeVisuals: Map<string, EdgeVisual> = new Map();
  private particleOffset: number = 0;

  constructor() {
    this.group.name = 'DependenciesGroup';
  }

  public renderDependencies(edges: Edge[], assetRenderer: AssetRenderer): void {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
    }
    this.edgeVisuals.clear();

    edges.forEach((edge) => {
      const fromPos = assetRenderer.getAssetWorldPosition(edge.from);
      const toPos = assetRenderer.getAssetWorldPosition(edge.to);
      if (!fromPos || !toPos) return;

      const mid = new THREE.Vector3().addVectors(fromPos, toPos).multiplyScalar(0.5);
      const dist = fromPos.distanceTo(toPos);
      mid.y += Math.min(45, dist * 0.25) + 6;

      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(fromPos.x, fromPos.y + 4, fromPos.z),
        mid,
        new THREE.Vector3(toPos.x, toPos.y + 4, toPos.z)
      );

      const points = curve.getPoints(32);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);

      let color = 0x38bdf8;
      if (edge.type === 'water_dependency') {
        color = 0x06b6d4;
      } else if (edge.type === 'emergency_route') {
        color = 0xf43f5e;
      } else if (edge.type === 'road_connection') {
        color = 0x94a3b8;
      }

      const lineMat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.75,
        linewidth: 2,
      });

      const line = new THREE.Line(lineGeo, lineMat);
      this.group.add(line);

      const pGeo = new THREE.BufferGeometry();
      const pCount = 5;
      const pPositions = new Float32Array(pCount * 3);
      pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));

      const pMat = new THREE.PointsMaterial({
        color,
        size: 4.5,
        transparent: true,
        opacity: 0.9,
      });

      const pulseParticles = new THREE.Points(pGeo, pMat);
      this.group.add(pulseParticles);

      this.edgeVisuals.set(edge.id, {
        edge,
        curve,
        line,
        pulseParticles,
        originalColor: color,
      });
    });
  }

  public update(deltaTime: number, affectedEdgeIds: string[]): void {
    this.particleOffset = (this.particleOffset + deltaTime * 0.4) % 1.0;

    this.edgeVisuals.forEach((ev, edgeId) => {
      const isFailed = affectedEdgeIds.includes(edgeId);

      const mat = ev.line.material as THREE.LineBasicMaterial;
      const pMat = ev.pulseParticles.material as THREE.PointsMaterial;

      if (isFailed) {
        mat.color.setHex(0xef4444);
        mat.opacity = 0.35;
        pMat.opacity = 0.0;
      } else {
        mat.color.setHex(ev.originalColor);
        mat.opacity = 0.75;
        pMat.opacity = 0.9;

        const posAttr = ev.pulseParticles.geometry.getAttribute(
          'position'
        ) as THREE.BufferAttribute;
        const count = posAttr.count;

        for (let i = 0; i < count; i++) {
          const t = (this.particleOffset + i / count) % 1.0;
          const pt = ev.curve.getPoint(t);
          posAttr.setXYZ(i, pt.x, pt.y, pt.z);
        }
        posAttr.needsUpdate = true;
      }
    });
  }
}
