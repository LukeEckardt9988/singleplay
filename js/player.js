// js/player.js

import * as THREE from 'three';

export class Player {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        
        // Bewegungs-Parameter
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.speed = 5.0;

        // Tastenstatus
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false
        };

        // Kollision
        this.collidables = [];
        this.raycaster = new THREE.Raycaster();
        this.playerBox = new THREE.Box3(); // Bounding Box für den Spieler

        this.addEventListeners();
    }
    
    setCollidables(collidableObjects) {
        this.collidables = collidableObjects;
    }

    addEventListeners() {
        // ... (Hier kommen die Event Listener für 'keydown' und 'keyup' hin, 
        // um this.keys zu setzen, z.B. bei 'w' this.keys.forward = true)
    }
    
    // Die Kernmethode für die Kollision
    checkCollision() {
        // Aktualisiere die Bounding Box des Spielers auf seine aktuelle Position
        this.playerBox.setFromCenterAndSize(this.camera.position, new THREE.Vector3(1, 2, 1)); // Größe anpassen! (Breite, Höhe, Tiefe)

        for (const collidable of this.collidables) {
            const collisionMeshBox = new THREE.Box3().setFromObject(collidable);
            if (this.playerBox.intersectsBox(collisionMeshBox)) {
                // Hier ist eine Kollision!
                return true; 
            }
        }
        return false;
    }


    update(delta) {
        const moveDistance = this.speed * delta; // Strecke, die wir uns bewegen wollen

        // Alte Position speichern, falls wir zurück müssen
        const oldPosition = this.camera.position.clone();
        
        // Bewegungsrichtung basierend auf Tastendrücken berechnen
        // (Diese Logik musst du noch implementieren, sie ändert this.camera.position)
        // z.B. if (this.keys.forward) this.camera.translateZ(-moveDistance);
        // z.B. if (this.keys.left) this.camera.translateX(-moveDistance);

        // --- Kollisions-Check ---
        if (this.checkCollision()) {
            // Wenn eine Kollision erkannt wird, setze die Position zurück
            this.camera.position.copy(oldPosition);
        }
    }
}