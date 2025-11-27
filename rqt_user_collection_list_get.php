<?php
// rqt_user_collection_list_get.php

session_start();
header('Content-Type: application/json');

// Vérification que l'utilisateur est connecté
if (!isset($_SESSION['user']['id'])) {
    http_response_code(401); // Non autorisé
    echo json_encode(['success' => false, 'message' => 'Utilisateur non connecté']);
    exit;
}

$userId = $_SESSION['user']['id'];

try {
    // Récupération des informations de l'application
    require_once __DIR__.'/xs-app-infos.php';

    // Connection à la base de données MySQL ou SQLite
    require_once __DIR__.'/xs-db-connect.php';

    // Récupération des collections de l'utilisateur
    $stmt = $db->prepare("SELECT id, collection_title AS name FROM collection WHERE user_id = :user_id ORDER BY id DESC");
    $stmt->execute(['user_id' => $userId]);
    $collections = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($collections);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erreur serveur : ' . $e->getMessage()]);
}
