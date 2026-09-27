// Telecamere del 3D: isometrica (ortografica, di sbieco come un diorama) e da dietro (prospettica).
import * as THREE from 'three';
import type { CameraMode } from '../../platform/settings';

export interface CameraRig {
  readonly camera: THREE.Camera;
  /** Segue la squadra: posizione nel mondo (metri) della squadra. */
  follow(x: number, z: number, dt: number): void;
  resize(width: number, height: number): void;
}

/** Metà dell'altezza inquadrata dalla vista isometrica, in metri. */
const ISO_VIEW = 8.5;
/** Direzione da cui guarda la telecamera isometrica (di lato, dall'alto, da dietro). */
const ISO_OFFSET = new THREE.Vector3(12, 18, 16);
/** Quanto davanti alla squadra si centra l'inquadratura (metri). */
const LOOK_AHEAD = 9;

export function createCameraRig(mode: CameraMode, width: number, height: number): CameraRig {
  return mode === 'iso' ? isoRig(width, height) : chaseRig(width, height);
}

function isoRig(width: number, height: number): CameraRig {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const target = new THREE.Vector3();
  const rig: CameraRig = {
    camera,
    follow(x, z, dt) {
      // Movimento morbido: la telecamera insegue il punto davanti alla squadra.
      const k = Math.min(1, dt * 6);
      target.x += (x * 0.4 - target.x) * k;
      target.z += (z - LOOK_AHEAD - target.z) * k;
      camera.position.copy(target).add(ISO_OFFSET);
      camera.lookAt(target);
    },
    resize(w, h) {
      const aspect = w / h;
      // Su schermi stretti (telefono in verticale) si allarga la vista per vedere tutta la strada.
      const half = aspect < 1 ? ISO_VIEW / Math.max(0.6, aspect) : ISO_VIEW;
      camera.left = -half * aspect;
      camera.right = half * aspect;
      camera.top = half;
      camera.bottom = -half;
      camera.updateProjectionMatrix();
    },
  };
  rig.resize(width, height);
  return rig;
}

function chaseRig(width: number, height: number): CameraRig {
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 300);
  const pos = new THREE.Vector3(0, 7, 9);
  const look = new THREE.Vector3();
  const rig: CameraRig = {
    camera,
    follow(x, z, dt) {
      const k = Math.min(1, dt * 5);
      // Alle spalle della squadra, un po' in alto; segue solo in parte i movimenti laterali.
      pos.x += (x * 0.5 - pos.x) * k;
      pos.y = 7;
      pos.z = z + 9;
      look.set(x * 0.3, 0, z - 14);
      camera.position.copy(pos);
      camera.lookAt(look);
    },
    resize(w, h) {
      camera.aspect = w / h;
      // In verticale si allarga il campo visivo per non tagliare i lati della strada.
      camera.fov = w < h ? 75 : 60;
      camera.updateProjectionMatrix();
    },
  };
  rig.resize(width, height);
  return rig;
}
