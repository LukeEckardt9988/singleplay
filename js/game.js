// js/game.js

// === Import von notwendigen Three.js Modulen ===
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// =================================================================
// === 1. SZENE, KAMERA UND RENDERER ===
// =================================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);
// WICHTIG: Die Kamera muss alle Ebenen sehen können.
camera.layers.enableAll();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// =================================================================
// === 2. BELEUCHTUNG ===
// =================================================================

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// =================================================================
// === 3. STEUERUNG UND SPIELER-PHYSIK ===
// =================================================================

const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

// --- HTML Elemente ---
const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');
const currentAmmoElement = document.getElementById('current-ammo');
const magazineCountElement = document.getElementById('magazine-count');

// --- Event Listener ---
instructions.addEventListener('click', () => { if (isWorldReady) controls.lock(); });
controls.addEventListener('unlock', () => blocker.style.display = 'block');
controls.addEventListener('lock', () => blocker.style.display = 'none');
const keys = {};
document.addEventListener('keydown', (e) => (keys[e.code] = true));
document.addEventListener('keyup', (e) => (keys[e.code] = false));
window.addEventListener('mousedown', (e) => {
    if (e.button === 0) isShooting = true;
    if (e.button === 2) isAiming = true;
});
window.addEventListener('mouseup', (e) => {
    if (e.button === 0) isShooting = false;
    if (e.button === 2) isAiming = false;
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

// --- Gameplay-Konstanten & Variablen ---
const playerSpeed = 5.0;
const playerHeight = 1.5;
const gravity = 9.81;
const jumpStrength = 6.0;
const playerVelocity = new THREE.Vector3();
const groundRaycaster = new THREE.Raycaster();
const wallRaycaster = new THREE.Raycaster();
let worldObjects = [];
let isWorldReady = false;
let weapon, muzzleFlash, muzzleFlashSprite;

// --- Waffen-Variablen ---
let isAiming = false;
const hipFirePosition = new THREE.Vector3(0.1, -0.1, -0.1);
const adsPosition = new THREE.Vector3(0, -0.04, -0.06);
const normalFov = 75;
const adsFov = 60;
const swayAmplitude = new THREE.Vector2(0.005, 0.008);
const swayFrequency = 7.0;

// --- Schuss-Variablen ---
let currentAmmo = 30;
let magazines = 6;
const maxAmmo = 30;
let isShooting = false;
let isReloading = false;
const fireRate = 10;
let lastShotTime = 0;
const recoilAmount = new THREE.Vector3(0, 0.01, 0.03);
let currentRecoilPosition = new THREE.Vector3();
const recoilRotationAmount = new THREE.Euler(0.1, 0, 0);
let currentRecoilRotation = new THREE.Euler();
const recoilRecoverySpeed = 25;

// --- Animations-Variablen ---
let animationMixer;
let reloadAction;
let shootAction;

// =================================================================
// === 4. MODELLE LADEN & SPIEL STARTEN ===
// =================================================================

const loader = new GLTFLoader();
instructions.querySelector('p').textContent = 'Welt wird geladen...';

loader.load('assets/welt1.glb', (gltf) => {
    scene.add(gltf.scene);
    gltf.scene.traverse((child) => {
        if (child.isMesh) {
            worldObjects.push(child);
            // Die Welt ist auf Ebene 0
            child.layers.set(0);
        }
    });
    const spawnRaycaster = new THREE.Raycaster(new THREE.Vector3(0, 100, 0), new THREE.Vector3(0, -1, 0));
    const spawnIntersects = spawnRaycaster.intersectObjects(worldObjects);
    if (spawnIntersects.length > 0) {
        const p = spawnIntersects[0].point;
        controls.getObject().position.set(p.x, p.y + playerHeight, p.z);
    } else {
        controls.getObject().position.set(0, playerHeight, 0);
    }
    isWorldReady = true;
    instructions.querySelector('p').textContent = 'Klick zum Spielen';
}, undefined, (error) => console.error(error));

loader.load('assets/waffe.glb', (gltf) => {
    weapon = gltf.scene;

    // NEU: Setze die Waffe und alle ihre Teile auf Ebene 1
    weapon.traverse((child) => {
        child.layers.set(1);
    });

    weapon.position.copy(hipFirePosition);
    weapon.scale.set(0.4, 0.4, 0.4);
    camera.add(weapon);

    // KORREKTUR: Das Licht leuchtet NUR auf Ebene 0 (die Welt) und ignoriert die Waffe
    muzzleFlash = new THREE.PointLight(0xfff5a1, 5, 2, 2); // Stärkere Intensität für die Welt
    muzzleFlash.layers.set(0); // WICHTIG!
    muzzleFlash.position.set(0, 0.08, -0.55);
    muzzleFlash.visible = false;
    weapon.add(muzzleFlash);

    // Der sichtbare Blitz (Sprite), der nur auf Ebene 1 (der Waffen-Ebene) zu sehen ist
    const muzzleFlashTexture = new THREE.TextureLoader().load('assets/muzzleflash.png');
    const muzzleFlashMaterial = new THREE.MeshBasicMaterial({
        map: muzzleFlashTexture,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false
    });
    const muzzleFlashGeometry = new THREE.PlaneGeometry(0.2, 0.2);
    muzzleFlashSprite = new THREE.Mesh(muzzleFlashGeometry, muzzleFlashMaterial);
    muzzleFlashSprite.position.copy(muzzleFlash.position);
    muzzleFlashSprite.layers.set(1); // WICHTIG!
    muzzleFlashSprite.visible = false;
    weapon.add(muzzleFlashSprite);

    // Animation Mixer vorbereiten
    animationMixer = new THREE.AnimationMixer(weapon);
    const reloadClip = THREE.AnimationClip.findByName(gltf.animations, 'nachladen');
    if (reloadClip) {
        reloadAction = animationMixer.clipAction(reloadClip);
        reloadAction.setLoop(THREE.LoopOnce);
        reloadAction.clampWhenFinished = true;
    }
    const shootClip = THREE.AnimationClip.findByName(gltf.animations, 'schiessen');
    if (shootClip) {
        shootAction = animationMixer.clipAction(shootClip);
        shootAction.setLoop(THREE.LoopOnce);
    }
}, undefined, (error) => console.error(error));

// =================================================================
// === 5. HELFER-FUNKTIONEN ===
// =================================================================

function updateHud() {
    currentAmmoElement.textContent = currentAmmo;
    magazineCountElement.textContent = magazines;
}
updateHud();

// =================================================================
// === 6. DER GAME-LOOP (ANIMATE-FUNKTION) ===
// =================================================================

const clock = new THREE.Clock();
let onGround = false;

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();

    if (animationMixer) {
        animationMixer.update(delta);
    }

    if (isWorldReady && weapon && controls.isLocked) {

        // --- A. BEWEGUNG & PHYSIK ---
        groundRaycaster.set(controls.getObject().position, new THREE.Vector3(0, -1, 0));
        const groundIntersects = groundRaycaster.intersectObjects(worldObjects);
        onGround = groundIntersects.length > 0 && groundIntersects[0].distance < playerHeight / 2 + 0.1;
        if (keys['Space'] && onGround) playerVelocity.y = jumpStrength;
        const playerDirection = new THREE.Vector3(Number(keys['KeyD']) - Number(keys['KeyA']), 0, Number(keys['KeyS']) - Number(keys['KeyW']));
        const isMoving = playerDirection.lengthSq() > 0;
        playerDirection.normalize().applyQuaternion(controls.getObject().quaternion);
        const currentSpeed = isAiming ? playerSpeed / 2 : playerSpeed;
        const moveVector = playerDirection.multiplyScalar(currentSpeed * delta);
        if (isMoving) {
            wallRaycaster.set(controls.getObject().position, moveVector.clone().normalize());
            const wallIntersects = wallRaycaster.intersectObjects(worldObjects);
            if (wallIntersects.length === 0 || wallIntersects[0].distance > 0.8) {
                controls.getObject().position.add(moveVector);
            }
        }
        if (!onGround) playerVelocity.y -= gravity * delta;
        else if (playerVelocity.y < 0) playerVelocity.y = 0;
        controls.getObject().position.y += playerVelocity.y * delta;
        if (onGround && playerVelocity.y <= 0) controls.getObject().position.y = groundIntersects[0].point.y + playerHeight / 2;

        // --- B. SCHIESSEN & NACHLADEN ---
        if (isShooting && !isReloading && currentAmmo > 0 && time > lastShotTime + 1 / fireRate) {
            lastShotTime = time;
            currentAmmo--;
            updateHud();
            currentRecoilPosition.add(recoilAmount);
            currentRecoilRotation.x += recoilRotationAmount.x;
            
            // Mündungsfeuer-Effekte aktivieren
            muzzleFlash.visible = true;
            if (muzzleFlashSprite) muzzleFlashSprite.visible = true;
            
            setTimeout(() => {
                muzzleFlash.visible = false;
                if (muzzleFlashSprite) muzzleFlashSprite.visible = false;
            }, 25);

            if (shootAction) {
                shootAction.reset().play();
            }
        }

        if (keys['KeyR'] && !isReloading && magazines > 0 && currentAmmo < maxAmmo) {
            isReloading = true;
            if (reloadAction) {
                reloadAction.reset().play();
                const animationDuration = reloadAction.getClip().duration * 1000;
                setTimeout(() => {
                    magazines--;
                    currentAmmo = maxAmmo;
                    updateHud();
                    isReloading = false;
                }, animationDuration);
            } else {
                isReloading = false; 
            }
        }

        // --- C. VISUELLE EFFEKTE (WAFFE & KAMERA) ---
        const aimSpeed = delta * 10;
        let targetWeaponPosition = isAiming ? adsPosition.clone() : hipFirePosition.clone();
        const targetFov = isAiming ? adsFov : normalFov;
        currentRecoilPosition.lerp(new THREE.Vector3(), delta * recoilRecoverySpeed);
        currentRecoilRotation.x = THREE.MathUtils.lerp(currentRecoilRotation.x, 0, delta * recoilRecoverySpeed);
        targetWeaponPosition.add(currentRecoilPosition);
        if (isMoving && onGround) {
            const swayMultiplier = isAiming ? 0.3 : 1.0;
            const swayX = Math.sin(time * swayFrequency) * swayAmplitude.x * swayMultiplier;
            const swayY = Math.abs(Math.sin(time * swayFrequency)) * swayAmplitude.y * swayMultiplier;
            targetWeaponPosition.add(new THREE.Vector3(swayX, swayY, 0));
        }
        weapon.position.lerp(targetWeaponPosition, aimSpeed);
        weapon.rotation.set(currentRecoilRotation.x, currentRecoilRotation.y, currentRecoilRotation.z);
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, aimSpeed);
        camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);
}

// =================================================================
// === 7. FENSTERGRÖSSE ANPASSEN & START ===
// =================================================================

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();