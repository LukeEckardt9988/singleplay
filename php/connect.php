<?php
$servername = "localhost";
$username = "dein_db_benutzer";
$password = "dein_db_passwort";
$dbname = "deine_db";

// Verbindung erstellen
$conn = new mysqli($servername, $username, $password, $dbname);

// Verbindung prüfen
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
?>