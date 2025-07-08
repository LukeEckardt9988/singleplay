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
camera.layers.enableAll(); // Wichtig für getrennte Mündungsfeuer-Effekte

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

// --- HTML Elemente für das HUD ---
const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');
const crosshair = document.getElementById('crosshair-container'); // Fadenkreuz-Container
const currentAmmoElement = document.getElementById('current-ammo');
const magazineCountElement = document.getElementById('magazine-count');
const timerElement = document.getElementById('timer');

// --- Event Listener für Input ---
// --- Event Listener für Input ---
instructions.addEventListener('click', () => {
    if (isWorldReady) {
        controls.lock();
    }
});

controls.addEventListener('lock', () => {
    // Wenn das Spiel startet (Pointer Lock aktiv), blende den kompletten Blocker aus.
    blocker.style.display = 'none';
});

controls.addEventListener('unlock', () => {
    // Wenn der Spieler das Spiel verlässt (z.B. mit ESC), zeige den Blocker wieder an.
    blocker.style.display = 'flex';
});
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

// --- Physik- und Gameplay-Konstanten ---
const playerSpeed = 5.0;
const playerHeight = 1.5;
const gravity = 9.81;
const jumpStrength = 6.0;
const gameDuration = 5 * 60; // 5 Minuten in Sekunden

// --- Gameplay-Variablen ---
const playerVelocity = new THREE.Vector3();
const groundRaycaster = new THREE.Raycaster();
const wallRaycaster = new THREE.Raycaster();
let worldObjects = [];
let isWorldReady = false;
let weapon, muzzleFlash, muzzleFlashSprite;
let timerStarted = false;

// --- Waffen-Variablen ---
let isAiming = false;
const hipFirePosition = new THREE.Vector3(0.1, -0.1, -0.1);
const adsPosition = new THREE.Vector3(0, -0.04, -0.06); // Deine Position
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
let muzzleFlashEndTime = 0; // Zeitstempel für Mündungsfeuer-Ende
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
            child.layers.set(0); // Welt ist auf Ebene 0
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

loader.load('assets/weisseWaffe.glb', (gltf) => {
    weapon = gltf.scene;
    weapon.traverse((child) => { child.layers.set(1); }); // Waffe ist auf Ebene 1
    weapon.position.copy(hipFirePosition);
    weapon.scale.set(0.4, 0.4, 0.4);
    camera.add(weapon);

    // Mündungsfeuer Licht (leuchtet nur auf die Welt, Ebene 0)
    muzzleFlash = new THREE.PointLight(0xfff5a1, 10, 0.5, 2);
    muzzleFlash.layers.set(0);
    muzzleFlash.position.set(0, 0.1, -0.5);
    muzzleFlash.visible = false;
    weapon.add(muzzleFlash);

    // Mündungsfeuer Sprite (ist nur für die Kamera sichtbar, Ebene 1)
    const muzzleFlashTexture = new THREE.TextureLoader().load('assets/muzzleflash.png');
    const muzzleFlashMaterial = new THREE.MeshBasicMaterial({ map: muzzleFlashTexture, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    const muzzleFlashGeometry = new THREE.PlaneGeometry(0.2, 0.2);
    muzzleFlashSprite = new THREE.Mesh(muzzleFlashGeometry, muzzleFlashMaterial);
    muzzleFlashSprite.position.copy(muzzleFlash.position);
    muzzleFlashSprite.layers.set(1);
    muzzleFlashSprite.visible = false;
    weapon.add(muzzleFlashSprite);

    // Animationen vorbereiten
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
    currentAmmoElement.textContent = String(currentAmmo).padStart(2, '0');
    magazineCountElement.textContent = magazines;
}
updateHud();

function updateTimer(elapsedTime) {
    const remainingTime = gameDuration - elapsedTime;
    if (remainingTime <= 0) {
        timerElement.textContent = "00:00";
        return;
    }
    const minutes = String(Math.floor(remainingTime / 60)).padStart(2, '0');
    const seconds = String(Math.floor(remainingTime % 60)).padStart(2, '0');
    timerElement.textContent = `${minutes}:${seconds}`;
}

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

    // Steuerung für zeitgesteuerte Effekte
    if (time > muzzleFlashEndTime) {
        muzzleFlash.visible = false;
        if (muzzleFlashSprite) muzzleFlashSprite.visible = false;
        if (crosshair) crosshair.classList.remove('recoiling');
    }

    if (isWorldReady && weapon && controls.isLocked) {
        if (!timerStarted) {
            clock.start();
            timerStarted = true;
        }
        updateTimer(time);

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
            muzzleFlash.visible = true;
            if (muzzleFlashSprite) muzzleFlashSprite.visible = true;
            if (crosshair) crosshair.classList.add('recoiling');
            muzzleFlashEndTime = time + 0.05; // Endzeitpunkt in 50ms
            if (shootAction) shootAction.reset().play();
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
            } else { isReloading = false; }
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

        // Fadenkreuz ausblenden beim Zielen
        if(crosshair) {
            crosshair.style.display = isAiming ? 'none' : 'block';
        }
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