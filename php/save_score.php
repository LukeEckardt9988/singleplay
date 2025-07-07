<?php
include 'connect.php';

// Daten aus dem POST-Request holen (JSON-Format)
$data = json_decode(file_get_contents('php://input'), true);

$username = $data['username'];
$score = $data['score'];

if (!empty($username) && isset($score)) {
    $stmt = $conn->prepare("INSERT INTO scores (username, score) VALUES (?, ?)");
    $stmt->bind_param("si", $username, $score);

    if ($stmt->execute()) {
        echo json_encode(["status" => "success", "message" => "Score saved."]);
    } else {
        echo json_encode(["status" => "error", "message" => "Error saving score."]);
    }
    $stmt->close();
} else {
    echo json_encode(["status" => "error", "message" => "Invalid data."]);
}

$conn->close();
?>