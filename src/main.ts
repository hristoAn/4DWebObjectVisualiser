import * as THREE from "three";
import { Tesseract } from "./tesseract";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import './style.css';

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

const tesseract = new Tesseract();
scene.add(tesseract.group);


// Animation loop
function animate() {
  requestAnimationFrame(animate);

  tesseract.rotateOnPlane(0.003, "yw");
  tesseract.rotateOnPlane(0.003, "xw");
  tesseract.rotateOnPlane(0.003, "zw");

  controls.update();
  renderer.render(scene, camera);
}

animate();
