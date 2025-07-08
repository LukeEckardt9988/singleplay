// js/game.js

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// === GRUNDEINSTELLUNGEN ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 5); 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// === STEUERUNG UND PHYSIK ===
const controls = new PointerLockControls(camera, document.body);
const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');

// NEU: Sperre, die die Steuerung erst nach dem Laden der Welt freigibt.
let isWorldReady = false; 

instructions.addEventListener('click', () => {
    // NEU: Pointer Lock nur erlauben, wenn die Welt bereit ist.
    if (isWorldReady) {
        controls.lock();
    }
});

controls.addEventListener('unlock', () => blocker.style.display = 'block');
controls.addEventListener('lock', () => blocker.style.display = 'none');
scene.add(controls.getObject());

const keys = {};
document.addEventListener('keydown', (e) => (keys[e.code] = true));
document.addEventListener('keyup', (e) => (keys[e.code] = false));

const playerSpeed = 5.0;
const playerHeight = 1.7;
const gravity = 9.81;
const playerVelocity = new THREE.Vector3();

let worldObjects = [];
const groundRaycaster = new THREE.Raycaster();
const wallRaycaster = new THREE.Raycaster();

// === MODELLE LADEN ===
const loader = new GLTFLoader();

// NEU: Wir zeigen eine Lade-Nachricht an.
instructions.querySelector('p').textContent = 'Welt wird geladen...';

loader.load('assets/welt.glb', (gltf) => {
    scene.add(gltf.scene);
    gltf.scene.traverse((child) => {
        if (child.isMesh) {
            worldObjects.push(child);
        }
    });

    // NEU: Welt ist jetzt bereit! Wir geben die Steuerung frei und ändern den Text.
    isWorldReady = true;
    instructions.querySelector('p').textContent = 'Klick zum Spielen';
    
}, undefined, (error) => console.error(error));

loader.load('assets/waffe.glb', (gltf) => {
    const weapon = gltf.scene;
    weapon.position.set(0.25, -0.4, -0.7);
    weapon.scale.set(0.1, 0.1, 0.1);
    camera.add(weapon);
}, undefined, (error) => console.error(error));


// === GAME LOOP ===
const clock = new THREE.Clock();
let onGround = false;

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // NEU: Die gesamte Physik wird nur ausgeführt, wenn die Welt bereit ist.
    if (isWorldReady && controls.isLocked) {
        // --- 1. Schwerkraft und Boden-Check ---
        groundRaycaster.set(controls.getObject().position, new THREE.Vector3(0, -1, 0));
        const groundIntersects = groundRaycaster.intersectObjects(worldObjects);
        onGround = groundIntersects.length > 0 && groundIntersects[0].distance < playerHeight / 2 + 0.1;

        if (!onGround) {
            playerVelocity.y -= gravity * delta;
        } else {
            playerVelocity.y = 0;
            controls.getObject().position.y = groundIntersects[0].point.y + playerHeight / 2;
        }

        // --- 2. Horizontale Bewegung (Laufen) ---
        const playerDirection = new THREE.Vector3();
        playerDirection.z = Number(keys['KeyS']) - Number(keys['KeyW']);
        playerDirection.x = Number(keys['KeyD']) - Number(keys['KeyA']);
        playerDirection.normalize();

        const moveSpeed = playerSpeed * delta;
        const moveVector = new THREE.Vector3(playerDirection.x * moveSpeed, 0, playerDirection.z * moveSpeed);
        moveVector.applyQuaternion(controls.getObject().quaternion);

        // --- 3. Wand-Kollision ---
        if (moveVector.lengthSq() > 0) {
            wallRaycaster.set(controls.getObject().position, moveVector.clone().normalize());
            const wallIntersects = wallRaycaster.intersectObjects(worldObjects);

            if (wallIntersects.length === 0 || wallIntersects[0].distance > 0.5) {
                controls.getObject().position.add(moveVector);
            }
        }
        
        // --- 4. Finale Bewegung anwenden (für Schwerkraft) ---
        controls.getObject().position.y += playerVelocity.y * delta;
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();