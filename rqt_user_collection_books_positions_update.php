<?php
/**
 * rqt_user_collection_books_positions_update.php
 * 
 * Met à jour les positions des livres dans la base de données
 * Ainsi que la langue (du 1er livre) reçu
 */

header("Content-Type: application/json");

// Récupération des informations de l'application
require_once __DIR__.'/xs-app-infos.php';

// Connection à la base de données MySQL ou SQLite
require_once __DIR__.'/xs-db-connect.php';

$data = json_decode(file_get_contents("php://input"), true);
$userId = $data['userId'] ?? null;
$books = $data['books'] ?? [];

if (!$userId || empty($books)) {
    echo json_encode(['success' => false, 'message' => 'Données manquantes.']);
    exit;
}

try {
    foreach ($books as $book) {
        $contentId = intval($book['id']);
        $group = $book['group'];
        $bookName = $book['book'];
        $position = $book['position'];

        $updateStmt = $db->prepare("
            UPDATE content 
            SET position = :position
            WHERE id = :contentId, group_name = :group_name AND book = :book AND collection_id = (
                SELECT id FROM collection WHERE user_id = :user_id
            )
        ");
        $updateStmt->execute([
            'contentId' => $contentId,
            'position' => $position,
            'group_name' => $group,
            'book' => $bookName,
            'user_id' => $userId,
        ]);
    }

    echo json_encode(['success' => true, 'message' => 'Positions mises à jour.']);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Erreur lors de la mise à jour : ' . $e->getMessage()]);
}
?>
