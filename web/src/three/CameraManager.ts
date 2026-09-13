import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Section 5.14: High-Performance Isometric 3D Camera Manager
 * Uses OrthographicCamera with smooth damped OrbitControls.
 * Features fluid gliding lerp interpolation for focus, zoom, and perspective changes.
 */
export class CameraManager {
  public camera: THREE.OrthographicCamera;
  public controls: OrbitControls;
  private aspect: number;
  private frustumSize: number = 620; // Calibrated to frame Hiranandani + Powai corridor
  private targetPosition: THREE.Vector3 = new THREE.Vector3(100, 0, 50);
  private cameraOffset: THREE.Vector3 = new THREE.Vector3(380, 320, 380);

  // Smooth camera animation state
  private isAnimatingCamera: boolean = false;
  private animTargetCenter: THREE.Vector3 = new THREE.Vector3();
  private animTargetCamPos: THREE.Vector3 = new THREE.Vector3();
  private animTargetZoom: number = 1.0;
  private isTopDown: boolean = false;

  constructor(container: HTMLElement, renderer: THREE.WebGLRenderer) {
    this.aspect = container.clientWidth / container.clientHeight;

    const halfW = (this.frustumSize * this.aspect) / 2;
    const halfH = this.frustumSize / 2;

    this.camera = new THREE.OrthographicCamera(
      -halfW,
      halfW,
      halfH,
      -halfH,
      -3000,
      5000
    );

    this.camera.position.set(
      this.targetPosition.x + this.cameraOffset.x,
      this.targetPosition.y + this.cameraOffset.y,
      this.targetPosition.z + this.cameraOffset.z
    );
    this.camera.lookAt(this.targetPosition);
    this.camera.zoom = 1.0;
    this.camera.updateProjectionMatrix();

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12; // Tuned for snappy, fluid, non-laggy response
    this.controls.enableZoom = true;
    this.controls.enablePan = true;
    this.controls.enableRotate = true;

    // Keep isometric elevation angle around 30-55 degrees
    this.controls.minPolarAngle = Math.PI / 6;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.target.copy(this.targetPosition);

    // Zoom limits: minZoom 0.15 allows zooming far out to see the full city
    this.controls.minZoom = 0.15;
    this.controls.maxZoom = 5.0;

    this.animTargetCenter.copy(this.targetPosition);
    this.animTargetCamPos.copy(this.camera.position);
    this.animTargetZoom = 1.0;

    // Interrupt procedural flight if user begins manual orbit/pan
    renderer.domElement.addEventListener('pointerdown', () => {
      this.isAnimatingCamera = false;
    });
  }

  public update(): void {
    if (this.isAnimatingCamera) {
      const lerpFactor = 0.14; // Buttery smooth spring deceleration
      this.controls.target.lerp(this.animTargetCenter, lerpFactor);
      this.camera.position.lerp(this.animTargetCamPos, lerpFactor);
      this.camera.zoom = THREE.MathUtils.lerp(this.camera.zoom, this.animTargetZoom, lerpFactor);
      this.camera.updateProjectionMatrix();

      const distTarget = this.controls.target.distanceTo(this.animTargetCenter);
      const distCam = this.camera.position.distanceTo(this.animTargetCamPos);
      const distZoom = Math.abs(this.camera.zoom - this.animTargetZoom);

      if (distTarget < 0.2 && distCam < 0.5 && distZoom < 0.005) {
        this.controls.target.copy(this.animTargetCenter);
        this.camera.position.copy(this.animTargetCamPos);
        this.camera.zoom = this.animTargetZoom;
        this.camera.updateProjectionMatrix();
        this.isAnimatingCamera = false;
      }
    }

    this.controls.update();
  }

  public resize(width: number, height: number): void {
    if (height === 0) return;
    this.aspect = width / height;
    const halfW = (this.frustumSize * this.aspect) / 2;
    const halfH = this.frustumSize / 2;

    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  public focusOn(target: THREE.Vector3): void {
    this.animTargetCenter.copy(target);
    this.animTargetCamPos.set(
      target.x + this.cameraOffset.x * 0.7,
      target.y + this.cameraOffset.y * 0.7,
      target.z + this.cameraOffset.z * 0.7
    );
    this.animTargetZoom = Math.max(1.2, this.camera.zoom);
    this.isAnimatingCamera = true;
  }

  public zoomIn(factor = 1.3): void {
    this.animTargetZoom = Math.min(5.0, this.camera.zoom * factor);
    this.animTargetCenter.copy(this.controls.target);
    this.animTargetCamPos.copy(this.camera.position);
    this.isAnimatingCamera = true;
  }

  public zoomOut(factor = 0.77): void {
    this.animTargetZoom = Math.max(0.15, this.camera.zoom * factor);
    this.animTargetCenter.copy(this.controls.target);
    this.animTargetCamPos.copy(this.camera.position);
    this.isAnimatingCamera = true;
  }

  public rotateHorizontally(angle: number): void {
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    this.animTargetCenter.copy(this.controls.target);
    this.animTargetCamPos.copy(this.controls.target).add(offset);
    this.animTargetZoom = this.camera.zoom;
    this.isAnimatingCamera = true;
  }

  public navigate(dx: number, dz: number): void {
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const zoomScale = 1.0 / Math.max(0.2, this.camera.zoom);
    const stepSize = 105 * zoomScale;

    const delta = new THREE.Vector3()
      .addScaledVector(right, dx * stepSize)
      .addScaledVector(forward, dz * stepSize);

    const currentCenter = this.isAnimatingCamera ? this.animTargetCenter : this.controls.target;
    const currentCamPos = this.isAnimatingCamera ? this.animTargetCamPos : this.camera.position;

    this.animTargetCenter.copy(currentCenter).add(delta);
    this.animTargetCamPos.copy(currentCamPos).add(delta);
    this.animTargetZoom = this.camera.zoom;
    this.isAnimatingCamera = true;
  }

  public toggleViewMode(): boolean {
    this.isTopDown = !this.isTopDown;
    this.animTargetCenter.copy(this.controls.target);
    if (this.isTopDown) {
      this.controls.minPolarAngle = 0;
      this.controls.maxPolarAngle = Math.PI / 2.1;
      this.animTargetCamPos.set(
        this.controls.target.x + 0.001,
        this.controls.target.y + 600,
        this.controls.target.z
      );
    } else {
      this.controls.minPolarAngle = Math.PI / 6;
      this.controls.maxPolarAngle = Math.PI / 2.1;
      this.animTargetCamPos.set(
        this.controls.target.x + this.cameraOffset.x,
        this.controls.target.y + this.cameraOffset.y,
        this.controls.target.z + this.cameraOffset.z
      );
    }
    this.animTargetZoom = this.camera.zoom;
    this.isAnimatingCamera = true;
    return this.isTopDown;
  }

  public getIsTopDown(): boolean {
    return this.isTopDown;
  }

  public resetView(): void {
    this.isTopDown = false;
    this.controls.minPolarAngle = Math.PI / 6;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.animTargetCenter.copy(this.targetPosition);
    this.animTargetCamPos.set(
      this.targetPosition.x + this.cameraOffset.x,
      this.targetPosition.y + this.cameraOffset.y,
      this.targetPosition.z + this.cameraOffset.z
    );
    this.animTargetZoom = 1.0;
    this.isAnimatingCamera = true;
  }
}
