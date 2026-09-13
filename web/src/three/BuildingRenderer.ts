import * as THREE from 'three';
import type { GeoJsonFeature } from '../geo/geojsonTypes';
import { latLonToWorld } from '../geo/coordinateTransform';
import type { Asset } from '../types/asset';
import {
  generateBuildingMassing,
  type ArchitecturalMassingSpec,
} from './BuildingTypology';

/**
 * Metric-accurate UVGenerator for Three.js ExtrudeGeometry.
 * Eliminates all stretching, warping, and texture shearing across building walls.
 * - Walls (Side faces): u = metric distance along perimeter / 4.0m, v = height / 3.2m
 * - Roof (Cap face): u = worldX / 22.0m, v = worldY / 22.0m
 */
const buildingUVGenerator: THREE.UVGenerator = {
  generateTopUV: (_geometry, vertices, indexA, indexB, indexC) => {
    const ax = vertices[indexA * 3], ay = vertices[indexA * 3 + 1];
    const bx = vertices[indexB * 3], by = vertices[indexB * 3 + 1];
    const cx = vertices[indexC * 3], cy = vertices[indexC * 3 + 1];
    const s = 1.0 / 22.0; // 22m metric repeat on rooftop deck
    return [
      new THREE.Vector2(ax * s, ay * s),
      new THREE.Vector2(bx * s, by * s),
      new THREE.Vector2(cx * s, cy * s),
    ];
  },
  generateSideWallUV: (_geometry, vertices, indexA, indexB, indexC, indexD) => {
    const ax = vertices[indexA * 3], ay = vertices[indexA * 3 + 1], az = vertices[indexA * 3 + 2];
    const bx = vertices[indexB * 3], by = vertices[indexB * 3 + 1], bz = vertices[indexB * 3 + 2];
    const cz = vertices[indexC * 3 + 2];
    const dz = vertices[indexD * 3 + 2];

    const wallLength = Math.hypot(bx - ax, by - ay);
    const uScale = 1.0 / 4.0; // 1 architectural window bay every 4.0 meters
    const vScale = 1.0 / 3.2; // 1 architectural floor level every 3.2 meters

    return [
      new THREE.Vector2(0, Math.max(0, az) * vScale),
      new THREE.Vector2(wallLength * uScale, Math.max(0, bz) * vScale),
      new THREE.Vector2(wallLength * uScale, Math.max(0, cz) * vScale),
      new THREE.Vector2(0, Math.max(0, dz) * vScale),
    ];
  },
};

/**
 * Procedural texture for Neoclassical Travertine limestone facade (512x512 = 1 metric bay)
 * Signature Hiranandani classical towers with stone friezes, pilasters & sky reflection glass
 */
function createNeoclassicalFacadeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // 1. Warm classical travertine limestone base
  ctx.fillStyle = '#f8f5ee';
  ctx.fillRect(0, 0, 512, 512);

  // Micro stone grain stipple
  for (let i = 0; i < 600; i++) {
    const gx = (i * 47) % 512;
    const gy = (i * 89) % 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(215, 204, 190, 0.35)' : 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(gx, gy, 3, 3);
  }

  // 2. Classical horizontal cornice / frieze ledge (Top of floor)
  const friezeH = 65;
  ctx.fillStyle = '#e8dece';
  ctx.fillRect(0, 0, 512, friezeH);

  // Cornice upper drop shadow reveal
  ctx.fillStyle = '#c5b8a5';
  ctx.fillRect(0, friezeH - 8, 512, 5);
  ctx.fillStyle = '#a89a87';
  ctx.fillRect(0, friezeH - 3, 512, 3);

  // 3. Classical stone pilasters / piers (Left and Right columns)
  const colW = 68;
  ctx.fillStyle = '#efe7db';
  ctx.fillRect(0, friezeH, colW, 512 - friezeH);
  ctx.fillRect(512 - colW, friezeH, colW, 512 - friezeH);

  // Column shadow bevels
  ctx.fillStyle = '#dfd3c0';
  ctx.fillRect(colW - 6, friezeH, 6, 512 - friezeH);
  ctx.fillStyle = '#fbf9f4';
  ctx.fillRect(512 - colW, friezeH, 6, 512 - friezeH);

  // 4. Central deep recessed window opening
  const winX = colW + 14;
  const winY = friezeH + 16;
  const winW = 512 - (colW + 14) * 2;
  const winH = 512 - winY - 32;

  // Deep window reveal shadow box
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(winX, winY, winW, winH);

  // 5. Specular daylight sky-reflecting window glass
  const glassPad = 8;
  const gx = winX + glassPad;
  const gy = winY + glassPad;
  const gw = winW - glassPad * 2;
  const gh = winH - glassPad * 2;

  const glassGrad = ctx.createLinearGradient(gx, gy, gx, gy + gh);
  glassGrad.addColorStop(0, '#93c5fd'); // Bright sky reflection at top
  glassGrad.addColorStop(0.4, '#60a5fa');
  glassGrad.addColorStop(0.75, '#38bdf8');
  glassGrad.addColorStop(1, '#1e3a8a'); // Deep interior shadow at bottom
  ctx.fillStyle = glassGrad;
  ctx.fillRect(gx, gy, gw, gh);

  // Crisp angled glass glare sheen
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.beginPath();
  ctx.moveTo(gx + 12, gy);
  ctx.lineTo(gx + gw * 0.45, gy);
  ctx.lineTo(gx + gw * 0.25, gy + gh);
  ctx.lineTo(gx, gy + gh);
  ctx.closePath();
  ctx.fill();

  // 6. Architectural white window muntin cross (Classical mullions)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(gx + gw / 2 - 2, gy, 4, gh);
  ctx.fillRect(gx, gy + gh * 0.38 - 2, gw, 4);

  // 7. Projecting stone window sill
  ctx.fillStyle = '#eae1d2';
  ctx.fillRect(winX - 8, winY + winH - 2, winW + 16, 16);
  ctx.fillStyle = '#c5b8a5';
  ctx.fillRect(winX - 8, winY + winH + 14, winW + 16, 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 16;
  return texture;
}

/**
 * Procedural texture for Modern Reflective Glass Curtain Wall (512x512 = 1 metric bay)
 * Commercial offices, Galleria, IT SEZ parks
 */
function createGlassCurtainFacadeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // 1. Dark structural anodized aluminum framing
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 512);

  // 2. Horizontal spandrel glass band (Floor slab level)
  const spandrelH = 70;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 512, spandrelH);

  ctx.fillStyle = '#334155';
  ctx.fillRect(0, spandrelH - 4, 512, 4);

  // 3. Vertical anodized aluminum mullions (Left, Center, Right)
  const mulW = 16;
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, mulW, 512);
  ctx.fillRect(512 - mulW, 0, mulW, 512);
  ctx.fillRect(256 - mulW / 2, 0, mulW, 512);

  // Brushed aluminum highlights
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillRect(3, 0, 3, 512);
  ctx.fillRect(256 - mulW / 2 + 3, 0, 3, 512);

  // 4. Floor-to-ceiling vision glass panels (Dual panels per 4m bay)
  const p1X = mulW + 4;
  const p1W = 256 - mulW / 2 - mulW - 8;
  const p2X = 256 + mulW / 2 + 4;
  const p2W = p1W;
  const pY = spandrelH + 8;
  const pH = 512 - pY - 8;

  [
    { x: p1X, w: p1W },
    { x: p2X, w: p2W },
  ].forEach((panel) => {
    const grad = ctx.createLinearGradient(panel.x, pY, panel.x + panel.w, pY + pH);
    grad.addColorStop(0, '#7dd3fc');
    grad.addColorStop(0.3, '#38bdf8');
    grad.addColorStop(0.65, '#0284c7');
    grad.addColorStop(1, '#0c4a6e');
    ctx.fillStyle = grad;
    ctx.fillRect(panel.x, pY, panel.w, pH);

    // Diagonal sun glare across glass facade
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.moveTo(panel.x + 8, pY);
    ctx.lineTo(panel.x + panel.w * 0.4, pY);
    ctx.lineTo(panel.x + panel.w * 0.15, pY + pH);
    ctx.lineTo(panel.x, pY + pH);
    ctx.closePath();
    ctx.fill();

    // Internal Venetian blind subtle texture
    ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
    for (let b = pY + 12; b < pY + pH * 0.65; b += 8) {
      ctx.fillRect(panel.x + 2, b, panel.w - 4, 1.5);
    }
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 16;
  return texture;
}

/**
 * Procedural texture for Residential Masonry with Balcony Shadow Lines (512x512)
 */
function createResidentialFacadeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // 1. Warm cream sandstone / stucco base
  ctx.fillStyle = '#f1efe7';
  ctx.fillRect(0, 0, 512, 512);

  // Micro plaster texture
  for (let i = 0; i < 400; i++) {
    const x = (i * 37) % 512;
    const y = (i * 73) % 512;
    ctx.fillStyle = 'rgba(200, 190, 175, 0.3)';
    ctx.fillRect(x, y, 4, 4);
  }

  // 2. Terracotta balcony ledge slab (Lower third of floor)
  const slabY = 350;
  const slabH = 32;
  ctx.fillStyle = '#9a3412';
  ctx.fillRect(20, slabY, 472, slabH);

  // Balcony shadow underneath
  ctx.fillStyle = '#334155';
  ctx.fillRect(20, slabY + slabH, 472, 14);

  // Balcony modern glass/metal railing
  ctx.fillStyle = '#64748b';
  ctx.fillRect(20, slabY - 50, 472, 6);
  for (let rx = 35; rx < 480; rx += 36) {
    ctx.fillRect(rx, slabY - 50, 4, 50);
  }

  // 3. Sliding glass patio door behind balcony
  const doorX = 80;
  const doorW = 352;
  const doorY = 110;
  const doorH = slabY - 110;

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(doorX, doorY, doorW, doorH);

  const doorGrad = ctx.createLinearGradient(doorX, doorY, doorX, doorY + doorH);
  doorGrad.addColorStop(0, '#93c5fd');
  doorGrad.addColorStop(0.5, '#60a5fa');
  doorGrad.addColorStop(1, '#1e3a8a');
  ctx.fillStyle = doorGrad;
  ctx.fillRect(doorX + 6, doorY + 6, doorW - 12, doorH - 6);

  // Glare
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.moveTo(doorX + 20, doorY + 6);
  ctx.lineTo(doorX + 120, doorY + 6);
  ctx.lineTo(doorX + 40, doorY + doorH);
  ctx.lineTo(doorX + 6, doorY + doorH);
  ctx.closePath();
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 16;
  return texture;
}

/**
 * Procedural texture for Clean Academic & Institutional Concrete (512x512)
 */
function createInstitutionalFacadeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Smooth architectural concrete
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, 512, 512);

  // Formwork tie holes & panel lines
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, 504, 504);

  ctx.fillStyle = '#94a3b8';
  [40, 472].forEach((tx) => {
    [40, 472].forEach((ty) => {
      ctx.beginPath();
      ctx.arc(tx, ty, 6, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  // Horizontal ribbon windows (Classic modern architecture)
  const winY = 140;
  const winH = 200;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(20, winY, 472, winH);

  const winGrad = ctx.createLinearGradient(0, winY, 0, winY + winH);
  winGrad.addColorStop(0, '#60a5fa');
  winGrad.addColorStop(1, '#1e293b');
  ctx.fillStyle = winGrad;
  ctx.fillRect(26, winY + 6, 460, winH - 12);

  // Architectural mullions
  ctx.fillStyle = '#e2e8f0';
  for (let m = 135; m < 460; m += 110) {
    ctx.fillRect(m, winY, 12, winH);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 16;
  return texture;
}

/**
 * Procedural texture for Rooftop gravel/slate deck
 */
function createRooftopTexture(baseHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  // Gravel flecks
  for (let i = 0; i < 400; i++) {
    const x = (i * 31) % 256;
    const y = (i * 71) % 256;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(x, y, 3, 3);
  }

  // Roofing membrane seam lines
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 2;
  for (let y = 64; y < 256; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 16;
  return texture;
}

interface BuildingMaterialSet {
  wallMat: THREE.MeshStandardMaterial;
  roofMat: THREE.MeshStandardMaterial;
  edgeMat: THREE.LineBasicMaterial;
}

export class BuildingRenderer {
  public group: THREE.Group = new THREE.Group();
  public selectableObjects: THREE.Mesh[] = [];

  private buildingMeshes: THREE.Mesh[] = [];
  private materialSets: BuildingMaterialSet[] = [];
  private commonEdgeMat: THREE.LineBasicMaterial;

  constructor() {
    this.group.name = 'BuildingsGroup';

    // 1. Procedural Texture Library
    const texNeoclassical = createNeoclassicalFacadeTexture();
    const texGlassCurtain = createGlassCurtainFacadeTexture();
    const texResidential = createResidentialFacadeTexture();
    const texInstitutional = createInstitutionalFacadeTexture();

    const texRoofSlate = createRooftopTexture('#475569');
    const texRoofGravel = createRooftopTexture('#334155');
    const texRoofTerracotta = createRooftopTexture('#573318');

    // CAD edge outline for razor-sharp building silhouettes
    this.commonEdgeMat = new THREE.LineBasicMaterial({
      color: 0x334155,
      transparent: true,
      opacity: 0.45,
    });

    const villaRoofMat = new THREE.MeshStandardMaterial({
      color: 0x9a3412, // Warm terracotta tile
      roughness: 0.75,
      metalness: 0.05,
    });

    // Set 0: Neoclassical Travertine Ivory (Hiranandani Signature)
    this.materialSets.push({
      roofMat: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: texRoofSlate,
        roughness: 0.85,
        metalness: 0.1,
      }),
      wallMat: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: texNeoclassical,
        roughness: 0.4,
        metalness: 0.15,
      }),
      edgeMat: this.commonEdgeMat,
    });

    // Set 1: Modern Reflective Glass Commercial Tower
    this.materialSets.push({
      roofMat: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: texRoofGravel,
        roughness: 0.8,
        metalness: 0.2,
      }),
      wallMat: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: texGlassCurtain,
        roughness: 0.22,
        metalness: 0.45,
      }),
      edgeMat: new THREE.LineBasicMaterial({
        color: 0x1e3a8a,
        transparent: true,
        opacity: 0.5,
      }),
    });

    // Set 2: Warm Sandstone Residential Block
    this.materialSets.push({
      roofMat: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: texRoofTerracotta,
        roughness: 0.85,
        metalness: 0.05,
      }),
      wallMat: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: texResidential,
        roughness: 0.5,
        metalness: 0.1,
      }),
      edgeMat: this.commonEdgeMat,
    });

    // Set 3: Clean Institutional / Research Concrete
    this.materialSets.push({
      roofMat: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: texRoofSlate,
        roughness: 0.85,
        metalness: 0.1,
      }),
      wallMat: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: texInstitutional,
        roughness: 0.55,
        metalness: 0.1,
      }),
      edgeMat: this.commonEdgeMat,
    });

    // Set 4: Warm Terracotta Villa & Low-Rise
    this.materialSets.push({
      roofMat: villaRoofMat,
      wallMat: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: texResidential,
        roughness: 0.6,
        metalness: 0.05,
      }),
      edgeMat: this.commonEdgeMat,
    });
  }

  public renderBuildings(features: GeoJsonFeature[]): void {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    }
    this.buildingMeshes = [];
    this.selectableObjects = [];

    const buildingFeatures = features.filter((f) => f.properties.feature_type === 'building');

    buildingFeatures.forEach((feat) => {
      if (feat.geometry.type !== 'Polygon') return;
      const ring = feat.geometry.coordinates[0] as [number, number][];
      if (ring.length < 3) return;

      const worldPoints = ring.map(([lon, lat]) => latLonToWorld(lat, lon, 0));

      // Calculate 2D polygon footprint area for typology classification
      let area = 0;
      for (let i = 0; i < worldPoints.length - 1; i++) {
        area += worldPoints[i].x * worldPoints[i + 1].z - worldPoints[i + 1].x * worldPoints[i].z;
      }
      const footprintArea = Math.abs(area) * 0.5;

      // Classify building into typology with deterministic height/style parameters
      const spec: ArchitecturalMassingSpec = generateBuildingMassing(feat, footprintArea);

      // Centroid
      const center = new THREE.Vector3();
      worldPoints.forEach((p) => center.add(p));
      center.divideScalar(worldPoints.length);

      // 2D footprint points
      const points2D = worldPoints.map((p) => new THREE.Vector2(p.x, -p.z));

      // Select material set based on facade style
      let chosenSet = this.materialSets[0];
      if (spec.facadeStyle === 'glass_curtain') {
        chosenSet = this.materialSets[1];
      } else if (spec.facadeStyle === 'sandstone_balcony') {
        chosenSet = this.materialSets[2];
      } else if (spec.facadeStyle === 'institutional_concrete') {
        chosenSet = this.materialSets[3];
      } else if (spec.facadeStyle === 'terracotta_warm') {
        chosenSet = this.materialSets[4];
      }

      try {
        const shape = new THREE.Shape();
        shape.moveTo(points2D[0].x, points2D[0].y);
        for (let i = 1; i < points2D.length; i++) {
          shape.lineTo(points2D[i].x, points2D[i].y);
        }
        shape.closePath();

        const buildingH = Math.max(4, spec.totalHeight);

        // Single extrusion per building — no multi-tier decomposition
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth: buildingH,
          bevelEnabled: false,
          UVGenerator: buildingUVGenerator,
        });
        geo.rotateX(-Math.PI / 2);

        // Multi-material: cap = roof, side = wall
        const mesh = new THREE.Mesh(geo, [chosenSet.roofMat, chosenSet.wallMat]);
        // No castShadow on individual buildings — massive perf win (1200 buildings)
        mesh.castShadow = false;
        mesh.receiveShadow = true;

        // Edge silhouette lines for architectural definition
        const edgeGeo = new THREE.EdgesGeometry(geo, 22);
        const edgeLine = new THREE.LineSegments(edgeGeo, chosenSet.edgeMat);
        mesh.add(edgeLine);

        this.attachMetadata(mesh, feat, spec, center);
        this.group.add(mesh);
        this.buildingMeshes.push(mesh);
      } catch {
        // Skip malformed geometry safely
      }
    });
  }

  private attachMetadata(
    mesh: THREE.Mesh,
    feat: GeoJsonFeature,
    spec: ArchitecturalMassingSpec,
    center: THREE.Vector3
  ): void {
    mesh.userData = {
      osm_id: feat.properties.osm_id,
      name: feat.properties.name || 'Building',
      type: 'building',
      typology: spec.typology,
      levels: spec.totalLevels,
      height: spec.totalHeight,
      center: center,
    };
  }
  public get allBuildingMeshes(): THREE.Mesh[] {
    return this.buildingMeshes;
  }

  /**
   * Links real-world OSM building meshes to breakable infrastructure assets.
   * Only links exact OSM ID matches or exact name matches.
   * Never uses proximity heuristics which hijack non-clickable buildings.
   */
  public linkAssets(assets: Asset[]): void {
    if (!assets || assets.length === 0 || this.buildingMeshes.length === 0) return;

    this.selectableObjects = [];

    this.buildingMeshes.forEach((mesh) => {
      // Reset any previous link
      delete mesh.userData.assetId;
      mesh.userData.isSelectable = false;

      const featName = (mesh.userData.name || '').trim().toLowerCase();
      const featOsmId = mesh.userData.osm_id || '';

      let matchedAsset: Asset | undefined = undefined;

      // 1. Direct explicit OSM ID match (highest priority, 100% exact)
      if (featOsmId) {
        matchedAsset = assets.find((a) => a.osm_id && a.osm_id === featOsmId);
      }

      // 2. Exact full name matching for known infrastructure buildings
      if (!matchedAsset && featName && featName !== 'building') {
        matchedAsset = assets.find((a) => {
          const aName = a.name.trim().toLowerCase();
          return aName === featName;
        });
      }

      if (matchedAsset) {
        mesh.userData.assetId = matchedAsset.id;
        mesh.userData.isSelectable = true;
        mesh.userData.name = matchedAsset.name;
        this.selectableObjects.push(mesh);
      }
    });
  }
}
