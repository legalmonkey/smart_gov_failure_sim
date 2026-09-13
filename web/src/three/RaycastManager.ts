import * as THREE from 'three';
import { CameraManager } from './CameraManager';
import { appState } from '../state/applicationState';

/**
 * High-Performance RAF-Throttled Raycast & Interaction Manager.
 * Features:
 * 1. Two-phase fast-path raycasting (tests ~30 selectable nodes first, skips 3,000+ buildings when not over a node).
 * 2. requestAnimationFrame throttling (guarantees max 1 raycast per screen refresh).
 * 3. Drag suppression (completely disables raycasts while panning/orbiting the map).
 */
export class RaycastManager {
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private mouse: THREE.Vector2 = new THREE.Vector2();
  private domElement: HTMLElement;
  private cameraManager: CameraManager;
  private selectableMeshesProvider: () => THREE.Object3D[];
  private occludingMeshesProvider?: () => THREE.Object3D[];

  private isDragging: boolean = false;
  private downCoords: { x: number; y: number } = { x: 0, y: 0 };
  private clearHoverTimeout: any = null;

  // RAF Throttling
  private pendingRaf: number | null = null;
  private latestEvent: { clientX: number; clientY: number } | null = null;

  constructor(
    domElement: HTMLElement,
    cameraManager: CameraManager,
    selectableMeshesProvider: () => THREE.Object3D[],
    occludingMeshesProvider?: () => THREE.Object3D[]
  ) {
    this.domElement = domElement;
    this.cameraManager = cameraManager;
    this.selectableMeshesProvider = selectableMeshesProvider;
    this.occludingMeshesProvider = occludingMeshesProvider;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.domElement.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    this.domElement.addEventListener('pointermove', this.onPointerMove, { passive: true });
    this.domElement.addEventListener('pointerup', this.onPointerUp, { passive: true });
  }

  public dispose(): void {
    if (this.clearHoverTimeout) clearTimeout(this.clearHoverTimeout);
    if (this.pendingRaf !== null) {
      cancelAnimationFrame(this.pendingRaf);
      this.pendingRaf = null;
    }
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.domElement.removeEventListener('pointerup', this.onPointerUp);
  }

  private onPointerDown = (event: PointerEvent) => {
    this.downCoords = { x: event.clientX, y: event.clientY };
    this.isDragging = false;
  };

  private onPointerMove = (event: PointerEvent) => {
    // Check if dragging (OrbitControls pan/orbit)
    const dx = Math.abs(event.clientX - this.downCoords.x);
    const dy = Math.abs(event.clientY - this.downCoords.y);
    if (dx > 5 || dy > 5 || event.buttons !== 0) {
      this.isDragging = true;
      // Skip raycasting during active camera manipulation to preserve max 60+ FPS
      return;
    }

    this.latestEvent = { clientX: event.clientX, clientY: event.clientY };

    if (this.pendingRaf === null) {
      this.pendingRaf = requestAnimationFrame(this.processHoverRaycast);
    }
  };

  private processHoverRaycast = () => {
    this.pendingRaf = null;
    if (!this.latestEvent || this.isDragging) return;

    const { clientX, clientY } = this.latestEvent;
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.cameraManager.camera);
    const selectables = this.selectableMeshesProvider();

    // Fast-path: Intersect only the small set of selectable infrastructure nodes first
    const selectableHits = this.raycaster.intersectObjects(selectables, true);

    if (selectableHits.length > 0) {
      const closestHit = selectableHits[0];
      let isOccluded = false;

      // Only check occlusion against buildings if a selectable candidate was actually struck
      if (this.occludingMeshesProvider) {
        const occluders = this.occludingMeshesProvider();
        if (occluders.length > 0) {
          const occluderHits = this.raycaster.intersectObjects(occluders, true);
          if (occluderHits.length > 0 && occluderHits[0].distance < closestHit.distance) {
            isOccluded = true;
          }
        }
      }

      if (!isOccluded) {
        const assetId = closestHit.object.userData.assetId;
        if (assetId) {
          if (this.clearHoverTimeout) {
            clearTimeout(this.clearHoverTimeout);
            this.clearHoverTimeout = null;
          }
          this.domElement.style.cursor = 'pointer';
          appState.setHoveredAsset(assetId, { x: clientX, y: clientY });
          return;
        }
      }
    }

    // Schedule gentle, debounce-buffered clear of hover
    if (!this.clearHoverTimeout) {
      this.clearHoverTimeout = setTimeout(() => {
        this.domElement.style.cursor = 'default';
        appState.setHoveredAsset(null, null);
        this.clearHoverTimeout = null;
      }, 120);
    }
  };

  private onPointerUp = (event: PointerEvent) => {
    if (this.isDragging) {
      this.isDragging = false;
      return;
    }

    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.cameraManager.camera);
    const selectables = this.selectableMeshesProvider();
    const selectableHits = this.raycaster.intersectObjects(selectables, true);

    if (selectableHits.length > 0) {
      const closestHit = selectableHits[0];
      let isOccluded = false;

      if (this.occludingMeshesProvider) {
        const occluders = this.occludingMeshesProvider();
        if (occluders.length > 0) {
          const occluderHits = this.raycaster.intersectObjects(occluders, true);
          if (occluderHits.length > 0 && occluderHits[0].distance < closestHit.distance) {
            isOccluded = true;
          }
        }
      }

      if (!isOccluded) {
        const assetId = closestHit.object.userData.assetId;
        if (assetId) {
          appState.setSelectedAssetId(assetId);
          return;
        }
      }
    }

    // Clicked open ground: clear selection
    appState.setSelectedAssetId(null);
  };
}
