import * as THREE from 'three';
import type { GeoJsonFeature } from '../geo/geojsonTypes';
import { latLonToWorld } from '../geo/coordinateTransform';

export class RoadRenderer {
  public group: THREE.Group = new THREE.Group();

  private matSidewalk: THREE.MeshStandardMaterial;
  private matArterial: THREE.MeshStandardMaterial;
  private matPrimary: THREE.MeshStandardMaterial;
  private matSecondary: THREE.MeshStandardMaterial;
  private matAccess: THREE.MeshStandardMaterial;
  private matEmergency: THREE.MeshStandardMaterial;
  private matLaneWhite: THREE.MeshBasicMaterial;
  private matLaneYellow: THREE.MeshBasicMaterial;

  constructor() {
    this.group.name = 'RoadsGroup';

    // Concrete sidewalk / curb base
    this.matSidewalk = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1, // Light urban concrete sidewalk
      roughness: 0.95,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });

    // Dark charcoal asphalt for arterial expressways
    this.matArterial = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.82,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    // Clean primary avenue asphalt
    this.matPrimary = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.85,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });

    // Secondary street asphalt
    this.matSecondary = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.88,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    // Local / access way
    this.matAccess = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.9,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    // Emergency corridor
    this.matEmergency = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.6,
      metalness: 0.15,
      side: THREE.DoubleSide,
    });

    // Traffic lane markings
    this.matLaneWhite = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      side: THREE.DoubleSide,
    });

    this.matLaneYellow = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      side: THREE.DoubleSide,
    });
  }

  public renderRoads(features: GeoJsonFeature[]): void {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    }

    const roadFeatures = features.filter((f) => f.properties.feature_type === 'road');

    roadFeatures.forEach((feat) => {
      if (feat.geometry.type !== 'LineString') return;
      const coords = feat.geometry.coordinates as [number, number][];
      if (coords.length < 2) return;

      const roadClass = feat.properties.road_class || 'primary';
      const isEmergency =
        roadClass === 'emergency' ||
        feat.properties.name?.toLowerCase().includes('emergency');

      let roadW = 5.0;
      let sidewalkW = 7.4;
      let asphaltMat = this.matSecondary;
      let hasCenterLine = false;
      let isArterial = false;

      if (isEmergency) {
        roadW = 6.0;
        sidewalkW = 8.2;
        asphaltMat = this.matEmergency;
        hasCenterLine = true;
      } else if (roadClass === 'arterial') {
        roadW = 12.0;
        sidewalkW = 15.0;
        asphaltMat = this.matArterial;
        hasCenterLine = true;
        isArterial = true;
      } else if (roadClass === 'primary') {
        roadW = 8.0;
        sidewalkW = 10.4;
        asphaltMat = this.matPrimary;
        hasCenterLine = true;
      } else if (roadClass === 'secondary') {
        roadW = 5.0;
        sidewalkW = 7.2;
        asphaltMat = this.matSecondary;
      } else {
        roadW = 3.6;
        sidewalkW = 5.0;
        asphaltMat = this.matAccess;
      }

      const points: THREE.Vector3[] = coords.map(([lon, lat]) =>
        latLonToWorld(lat, lon, 0)
      );

      // Layer 1: Concrete Sidewalk & Curb (Wider base at y = 0.08)
      const sidewalkPoints = points.map((p) => new THREE.Vector3(p.x, 0.08, p.z));
      const sidewalkGeo = this.createRoadRibbonGeometry(sidewalkPoints, sidewalkW);
      if (sidewalkGeo) {
        const sidewalkMesh = new THREE.Mesh(sidewalkGeo, this.matSidewalk);
        sidewalkMesh.receiveShadow = true;
        this.group.add(sidewalkMesh);
      }

      // Layer 2: Asphalt Driving Deck (at y = 0.14)
      const asphaltPoints = points.map((p) => new THREE.Vector3(p.x, 0.14, p.z));
      const asphaltGeo = this.createRoadRibbonGeometry(asphaltPoints, roadW);
      if (asphaltGeo) {
        const asphaltMesh = new THREE.Mesh(asphaltGeo, asphaltMat);
        asphaltMesh.receiveShadow = true;
        asphaltMesh.userData = {
          osm_id: feat.properties.osm_id,
          name: feat.properties.name,
          type: 'road',
          road_class: roadClass,
        };
        this.group.add(asphaltMesh);
      }

      // Layer 3: Lane Markings for Arterial and Primary Avenues (at y = 0.17)
      if (hasCenterLine) {
        const lanePoints = points.map((p) => new THREE.Vector3(p.x, 0.17, p.z));
        const laneGeo = this.createRoadRibbonGeometry(lanePoints, 0.38);
        if (laneGeo) {
          const laneMat = isArterial ? this.matLaneYellow : this.matLaneWhite;
          const laneMesh = new THREE.Mesh(laneGeo, laneMat);
          this.group.add(laneMesh);
        }
      }
    });
  }

  private createRoadRibbonGeometry(
    points: THREE.Vector3[],
    width: number
  ): THREE.BufferGeometry | null {
    if (points.length < 2) return null;

    const halfW = width / 2;
    const vertices: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      let dir = new THREE.Vector3();

      if (i === 0) {
        dir.subVectors(points[1], points[0]).normalize();
      } else if (i === points.length - 1) {
        dir.subVectors(points[points.length - 1], points[points.length - 2]).normalize();
      } else {
        const d1 = new THREE.Vector3().subVectors(points[i], points[i - 1]).normalize();
        const d2 = new THREE.Vector3().subVectors(points[i + 1], points[i]).normalize();
        dir.addVectors(d1, d2).normalize();
      }

      const normal = new THREE.Vector3(-dir.z, 0, dir.x).normalize();

      const left = new THREE.Vector3().addVectors(p, normal.clone().multiplyScalar(-halfW));
      const right = new THREE.Vector3().addVectors(p, normal.clone().multiplyScalar(halfW));

      vertices.push(left.x, left.y, left.z);
      vertices.push(right.x, right.y, right.z);

      uvs.push(0, i / (points.length - 1));
      uvs.push(1, i / (points.length - 1));

      if (i < points.length - 1) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }
}
