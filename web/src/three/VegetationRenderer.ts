import * as THREE from 'three';
import type { GeoJsonFeature } from '../geo/geojsonTypes';
import { latLonToWorld } from '../geo/coordinateTransform';
import { createSeededRandom } from './BuildingTypology';

export class VegetationRenderer {
  public group: THREE.Group = new THREE.Group();

  private broadTreeMesh: THREE.InstancedMesh | null = null;
  private columnarTreeMesh: THREE.InstancedMesh | null = null;

  constructor() {
    this.group.name = 'UrbanVegetationGroup';
  }

  public renderVegetation(features: GeoJsonFeature[]): void {
    // Clean up existing meshes
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      if (child instanceof THREE.InstancedMesh) {
        child.geometry.dispose();
      }
    }

    const roadFeatures = features.filter((f) => f.properties.feature_type === 'road');
    const buildingFeatures = features.filter((f) => f.properties.feature_type === 'building');

    const broadTreeMatrices: THREE.Matrix4[] = [];
    const columnarTreeMatrices: THREE.Matrix4[] = [];

    // Hard cap to prevent thousands of instances
    const MAX_BROAD = 400;
    const MAX_COLUMNAR = 200;

    const dummy = new THREE.Object3D();
    const rng = createSeededRandom('vegetation_powai_seed_99');

    // 1. Roadside Street Trees — only on arterial/primary roads, sparse spacing
    roadFeatures.forEach((feat) => {
      if (broadTreeMatrices.length + columnarTreeMatrices.length >= MAX_BROAD + MAX_COLUMNAR) return;
      if (feat.geometry.type !== 'LineString') return;
      const coords = feat.geometry.coordinates as [number, number][];
      if (coords.length < 2) return;

      const roadClass = feat.properties.road_class || 'primary';
      if (roadClass !== 'arterial' && roadClass !== 'primary') return; // Skip secondary to limit count

      const spacing = 60; // Wider spacing = fewer trees
      const halfW = roadClass === 'arterial' ? 7.5 : 5.5;

      let distAccum = 0;
      for (let i = 0; i < coords.length - 1; i++) {
        if (broadTreeMatrices.length + columnarTreeMatrices.length >= MAX_BROAD + MAX_COLUMNAR) break;
        const p1 = latLonToWorld(coords[i][1], coords[i][0], 0);
        const p2 = latLonToWorld(coords[i + 1][1], coords[i + 1][0], 0);

        const segLen = p1.distanceTo(p2);
        if (segLen < 2) continue;

        const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
        const normal = new THREE.Vector3(-dir.z, 0, dir.x).normalize();

        while (distAccum < segLen) {
          if (broadTreeMatrices.length + columnarTreeMatrices.length >= MAX_BROAD + MAX_COLUMNAR) break;
          const t = distAccum / segLen;
          const pos = new THREE.Vector3().lerpVectors(p1, p2, t);

          // Only one side per position to halve count
          const side = rng() > 0.5 ? 1 : -1;
          if (rng() > 0.35) {
            const treePos = pos.clone().add(normal.clone().multiplyScalar(side * (halfW + 2.2)));
            const scale = 0.85 + rng() * 0.35;

            dummy.position.set(treePos.x, 0, treePos.z);
            dummy.rotation.set(0, rng() * Math.PI * 2, 0);
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();

            if (rng() > 0.45) {
              if (broadTreeMatrices.length < MAX_BROAD) broadTreeMatrices.push(dummy.matrix.clone());
            } else {
              if (columnarTreeMatrices.length < MAX_COLUMNAR) columnarTreeMatrices.push(dummy.matrix.clone());
            }
          }
          distAccum += spacing + (rng() - 0.5) * 12;
        }
        distAccum -= segLen;
      }
    });

    // 2. Courtyard trees — limit to first 100 buildings
    buildingFeatures.slice(0, 100).forEach((feat) => {
      if (broadTreeMatrices.length >= MAX_BROAD) return;
      if (feat.geometry.type !== 'Polygon') return;
      const ring = feat.geometry.coordinates[0] as [number, number][];
      if (ring.length < 3) return;

      const p0 = latLonToWorld(ring[0][1], ring[0][0], 0);
      if (rng() > 0.65) { // Sparser courtyard trees
        const offsetDist = 5 + rng() * 7;
        const angle = rng() * Math.PI * 2;
        const x = p0.x + Math.cos(angle) * offsetDist;
        const z = p0.z + Math.sin(angle) * offsetDist;
        const scale = 0.8 + rng() * 0.3;

        dummy.position.set(x, 0, z);
        dummy.rotation.set(0, rng() * Math.PI * 2, 0);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();

        broadTreeMatrices.push(dummy.matrix.clone());
      }
    });

    // 3. Powai Lake Promenade grove clusters — reduced count
    const groveCenters = [
      { x: -350, z: -300, radius: 140, count: 18 },
      { x: -180, z: -450, radius: 160, count: 22 },
      { x: 320, z: -550, radius: 200, count: 25 },
      { x: 500, z: -350, radius: 150, count: 15 },
      { x: 120, z: 250, radius: 120, count: 14 },
    ];

    groveCenters.forEach((g) => {
      for (let i = 0; i < g.count; i++) {
        if (broadTreeMatrices.length + columnarTreeMatrices.length >= MAX_BROAD + MAX_COLUMNAR) break;
        const r = Math.sqrt(rng()) * g.radius;
        const theta = rng() * Math.PI * 2;
        const x = g.x + Math.cos(theta) * r;
        const z = g.z + Math.sin(theta) * r;
        const scale = 0.9 + rng() * 0.5;

        dummy.position.set(x, 0, z);
        dummy.rotation.set(0, rng() * Math.PI * 2, 0);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();

        if (rng() > 0.35) {
          if (broadTreeMatrices.length < MAX_BROAD) broadTreeMatrices.push(dummy.matrix.clone());
        } else {
          if (columnarTreeMatrices.length < MAX_COLUMNAR) columnarTreeMatrices.push(dummy.matrix.clone());
        }
      }
    });

    // 4. Build Instanced Meshes
    if (broadTreeMatrices.length > 0) {
      const broadGeo = this.createBroadTreeGeometry();
      const broadMat = new THREE.MeshStandardMaterial({
        color: 0x2e5c33,
        roughness: 0.85,
        metalness: 0.05,
        flatShading: true,
      });

      this.broadTreeMesh = new THREE.InstancedMesh(broadGeo, broadMat, broadTreeMatrices.length);
      // No shadow casting on instanced trees — major perf win
      this.broadTreeMesh.castShadow = false;
      this.broadTreeMesh.receiveShadow = false;

      for (let i = 0; i < broadTreeMatrices.length; i++) {
        this.broadTreeMesh.setMatrixAt(i, broadTreeMatrices[i]);
      }
      this.broadTreeMesh.instanceMatrix.needsUpdate = true;
      this.group.add(this.broadTreeMesh);
    }

    if (columnarTreeMatrices.length > 0) {
      const columnarGeo = this.createColumnarTreeGeometry();
      const columnarMat = new THREE.MeshStandardMaterial({
        color: 0x3d6b38,
        roughness: 0.8,
        metalness: 0.05,
        flatShading: true,
      });

      this.columnarTreeMesh = new THREE.InstancedMesh(
        columnarGeo,
        columnarMat,
        columnarTreeMatrices.length
      );
      this.columnarTreeMesh.castShadow = false;
      this.columnarTreeMesh.receiveShadow = false;

      for (let i = 0; i < columnarTreeMatrices.length; i++) {
        this.columnarTreeMesh.setMatrixAt(i, columnarTreeMatrices[i]);
      }
      this.columnarTreeMesh.instanceMatrix.needsUpdate = true;
      this.group.add(this.columnarTreeMesh);
    }
  }

  private createBroadTreeGeometry(): THREE.BufferGeometry {
    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.6, 3.2, 6);
    trunkGeo.translate(0, 1.6, 0);

    // Canopy (dome/faceted crown)
    const crownGeo = new THREE.DodecahedronGeometry(2.3, 1);
    crownGeo.translate(0, 4.2, 0);

    // Combine into single buffer geometry for optimal single-call instancing
    return this.mergeGeometries([trunkGeo, crownGeo]);
  }

  private createColumnarTreeGeometry(): THREE.BufferGeometry {
    // Slender Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 4.8, 5);
    trunkGeo.translate(0, 2.4, 0);

    // Columnar Crown
    const crownGeo = new THREE.CylinderGeometry(0.4, 1.4, 4.6, 6);
    crownGeo.translate(0, 5.2, 0);

    return this.mergeGeometries([trunkGeo, crownGeo]);
  }

  private mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
    // Ensure all geometries have vertex normals computed before merging
    geos.forEach((g) => {
      if (!g.getAttribute('normal')) {
        g.computeVertexNormals(); // Returns void — must call first, then getAttribute below
      }
    });

    let totalVerts = 0;
    let totalIndices = 0;

    geos.forEach((g) => {
      const pos = g.getAttribute('position');
      totalVerts += pos ? pos.count : 0;
      const idx = g.getIndex();
      totalIndices += idx ? idx.count : 0;
    });

    const positions = new Float32Array(totalVerts * 3);
    const normals = new Float32Array(totalVerts * 3);
    const indices = new Uint32Array(totalIndices);

    let vOffset = 0;
    let iOffset = 0;

    geos.forEach((g) => {
      const pos = g.getAttribute('position');
      const norm = g.getAttribute('normal'); // Must be retrieved AFTER computeVertexNormals() call above
      const idx = g.getIndex();

      if (pos) {
        positions.set(pos.array as Float32Array, vOffset * 3);
        if (norm) {
          normals.set(norm.array as Float32Array, vOffset * 3);
        }

        if (idx) {
          for (let k = 0; k < idx.count; k++) {
            indices[iOffset + k] = idx.getX(k) + vOffset;
          }
          iOffset += idx.count;
        }
        vOffset += pos.count;
      }
      g.dispose();
    });

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    merged.setIndex(new THREE.BufferAttribute(indices, 1));
    return merged;
  }
}
