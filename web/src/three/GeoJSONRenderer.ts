import * as THREE from 'three';
import type { GeoJsonFeatureCollection, GeoJsonFeature } from '../geo/geojsonTypes';
import { RoadRenderer } from './RoadRenderer';
import { BuildingRenderer } from './BuildingRenderer';
import { VegetationRenderer } from './VegetationRenderer';
import { UrbanTerrainRenderer } from './UrbanTerrainRenderer';
import { latLonToWorld } from '../geo/coordinateTransform';

export class GeoJSONRenderer {
  public group: THREE.Group = new THREE.Group();
  public terrainRenderer: UrbanTerrainRenderer;
  public roadRenderer: RoadRenderer;
  public buildingRenderer: BuildingRenderer;
  public vegetationRenderer: VegetationRenderer;
  private facilitySelectableObjects: THREE.Object3D[] = [];

  public get selectableObjects(): THREE.Object3D[] {
    return [
      ...this.facilitySelectableObjects,
      ...this.buildingRenderer.selectableObjects,
    ];
  }
  private waterGroup: THREE.Group = new THREE.Group();
  private facilityGroup: THREE.Group = new THREE.Group();

  constructor() {
    this.group.name = 'GeoJSONMasterGroup';
    this.terrainRenderer = new UrbanTerrainRenderer();
    this.roadRenderer = new RoadRenderer();
    this.buildingRenderer = new BuildingRenderer();
    this.vegetationRenderer = new VegetationRenderer();

    this.group.add(this.terrainRenderer.group);
    this.group.add(this.waterGroup);
    this.group.add(this.roadRenderer.group);
    this.group.add(this.buildingRenderer.group);
    this.group.add(this.vegetationRenderer.group);
    this.group.add(this.facilityGroup);
  }

  public render(geoJson: GeoJsonFeatureCollection): void {
    // 1. Architectural Urban Terrain Plinth & Landscape Ground (underneath buildings)
    this.terrainRenderer.render(geoJson.features);

    // 2. Roads & Sidewalks
    this.roadRenderer.renderRoads(geoJson.features);

    // 3. Normal Buildings with 6 Typologies & Multi-Tier Massing
    this.buildingRenderer.renderBuildings(geoJson.features);

    // 4. Water / Powai Lake
    this.renderWater(geoJson);

    // 4. Urban Vegetation & Greenery
    this.vegetationRenderer.renderVegetation(geoJson.features);

    // 5. Distinct Hospitals & Schools from GeoJSON
    this.renderFacilities(geoJson.features);
  }

  private renderWater(geoJson: GeoJsonFeatureCollection): void {
    while (this.waterGroup.children.length > 0) {
      const child = this.waterGroup.children[0];
      this.waterGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    }

    const waterFeatures = geoJson.features.filter(
      (f) => f.properties.feature_type === 'water'
    );

    // Rich Vibrant Freshwater Lake Material (Deep, saturated crystal blue)
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0077b6, // Vibrant saturated lake blue
      emissive: new THREE.Color(0x002244), // Aquatic depth luminescence
      roughness: 0.08, // Crisp specular reflection
      metalness: 0.28,
      side: THREE.FrontSide,
    });

    // Natural stone embankment / shoreline curb
    const shoreLineMat = new THREE.LineBasicMaterial({
      color: 0x475569, // Natural stone curb
      linewidth: 2,
    });

    waterFeatures.forEach((feat) => {
      if (feat.geometry.type !== 'Polygon') return;
      const ring = feat.geometry.coordinates[0] as [number, number][];
      if (ring.length < 3) return;

      const worldPoints = ring.map(([lon, lat]) => latLonToWorld(lat, lon, 0));

      const shape = new THREE.Shape();
      shape.moveTo(worldPoints[0].x, -worldPoints[0].z);
      for (let i = 1; i < worldPoints.length; i++) {
        shape.lineTo(worldPoints[i].x, -worldPoints[i].z);
      }
      shape.closePath();

      try {
        const geo = new THREE.ShapeGeometry(shape);
        geo.rotateX(-Math.PI / 2);

        // Water surface mesh placed at stable elevation (y = 0.28)
        const waterMesh = new THREE.Mesh(geo, waterMat);
        waterMesh.position.y = 0.28;
        waterMesh.receiveShadow = true;
        waterMesh.userData = {
          name: feat.properties.name || 'Powai Lake',
          type: 'water',
        };

        // Natural stone perimeter edge
        const edgeGeo = new THREE.EdgesGeometry(geo, 1);
        const shoreLine = new THREE.LineSegments(edgeGeo, shoreLineMat);
        shoreLine.position.y = 0.32;

        this.waterGroup.add(waterMesh, shoreLine);
      } catch (err) {
        console.warn('Could not triangulate water polygon:', err);
      }
    });
  }

  private renderFacilities(features: GeoJsonFeature[]): void {
    while (this.facilityGroup.children.length > 0) {
      const child = this.facilityGroup.children[0];
      this.facilityGroup.remove(child);
    }
    this.facilitySelectableObjects = [];

    const facilityFeatures = features.filter((f) =>
      ['hospital', 'school'].includes(f.properties.feature_type)
    );

    facilityFeatures.forEach((feat) => {
      if (feat.geometry.type !== 'Polygon') return;
      const ring = feat.geometry.coordinates[0] as [number, number][];
      if (ring.length < 3) return;

      const center = new THREE.Vector3();
      const worldPoints = ring.map(([lon, lat]) => latLonToWorld(lat, lon, 0));
      worldPoints.forEach((p) => center.add(p));
      center.divideScalar(worldPoints.length);

      const isHospital = feat.properties.feature_type === 'hospital';
      const group = new THREE.Group();
      group.position.set(center.x, 0, center.z);

      if (isHospital) {
        // Distinct Hospital Pavilion
        const mainMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.25,
          metalness: 0.1,
        });
        const pavilion = new THREE.Mesh(new THREE.BoxGeometry(22, 14, 22), mainMat);
        pavilion.position.y = 7;
        pavilion.castShadow = true;
        group.add(pavilion);

        // Bold Red Cross Emblem
        const crossMat = new THREE.MeshStandardMaterial({
          color: 0xef4444,
          emissive: 0xef4444,
          emissiveIntensity: 0.35,
        });
        const crossH = new THREE.Mesh(new THREE.BoxGeometry(11, 1.5, 3.2), crossMat);
        crossH.position.y = 14.8;
        const crossV = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.5, 11), crossMat);
        crossV.position.y = 14.8;
        group.add(crossH, crossV);

        // Emergency Helipad
        const padMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 0.4, 16), padMat);
        pad.position.y = 14.3;
        group.add(pad);
      } else {
        // Distinct School / University Campus Quad
        const wallMat = new THREE.MeshStandardMaterial({
          color: 0xfef08a, // Warm Academic Sandstone
          roughness: 0.6,
        });
        const centerWing = new THREE.Mesh(new THREE.BoxGeometry(22, 10, 8), wallMat);
        centerWing.position.set(0, 5, -5);
        const leftWing = new THREE.Mesh(new THREE.BoxGeometry(8, 10, 16), wallMat);
        leftWing.position.set(-7, 5, 2);
        const rightWing = new THREE.Mesh(new THREE.BoxGeometry(8, 10, 16), wallMat);
        rightWing.position.set(7, 5, 2);
        group.add(centerWing, leftWing, rightWing);

        // Collegiate Central Tower / Cupola (NO CONES!)
        const cupolaMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.5 });
        const cupola = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 6), cupolaMat);
        cupola.position.set(0, 12, -5);
        cupola.castShadow = true;
        group.add(cupola);

        // Green Sports Quad Lawn
        const lawnMat = new THREE.MeshStandardMaterial({ color: 0x2e5c33, roughness: 0.9 });
        const lawn = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 12), lawnMat);
        lawn.position.set(0, 0.2, 2);
        group.add(lawn);
      }

      const assetId = isHospital ? 'hospital_01' : 'school_01';
      group.userData = {
        osm_id: feat.properties.osm_id,
        name: feat.properties.name,
        type: feat.properties.feature_type,
        assetId: assetId,
      };

      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.userData = {
            osm_id: feat.properties.osm_id,
            name: feat.properties.name,
            type: feat.properties.feature_type,
            assetId: assetId,
            isSelectable: true,
          };
          this.facilitySelectableObjects.push(child);
        }
      });

      this.facilityGroup.add(group);
    });
  }
}
