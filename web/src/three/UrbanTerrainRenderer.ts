import * as THREE from 'three';
import type { GeoJsonFeature } from '../geo/geojsonTypes';
import { latLonToWorld } from '../geo/coordinateTransform';

/**
 * UrbanTerrainRenderer
 * Creates an architectural terrain plinth and rich procedural landscape
 * underneath the Powai & Hiranandani urban core, eliminating the plain white void
 * while leaving the surrounding scene as clean gallery white.
 */
export class UrbanTerrainRenderer {
  public group: THREE.Group = new THREE.Group();
  private plinthMesh: THREE.Mesh | null = null;
  private canvasTexture: THREE.CanvasTexture | null = null;

  // Bounding box tightly framing Powai Lake & Hiranandani urban core
  private readonly bounds = {
    minX: -650,
    maxX: 550,
    minZ: -670,
    maxZ: 590,
  };

  constructor() {
    this.group.name = 'UrbanTerrainMasterGroup';
  }

  public render(features: GeoJsonFeature[]): void {
    // 1. Cleanup existing objects
    if (this.plinthMesh) {
      this.group.remove(this.plinthMesh);
      if (this.plinthMesh.geometry) this.plinthMesh.geometry.dispose();
      this.plinthMesh = null;
    }
    if (this.canvasTexture) {
      this.canvasTexture.dispose();
      this.canvasTexture = null;
    }

    // 2. Generate 2048x2048 high-res urban parcel & landscape texture
    const canvas = this.createUrbanCanvas(features);
    this.canvasTexture = new THREE.CanvasTexture(canvas);
    this.canvasTexture.colorSpace = THREE.SRGBColorSpace;
    this.canvasTexture.anisotropy = 8;
    this.canvasTexture.flipY = false;
    this.canvasTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.canvasTexture.wrapT = THREE.ClampToEdgeWrapping;

    // 3. Materials
    // Top surface receives the rich urban texture with subtle specular response
    const matTop = new THREE.MeshStandardMaterial({
      map: this.canvasTexture,
      roughness: 0.9,
      metalness: 0.02,
      side: THREE.FrontSide,
    });

    // Sides of the architectural plinth: subtle chamfered architectural limestone/concrete
    const matSide = new THREE.MeshStandardMaterial({
      color: 0xd8e1ea,
      roughness: 0.8,
      metalness: 0.06,
      side: THREE.FrontSide,
    });

    // 4. Extrude 3D Architectural Plinth Geometry
    const w = this.bounds.maxX - this.bounds.minX;
    const h = this.bounds.maxZ - this.bounds.minZ;
    const minX = this.bounds.minX;
    const minZ = this.bounds.minZ;

    const shape = new THREE.Shape();
    const x0 = this.bounds.minX;
    const x1 = this.bounds.maxX;
    // In Three.js Shape, Y rotates to -Z via rotateX(-PI/2), so shape Y = -worldZ
    const y0 = -this.bounds.maxZ;
    const y1 = -this.bounds.minZ;
    const r = 50; // Smooth 50m architectural rounded corners

    shape.moveTo(x0 + r, y0);
    shape.lineTo(x1 - r, y0);
    shape.quadraticCurveTo(x1, y0, x1, y0 + r);
    shape.lineTo(x1, y1 - r);
    shape.quadraticCurveTo(x1, y1, x1 - r, y1);
    shape.lineTo(x0 + r, y1);
    shape.quadraticCurveTo(x0, y1, x0, y1 - r);
    shape.lineTo(x0, y0 + r);
    shape.quadraticCurveTo(x0, y0, x0 + r, y0);

    const uvGenerator: THREE.UVGenerator = {
      generateTopUV: (_geo, vertices, a, b, c) => {
        const ax = vertices[a * 3], ay = vertices[a * 3 + 1];
        const bx = vertices[b * 3], by = vertices[b * 3 + 1];
        const cx = vertices[c * 3], cy = vertices[c * 3 + 1];
        return [
          new THREE.Vector2((ax - minX) / w, (-ay - minZ) / h),
          new THREE.Vector2((bx - minX) / w, (-by - minZ) / h),
          new THREE.Vector2((cx - minX) / w, (-cy - minZ) / h),
        ];
      },
      generateSideWallUV: () => [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(1, 0),
        new THREE.Vector2(1, 1),
        new THREE.Vector2(0, 1),
      ],
    };

    const extrudeDepth = 3.6;
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: extrudeDepth,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 1.8,
      bevelThickness: 0.9,
      UVGenerator: uvGenerator,
    };

    const plinthGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    plinthGeo.rotateX(-Math.PI / 2);

    this.plinthMesh = new THREE.Mesh(plinthGeo, [matTop, matSide]);
    // Top surface sits at y = 0.01 (flush under roads at 0.15 and water at 0.28)
    this.plinthMesh.position.set(0, -extrudeDepth, 0);
    this.plinthMesh.receiveShadow = true;
    this.plinthMesh.castShadow = true;

    this.group.add(this.plinthMesh);
  }

  /**
   * Generates a 2048x2048 canvas representing real urban parcels,
   * lush parklands around the lake, street easements, and building plazas.
   */
  private createUrbanCanvas(features: GeoJsonFeature[]): HTMLCanvasElement {
    const size = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const w = this.bounds.maxX - this.bounds.minX;
    const h = this.bounds.maxZ - this.bounds.minZ;

    const toPixel = (wx: number, wz: number): [number, number] => {
      const px = ((wx - this.bounds.minX) / w) * size;
      const py = ((wz - this.bounds.minZ) / h) * size;
      return [px, py];
    };

    // 1. BASE URBAN GROUND (Soft architectural warm light stone)
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, size, size);

    // 2. PROCEDURAL URBAN PARCEL PATTERN (Zoning blocks & property lots)
    const gridSize = 48;
    const blockShades = ['#f8fafc', '#f1f5f9', '#eaeff5', '#e2e8f0', '#f3f6f9'];
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.45)';

    for (let x = 0; x < size; x += gridSize) {
      for (let y = 0; y < size; y += gridSize) {
        const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const shadeIdx = Math.floor(Math.abs(hash) * blockShades.length) % blockShades.length;
        ctx.fillStyle = blockShades[shadeIdx];
        ctx.fillRect(x, y, gridSize, gridSize);
        ctx.strokeRect(x, y, gridSize, gridSize);
      }
    }

    // 3. REGIONAL LANDSCAPE GREEN BELTS
    // A. Powai Hills & Western Greens (IIT Bombay Campus side)
    ctx.fillStyle = '#dcfce7'; // Sage meadow green
    ctx.beginPath();
    const [pA1x, pA1y] = toPixel(-550, -580);
    const [pA2x, pA2y] = toPixel(-120, -620);
    const [pA3x, pA3y] = toPixel(-150, -180);
    const [pA4x, pA4y] = toPixel(-580, -220);
    ctx.moveTo(pA1x, pA1y);
    ctx.lineTo(pA2x, pA2y);
    ctx.lineTo(pA3x, pA3y);
    ctx.lineTo(pA4x, pA4y);
    ctx.closePath();
    ctx.fill();

    // B. Hiranandani Gardens & Heritage Forest Park (South-East of Lake)
    ctx.fillStyle = '#d1fae5'; // Manicured parkland green
    ctx.beginPath();
    const [pB1x, pB1y] = toPixel(20, 80);
    const [pB2x, pB2y] = toPixel(360, 60);
    const [pB3x, pB3y] = toPixel(420, 360);
    const [pB4x, pB4y] = toPixel(50, 380);
    ctx.moveTo(pB1x, pB1y);
    ctx.lineTo(pB2x, pB2y);
    ctx.lineTo(pB3x, pB3y);
    ctx.lineTo(pB4x, pB4y);
    ctx.closePath();
    ctx.fill();

    // 4. LAKE SHORELINE GREEN BUFFER & WETLAND EMBANKMENT
    const waterFeatures = features.filter((f) => f.properties.feature_type === 'water');
    waterFeatures.forEach((feat) => {
      if (feat.geometry.type !== 'Polygon') return;
      const ring = feat.geometry.coordinates[0] as [number, number][];
      if (ring.length < 3) return;

      const pixels = ring.map(([lon, lat]) => {
        const wp = latLonToWorld(lat, lon, 0);
        return toPixel(wp.x, wp.z);
      });

      // A. Lush lakeside green promenade belt (32px wide contour)
      ctx.lineWidth = 32;
      ctx.strokeStyle = '#bbf7d0';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pixels[0][0], pixels[0][1]);
      for (let i = 1; i < pixels.length; i++) {
        ctx.lineTo(pixels[i][0], pixels[i][1]);
      }
      ctx.closePath();
      ctx.stroke();

      // B. Sandy stone embankment rim (12px wide contour)
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#cbd5e1';
      ctx.stroke();

      // C. Rich vibrant lakebed base under water
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.moveTo(pixels[0][0], pixels[0][1]);
      for (let i = 1; i < pixels.length; i++) {
        ctx.lineTo(pixels[i][0], pixels[i][1]);
      }
      ctx.closePath();
      ctx.fill();
    });

    // 5. ROAD EASEMENTS & TRANSIT CORRIDORS
    const roadFeatures = features.filter((f) => f.properties.feature_type === 'road');
    roadFeatures.forEach((feat) => {
      if (feat.geometry.type !== 'LineString') return;
      const coords = feat.geometry.coordinates as [number, number][];
      if (coords.length < 2) return;

      const pixels = coords.map(([lon, lat]) => {
        const wp = latLonToWorld(lat, lon, 0);
        return toPixel(wp.x, wp.z);
      });

      const roadClass = feat.properties.road_class || 'primary';
      const width = roadClass === 'arterial' ? 14 : roadClass === 'primary' ? 10 : 7;

      ctx.lineWidth = width;
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pixels[0][0], pixels[0][1]);
      for (let i = 1; i < pixels.length; i++) {
        ctx.lineTo(pixels[i][0], pixels[i][1]);
      }
      ctx.stroke();
    });

    // 6. BUILDING FOUNDATION PLAZAS & CONTACT PADS
    const buildingFeatures = features.filter((f) => f.properties.feature_type === 'building');
    buildingFeatures.forEach((feat) => {
      if (feat.geometry.type !== 'Polygon') return;
      const ring = feat.geometry.coordinates[0] as [number, number][];
      if (ring.length < 3) return;

      const pixels = ring.map(([lon, lat]) => {
        const wp = latLonToWorld(lat, lon, 0);
        return toPixel(wp.x, wp.z);
      });

      // Subtle soft contact shadow rim
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.7)';
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(pixels[0][0], pixels[0][1]);
      for (let i = 1; i < pixels.length; i++) {
        ctx.lineTo(pixels[i][0], pixels[i][1]);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    });

    // 7. SOFT PLINTH EDGE VIGNETTE FADE
    // Gently softens the extreme perimeter towards the plinth chamfer
    const grad = ctx.createRadialGradient(
      size * 0.5,
      size * 0.5,
      size * 0.38,
      size * 0.5,
      size * 0.5,
      size * 0.49
    );
    grad.addColorStop(0, 'rgba(241, 245, 249, 0)');
    grad.addColorStop(1, 'rgba(226, 232, 240, 0.4)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    return canvas;
  }
}
