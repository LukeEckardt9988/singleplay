// js/game.js

// === Import von notwendigen Three.js Modulen ===
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// =================================================================
// === 1. SZENE, KAMERA UND RENDERER (DAS GRUNDGERÜST) ===
// =================================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

// Die Kamera ist das "Auge" des Spielers.
// PerspectiveCamera(Blickwinkel, Seitenverhältnis, Nahe Ebene, Ferne Ebene)
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);
// HINWEIS: Die alte Startposition hier ist nicht mehr so wichtig, da wir sie später überschreiben.
// camera.position.set(0, 10, 5);

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

const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');

instructions.addEventListener('click', () => {
    if (isWorldReady) {
        controls.lock();
    }
});

controls.addEventListener('unlock', () => blocker.style.display = 'block');
controls.addEventListener('lock', () => blocker.style.display = 'none');

const keys = {};
document.addEventListener('keydown', (e) => (keys[e.code] = true));
document.addEventListener('keyup', (e) => (keys[e.code] = false));

// NEU: Rechtsklick zum Zielen (Aim Down Sights)
// Hier wird die Variable isAiming gesetzt, wenn der Spieler die rechte Maustaste drückt oder loslässt.
// Diese Variable wird später verwendet, um die Waffenposition und das Sichtfeld anzupassen.
window.addEventListener('mousedown', (e) => {
    // Prüft, ob die rechte Maustaste gedrückt wurde (Button-Code 2).
    if (e.button === 2) {
        isAiming = true;
    }
});

window.addEventListener('mouseup', (e) => {
    // Prüft, ob die rechte Maustaste losgelassen wurde.
    if (e.button === 2) {
        isAiming = false;
    }
});

// NEU: Verhindert, dass das Kontextmenü bei Rechtsklick erscheint.
document.addEventListener('contextmenu', (e) => e.preventDefault());



const playerSpeed = 5.0;
const playerHeight = 1.5;
const gravity = 9.81;
const jumpStrength = 6.0;


const playerVelocity = new THREE.Vector3();
const groundRaycaster = new THREE.Raycaster();
const wallRaycaster = new THREE.Raycaster();

let worldObjects = [];
let isWorldReady = false;

// Variablen für das Zielen (Aim Down Sights)
let isAiming = false; // Speichert, ob der Spieler gerade zielt.
/*
====================================================================================
=== WAFFENPOSITIONEN FÜR HÜFTE (HIP-FIRE) UND ZIELEN (ADS) ===
====================================================================================
 
Hier definieren wir die exakte 3D-Position der Waffe relativ zur Kamera.
Wir benutzen dafür einen `THREE.Vector3`, der drei Werte entgegennimmt: (x, y, z).
 
Stell dir das Koordinatensystem aus der Sicht deiner Kamera vor:
 
  +Y (nach oben)
   |
   |
   +-----> +X (nach rechts)
  /
 /
+Z (auf dich zu, aus dem Bildschirm heraus)
 
Das bedeutet:
- X-Achse: Steuert die Links/Rechts-Position.
    -> Ein positiver Wert (z.B. 0.1) schiebt die Waffe nach RECHTS.
    -> Ein negativer Wert (z.B. -0.1) schiebt die Waffe nach LINKS.
    -> 0 bedeutet perfekt in der Mitte.
 
- Y-Achse: Steuert die Hoch/Runter-Position.
    -> Ein positiver Wert (z.B. 0.1) schiebt die Waffe nach OBEN.
    -> Ein negativer Wert (z.B. -0.1) schiebt die Waffe nach UNTEN.
    -> 0 bedeutet auf der exakten vertikalen Höhe der Kamera.
 
- Z-Achse: Steuert die Vor/Zurück-Position (Tiefe).
    -> Ein negativer Wert (z.B. -0.1) schiebt die Waffe von dir WEG (in den Bildschirm hinein).
    -> Ein positiver Wert (z.B. 0.1) schiebt die Waffe auf dich ZU (näher an dein "Gesicht").
*/

// Normale Waffenposition aus der Hüfte.
// x=0.1  -> Leicht nach rechts versetzt.
// y=-0.1 -> Leicht nach unten versetzt.
// z=-0.1 -> Ein kleines Stück vor der Kamera.
const hipFirePosition = new THREE.Vector3(0.1, -0.1, -0.1);

// Waffenposition beim Zielen durch Kimme und Korn.
// x=0    -> Perfekt horizontal zentriert, damit du über die Visiereinrichtung schaust.
// y=0    -> Perfekt vertikal zentriert. (Musst du evtl. leicht anpassen, damit die Visiereinrichtung genau auf Augenhöhe ist).
// z=-0.1 -> Ein kleines Stück vor der Kamera. (Ein kleinerer Wert wie -0.4 würde sie näher heranholen).
const adsPosition = new THREE.Vector3(0, -0.054, -0.06);

const normalFov = 75; // Normales Sichtfeld
const adsFov = 60;    // Sichtfeld beim Zielen (erzeugt den Zoom-Effekt)
// =================================================================
// === 4. MODELLE LADEN ===
// =================================================================

const loader = new GLTFLoader();
instructions.querySelector('p').textContent = 'Welt wird geladen...';

loader.load('assets/welt1.glb', (gltf) => {
    scene.add(gltf.scene);
    gltf.scene.traverse((child) => {
        if (child.isMesh) {
            worldObjects.push(child);
        }
    });

    // =======================================================================
    // === NEU: Sicherer Startpunkt für den Spieler ===
    // =======================================================================
    // Nachdem die Welt geladen ist, suchen wir den Boden und platzieren den Spieler korrekt.
    // So vermeiden wir, dass der Spieler durch die Welt fällt.

    // 1. Wir definieren einen Punkt hoch über dem Zentrum der Welt.
    const spawnCheckPoint = new THREE.Vector3(0, 100, 0); // Start bei x=0, z=0, aber 100m hoch.

    // 2. Wir schießen einen Raycaster von diesem Punkt nach unten.
    const spawnRaycaster = new THREE.Raycaster(spawnCheckPoint, new THREE.Vector3(0, -1, 0));
    const spawnIntersects = spawnRaycaster.intersectObjects(worldObjects);

    // 3. Wenn wir den Boden gefunden haben, setzen wir die Startposition des Spielers.
    if (spawnIntersects.length > 0) {
        const groundPoint = spawnIntersects[0].point;
        // Die Position des Spielers ist die des Bodens + seine Augenhöhe.
        controls.getObject().position.set(groundPoint.x, groundPoint.y + playerHeight, groundPoint.z);
    } else {
        // Fallback, falls absolut kein Boden gefunden wird (z.B. leeres Modell).
        // Setzt den Spieler einfach auf eine Standardhöhe.
        controls.getObject().position.set(0, playerHeight, 0);
        console.warn("Konnte keinen sicheren Startpunkt auf dem Boden finden. Spieler startet bei (0, playerHeight, 0).");
    }

    // Jetzt, wo der Spieler sicher platziert ist, kann das Spiel beginnen.
    isWorldReady = true;
    instructions.querySelector('p').textContent = 'Klick zum Spielen';

}, undefined, (error) => console.error(error));


// Lädt das Waffen-Modell.
loader.load('assets/waffe.glb', (gltf) => {
    // Hol die Waffe aus der gltf-Datei. WICHTIG: Wir müssen die globale `weapon` Variable setzen.
    weapon = gltf.scene;

    // Setze die Startposition auf die definierte hipFirePosition.
    weapon.position.copy(hipFirePosition);

    const weaponScale = 0.4;
    weapon.scale.set(weaponScale, weaponScale, weaponScale);
    camera.add(weapon);
}, undefined, (error) => console.error('Fehler beim Laden der Waffe:', error));

// Und deklariere die `weapon` Variable ganz oben bei den anderen, damit sie global verfügbar ist.
let weapon; // z.B. unter `let isWorldReady = false;`


// =================================================================
// === 5. DER GAME-LOOP (ANIMATE-FUNKTION) ===
// =================================================================

const clock = new THREE.Clock();
let onGround = false;

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (isWorldReady && controls.isLocked) {

        // --- 1. Schwerkraft und Boden-Check ---
        groundRaycaster.set(controls.getObject().position, new THREE.Vector3(0, -1, 0));
        const groundIntersects = groundRaycaster.intersectObjects(worldObjects);
        onGround = groundIntersects.length > 0 && groundIntersects[0].distance < playerHeight / 2 + 0.1;

        if (!onGround) {
            playerVelocity.y -= gravity * delta;
        } else {
            playerVelocity.y = 0;
            // Diese Zeile lassen wir so, damit du weiter klettern kannst!
            controls.getObject().position.y = groundIntersects[0].point.y + playerHeight / 2;
        }

        // --- Sprung-Logik ---
        if (keys['Space'] && onGround) {
            // Gibt dem Spieler einen vertikalen Geschwindigkeitsschub.
            playerVelocity.y = jumpStrength;
        }

        // --- B. HORIZONTALE BEWEGUNG (LAUFEN) ---
        const playerDirection = new THREE.Vector3();
        playerDirection.z = Number(keys['KeyS']) - Number(keys['KeyW']);
        playerDirection.x = Number(keys['KeyD']) - Number(keys['KeyA']);
        playerDirection.normalize();

        const moveSpeed = playerSpeed * delta;
        const moveVector = new THREE.Vector3(playerDirection.x * moveSpeed, 0, playerDirection.z * moveSpeed);
        moveVector.applyQuaternion(controls.getObject().quaternion);

        // --- C. WAND-KOLLISION ---
        if (moveVector.lengthSq() > 0) {
            wallRaycaster.set(controls.getObject().position, moveVector.clone().normalize());
            const wallIntersects = wallRaycaster.intersectObjects(worldObjects);

            if (wallIntersects.length === 0 || wallIntersects[0].distance > 0.8) {
                controls.getObject().position.add(moveVector);
            }
        }

        // --- D. FINALE BEWEGUNG ANWENDEN ---
        controls.getObject().position.y += playerVelocity.y * delta;


        // --- G. ZIELEN (Aim Down Sights) ---
        const aimSpeed = delta * 10; // Geschwindigkeit der Ziel-Animation

        // Wähle die Ziel-Position basierend auf dem `isAiming`-Zustand.
        const targetWeaponPosition = isAiming ? adsPosition : hipFirePosition;
        // Wähle das Ziel-Sichtfeld (FOV).
        const targetFov = isAiming ? adsFov : normalFov;

        // Bewege die Waffe sanft zur Ziel-Position (Lineare Interpolation).
        weapon.position.lerp(targetWeaponPosition, aimSpeed);

        // Passe das Sichtfeld der Kamera sanft an.
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, aimSpeed);
        // WICHTIG: Nach jeder FOV-Änderung muss die Projektionsmatrix der Kamera aktualisiert werden.
        camera.updateProjectionMatrix();

    } // Ende von if (isWorldReady && controls.isLocked)


    renderer.render(scene, camera);
}

// =================================================================
// === 6. FENSTERGRÖSSE ANPASSEN ===
// =================================================================

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();