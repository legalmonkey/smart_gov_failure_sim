import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Section 5.14: Isometric 3D Camera Manager
 * Uses OrthographicCamera with OrbitControls.
 * Zoom and Pan enabled; tilt fixed in isometric angle.
 */
export class CameraManager {
  public camera: THREE.OrthographicCamera;
  public controls: OrbitControls;
  private aspect: number;
  private frustumSize: number = 620; // Calibrated to frame Hiranandani + Powai corridor
  private targetPosition: THREE.Vector3 = new THREE.Vector3(100, 0, 50);
  private cameraOffset: THREE.Vector3 = new THREE.Vector3(380, 320, 380);

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
    this.controls.dampingFactor = 0.08;
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
  }

  public update(): void {
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
    this.targetPosition.copy(target);
    this.controls.target.lerp(target, 0.5);
    this.camera.position.set(
      target.x + this.cameraOffset.x * 0.7,
      target.y + this.cameraOffset.y * 0.7,
      target.z + this.cameraOffset.z * 0.7
    );
  }

  public resetView(): void {
    this.controls.target.copy(this.targetPosition);
    this.camera.position.set(
      this.targetPosition.x + this.cameraOffset.x,
      this.targetPosition.y + this.cameraOffset.y,
      this.targetPosition.z + this.cameraOffset.z
    );
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();
  }
}
