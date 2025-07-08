<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>Ego-Shooter</title>
    
    <script type="importmap">
    {
        "imports": {
            "three": "https://unpkg.com/three@0.165.0/build/three.module.js",
            "three/addons/": "https://unpkg.com/three@0.165.0/examples/jsm/"
        }
    }
    </script>
    
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div id="blocker">
        <div id="instructions">
            <p>Klick zum Spielen</p>
            <span>W, A, S, D = Bewegen | Maus = Umschauen | Leertaste = Springen | R = Nachladen</span>
        </div>
    </div>

    <div id="crosshair-container">
        <div class="crosshair-line" id="crosshair-top"></div>
        <div class="crosshair-line" id="crosshair-bottom"></div>
        <div class="crosshair-line" id="crosshair-left"></div>
        <div class="crosshair-line" id="crosshair-right"></div>
    </div>

    <div id="timer-container">
        <span id="timer">05:00</span>
    </div>

    <div id="hud">
        
        <div id="health-container">
            <span id="health-icon">❤️</span>
            <span id="health-display">100</span>
        </div>

        <div id="weapon-ammo-container">
            <div id="weapon-display">
                <span id="weapon-icon">🔫</span>
                <span id="weapon-name">Pistole</span>
            </div>
            <div id="ammo-container">
                <span id="current-ammo">30</span> / <span id="magazine-count">6</span>
            </div>
        </div>

    </div>

    <script type="module" src="js/game.js"></script>
</body>