import * as THREE from 'three';
import { CameraManager } from './CameraManager';
import { appState } from '../state/applicationState';

export class RaycastManager {
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private mouse: THREE.Vector2 = new THREE.Vector2();
  private domElement: HTMLElement;
  private cameraManager: CameraManager;
  private selectableMeshesProvider: () => THREE.Object3D[];

  private isDragging: boolean = false;
  private downCoords: { x: number; y: number } = { x: 0, y: 0 };

  private clearHoverTimeout: any = null;

  constructor(
    domElement: HTMLElement,
    cameraManager: CameraManager,
    selectableMeshesProvider: () => THREE.Object3D[]
  ) {
    this.domElement = domElement;
    this.cameraManager = cameraManager;
    this.selectableMeshesProvider = selectableMeshesProvider;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.domElement.addEventListener('pointermove', this.onPointerMove);
    this.domElement.addEventListener('pointerup', this.onPointerUp);
  }

  public dispose(): void {
    if (this.clearHoverTimeout) clearTimeout(this.clearHoverTimeout);
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.domElement.removeEventListener('pointerup', this.onPointerUp);
  }

  private onPointerDown = (event: PointerEvent) => {
    this.downCoords = { x: event.clientX, y: event.clientY };
    this.isDragging = false;
  };

  private onPointerMove = (event: PointerEvent) => {
    // Check if dragging (OrbitControls pan/zoom)
    const dx = Math.abs(event.clientX - this.downCoords.x);
    const dy = Math.abs(event.clientY - this.downCoords.y);
    if (dx > 4 || dy > 4) {
      this.isDragging = true;
    }

    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Hover detection
    this.raycaster.setFromCamera(this.mouse, this.cameraManager.camera);
    const intersects = this.raycaster.intersectObjects(
      this.selectableMeshesProvider(),
      true
    );

    if (intersects.length > 0) {
      const assetId = intersects[0].object.userData.assetId;
      if (assetId) {
        if (this.clearHoverTimeout) {
          clearTimeout(this.clearHoverTimeout);
          this.clearHoverTimeout = null;
        }
        this.domElement.style.cursor = 'pointer';
        appState.setHoveredAsset(assetId, { x: event.clientX, y: event.clientY });
        return;
      }
    }

    // Check if cursor moved over the floating hover card
    const targetEl = document.elementFromPoint(event.clientX, event.clientY);
    if (targetEl && targetEl.closest('.hover-action-card')) {
      return;
    }

    if (!this.clearHoverTimeout) {
      this.clearHoverTimeout = setTimeout(() => {
        this.domElement.style.cursor = 'default';
        appState.setHoveredAsset(null, null);
        this.clearHoverTimeout = null;
      }, 180);
    }
  };

  private onPointerUp = (event: PointerEvent) => {
    if (this.isDragging) return; // Ignore drag release

    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.cameraManager.camera);
    const intersects = this.raycaster.intersectObjects(
      this.selectableMeshesProvider(),
      true
    );

    if (intersects.length > 0) {
      const hit = intersects[0];
      const assetId = hit.object.userData.assetId;
      if (assetId) {
        appState.setSelectedAssetId(assetId);
        return;
      }
    }

    // Clicked empty ground: clear selection
    appState.setSelectedAssetId(null);
  };
}
