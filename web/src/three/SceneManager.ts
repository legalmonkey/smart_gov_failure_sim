import * as THREE from 'three';
import { CameraManager } from './CameraManager';
import { RaycastManager } from './RaycastManager';
import { GeoJSONRenderer } from './GeoJSONRenderer';
import { AssetRenderer } from './AssetRenderer';
import { DependencyRenderer } from './DependencyRenderer';
import { CascadeEffects } from './CascadeEffects';
import { HazardOverlayRenderer } from './HazardOverlayRenderer';
import type { ApplicationState } from '../state/applicationState';
import { appState } from '../state/applicationState';
import { latLonToWorld } from '../geo/coordinateTransform';

export class SceneManager {
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public cameraManager: CameraManager;
  public raycastManager: RaycastManager;

  public geoJsonRenderer: GeoJSONRenderer;
  public assetRenderer: AssetRenderer;
  public dependencyRenderer: DependencyRenderer;
  public cascadeEffects: CascadeEffects;
  public hazardOverlayRenderer: HazardOverlayRenderer;

  private container: HTMLElement;
  private animationFrameId: number | null = null;
  private lastTime: number = performance.now();
  private unsubscribeState: (() => void) | null = null;
  private previousFailedNodes: Set<string> = new Set();
  private renderedHazardId: string | null = null;
  private geoJsonRendered: boolean = false;
  private assetsRendered: boolean = false;

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Scene - Crisp Pure White Canvas Horizon
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff); // Pure clean white canvas background
    this.scene.fog = new THREE.Fog(0xffffff, 2500, 6500); // Soft far horizon blending seamlessly into white

    // 2. WebGLRenderer with stable soft shadows
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    // 3. Camera
    this.cameraManager = new CameraManager(container, this.renderer);

    // 4. Stable Daylight Lighting & Ground
    this.setupLighting();
    this.setupGround();

    // 5. Procedural City Renderers
    this.geoJsonRenderer = new GeoJSONRenderer();
    this.assetRenderer = new AssetRenderer();
    this.dependencyRenderer = new DependencyRenderer();
    this.cascadeEffects = new CascadeEffects();
    this.hazardOverlayRenderer = new HazardOverlayRenderer();

    this.scene.add(this.geoJsonRenderer.group);
    this.scene.add(this.assetRenderer.group);
    this.scene.add(this.dependencyRenderer.group);
    this.scene.add(this.cascadeEffects.group);
    this.scene.add(this.hazardOverlayRenderer.group);

    // 6. Raycast Manager
    this.raycastManager = new RaycastManager(
      this.renderer.domElement,
      this.cameraManager,
      () => [
        ...this.assetRenderer.selectableObjects,
        ...this.geoJsonRenderer.selectableObjects,
      ],
      () => this.geoJsonRenderer.buildingRenderer.allBuildingMeshes
    );

    // 7. State subscription
    this.unsubscribeState = appState.subscribe(this.onStateUpdate);

    // 8. Resize
    window.addEventListener('resize', this.onResize);

    // 9. Animation Loop
    this.animate();
  }

  /**
   * Stable Stylized Daylight Lighting Setup.
   * Single primary directional sun + balanced sky hemisphere fill.
   * Guarantees zero flickering, zero shadow acne, and constant visual stability.
   */
  private setupLighting(): void {
    // 1. Sky Hemisphere Light (Natural sky tone above, warm ground bounce below)
    const hemiLight = new THREE.HemisphereLight(0xe0e7ff, 0xd6d3d1, 1.15);
    this.scene.add(hemiLight);

    // 2. Soft Ambient Light for readable geometry from all angles
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(ambientLight);

    // 3. Primary Directional Sun (Fixed target, stable orthographic shadow camera)
    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.6);
    sunLight.position.set(650, 1200, 450);
    sunLight.target.position.set(0, 0, 0);
    this.scene.add(sunLight.target);

    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 100;
    sunLight.shadow.camera.far = 3200;

    const d = 1100;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;

    // Critical shadow bias tuning: normalBias eliminates self-shadow acne & flickering
    sunLight.shadow.bias = -0.0001;
    sunLight.shadow.normalBias = 0.04;

    this.scene.add(sunLight);
  }

  /**
   * Surrounding Infinite Gallery-White Floor.
   * Placed below the architectural terrain plinth (-3.8) to blend seamlessly with the white background.
   */
  private setupGround(): void {
    const groundGeo = new THREE.PlaneGeometry(40000, 40000);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, // Pure gallery white surrounding floor
      roughness: 1.0,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -3.8;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  private onStateUpdate = (state: ApplicationState) => {
    if (state.geoJson && !this.geoJsonRendered) {
      this.geoJsonRenderer.render(state.geoJson);
      this.geoJsonRendered = true;
      if (state.network) {
        this.geoJsonRenderer.buildingRenderer.linkAssets(state.network.nodes);
      }
    }

    if (state.network) {
      if (!this.assetsRendered) {
        this.assetRenderer.renderAssets(state.network.nodes);
        this.dependencyRenderer.renderDependencies(state.network.edges, this.assetRenderer);
        if (this.geoJsonRendered) {
          this.geoJsonRenderer.buildingRenderer.linkAssets(state.network.nodes);
        }
        this.assetsRendered = true;
      }

      this.assetRenderer.updateStates(state.assetStates);
      this.assetRenderer.updateSelection(state.selectedAssetId);
      this.assetRenderer.updateCriticality(state.showCriticality, state.criticality);
      this.assetRenderer.updateInterventions(state.appliedInterventions);

      state.failedNodes.forEach((id) => {
        if (!this.previousFailedNodes.has(id)) {
          this.cascadeEffects.triggerFailurePulse(id, this.assetRenderer, 0xef4444);
        }
      });
      this.previousFailedNodes = new Set(state.failedNodes);
    }

    this.hazardOverlayRenderer.setVisible(state.hazardOverlayVisible !== false);
    const currentHId = state.activeHazard?.hazard_id || null;
    if (currentHId !== this.renderedHazardId) {
      this.hazardOverlayRenderer.setHazard(state.activeHazard);
      this.renderedHazardId = currentHId;
    }
  };

  public focusAsset(assetId: string): void {
    const pos = this.assetRenderer.getAssetWorldPosition(assetId);
    if (pos) {
      this.cameraManager.focusOn(pos);
    }
  }

  public focusCoordinates(lat: number, lon: number): void {
    const pos = latLonToWorld(lat, lon, 0);
    this.cameraManager.focusOn(pos);
  }

  public resetCamera(): void {
    this.cameraManager.resetView();
  }

  public zoomIn(): void {
    this.cameraManager.zoomIn();
  }

  public zoomOut(): void {
    this.cameraManager.zoomOut();
  }

  public rotateLeft(): void {
    this.cameraManager.rotateHorizontally(Math.PI / 8);
  }

  public rotateRight(): void {
    this.cameraManager.rotateHorizontally(-Math.PI / 8);
  }

  public toggle2D3D(): boolean {
    return this.cameraManager.toggleViewMode();
  }

  public getIsTopDown(): boolean {
    return this.cameraManager.getIsTopDown();
  }

  public navigate(dx: number, dz: number): void {
    this.cameraManager.navigate(dx, dz);
  }

  private onResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.cameraManager.resize(w, h);
    this.renderer.setSize(w, h);
  };

  private animate = () => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    const now = performance.now();
    const deltaTime = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;

    this.cameraManager.update();

    const state = appState.getState();
    this.assetRenderer.update(deltaTime, state.hoveredAssetId, state.selectedAssetId);
    this.dependencyRenderer.update(deltaTime, state.affectedEdges);
    this.cascadeEffects.update(deltaTime);
    this.hazardOverlayRenderer.update(deltaTime);

    this.renderer.render(this.scene, this.cameraManager.camera);
  };

  public dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.unsubscribeState) {
      this.unsubscribeState();
    }
    window.removeEventListener('resize', this.onResize);
    this.raycastManager.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
