import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { FourDFigure } from "./iFourDFigure";
import { InputManager } from "./inputManeger";
import { ShapePicker } from "./shapePicker";
import { SHAPES, type ShapeId } from "./shapes";

/** Must match the button marked `is-active` in `index.html`. */
const INITIAL_SHAPE: ShapeId = "tesseract";

// Standard Three.js setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
camera.position.z = 5;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

let figure: FourDFigure = SHAPES[INITIAL_SHAPE].create();
scene.add(figure.group);

const inputs = new InputManager(figure, SHAPES[INITIAL_SHAPE]);

/** Replace the figure on screen with a different one. The old figure is
 *  disposed of - each one holds GPU buffers that won't be freed for us. */
function showShape(id: ShapeId): void {
  const shape = SHAPES[id];

  scene.remove(figure.group);
  figure.dispose();

  figure = shape.create();
  scene.add(figure.group);
  inputs.setFigure(figure, shape);
}

new ShapePicker({ initial: INITIAL_SHAPE, onSelect: showShape });

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  inputs.update();

  controls.update();
  renderer.render(scene, camera);
}

animate();
