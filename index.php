<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>Mein Ego-Shooter</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div id="blocker">
        <div id="instructions">
            <p style="font-size:36px">Klick zum Spielen</p>
            <p>
                W, A, S, D = Bewegen<br/>
                Maus = Umschauen
            </p>
        </div>
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