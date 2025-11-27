<?php
/**
 * rqt_user_downloaded_books_get
 */
// VÉRIFICATION ET ACTIVATION DE SESSION
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}
// Récupération des informations de l'application
require_once __DIR__.'/xs-app-infos.php';

header("Content-Type: application/json");

// Vérification de la connexion utilisateur
if (!isset($_SESSION['user']['id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Utilisateur non connecté']);
    exit;
}

$userId = $_SESSION['user']['id'];

// Connection à la base de données MySQL ou SQLite
require_once __DIR__.'/xs-db-connect.php';

try {
    $stmt = $db->prepare("
        SELECT 
            collection.id AS collection_id, 
            collection.collection_title, 
            content.id AS id,
            content.group_name AS `group`, 
            content.book, 
            content.lang, 
            content.position, 
            content.arabicName, 
            content.author, 
            content.translator, 
            content.voice, 
            content.trans, 
            content.type
        FROM content 
        JOIN collection ON content.collection_id = collection.id 
        WHERE collection.user_id = :user_id 
        ORDER BY collection.id ASC, content.position ASC
    ");

    $stmt->execute(['user_id' => $userId]);

    $books = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($books);
} catch (Exception $e) {
    echo json_encode([
        'success' => false, 
        'message' => 'Erreur lors de la récupération des livres de l’utilisateur : ' . $e->getMessage()
    ]);
}
