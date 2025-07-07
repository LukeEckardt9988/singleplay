<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mein Ego-Shooter</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div id="crosshair">+</div>
    <div id="ui">
        <div>Punkte: <span id="score">0</span></div>
        <div>Munition: <span id="ammo">10 / 30</span></div>
    </div>
    <div id="game-over" style="display: none;">
        <h1>Game Over</h1>
        <p>Dein Score: <span id="final-score">0</span></p>
        <input type="text" id="username" placeholder="Dein Name">
        <button id="save-score-btn">Score Speichern</button>
    </div>

    <script type="importmap">
    {
        "imports": {
            "three": "https://unpkg.com/three@0.165.0/build/three.module.js",
            "three/addons/": "https://unpkg.com/three@0.165.0/examples/jsm/"
        }
    }
    </script>

    <script type="module" src="js/game.js"></script>
</body>
</html>