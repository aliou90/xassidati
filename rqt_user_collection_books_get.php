<?php
/**
 * rqt_user_collection_books_get.php
 * Récupère les livres d'une collection spécifique appartenant à l'utilisateur connecté.
 */

if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

// Récupération des informations de l'application
require_once __DIR__.'/xs-app-infos.php';

header("Content-Type: application/json");

// Vérifie que l'utilisateur est connecté
if (!isset($_SESSION['user']['id'])) {
    http_response_code(401); // Non autorisé
    echo json_encode(['success' => false, 'message' => 'Utilisateur non connecté']);
    exit;
}

if (!isset($_GET['collection_id']) || !is_numeric($_GET['collection_id'])) {
    http_response_code(400); // Mauvaise requête
    echo json_encode(['success' => false, 'message' => 'Paramètre collection_id manquant ou invalide']);
    exit;
}

$userId = $_SESSION['user']['id'];
$collectionId = intval($_GET['collection_id']);

try {
    // Connection à la base de données MySQL ou SQLite
    require_once __DIR__.'/xs-db-connect.php';

    $stmt = $db->prepare("
        SELECT 
            collection.id AS collection_id,
            collection.collection_title AS collection_title,
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
        WHERE collection.user_id = :user_id AND collection.id = :collection_id
        ORDER BY content.position ASC
    ");

    $stmt->execute([
        'user_id' => $userId,
        'collection_id' => $collectionId
    ]);

    $books = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($books);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Erreur serveur : ' . $e->getMessage()]);
}
?>
