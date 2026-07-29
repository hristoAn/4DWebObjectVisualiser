import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { FourDFigure } from "./iFourDFigure";
// import { Tesseract } from "./tesseract";
// import { HyperPyramid } from "./HyperPyramid";
import { HyperSphere } from "./HyperSphere";


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

// const figure: FourDFigure = new Tesseract();
const figure: FourDFigure = new HyperSphere();
// const figure: FourDFigure = new HyperPyramid();
scene.add(figure.group);


// Animation loop
function animate() {
  requestAnimationFrame(animate);

  figure.rotateOnPlane(0.003, "yw");
  figure.rotateOnPlane(0.003, "xw");
  figure.rotateOnPlane(0.003, "zw");

  controls.update();
  renderer.render(scene, camera);
}

animate();
