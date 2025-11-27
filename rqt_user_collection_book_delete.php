<?php
/**
 * rqt_user_collection_book_delete.php
 */
// Récupération des informations de l'application
require_once __DIR__.'/xs-app-infos.php';

header("Content-Type: application/json");

try {
    // Connection à la base de données MySQL ou SQLite
    require_once __DIR__.'/xs-db-connect.php';

    $data = json_decode(file_get_contents("php://input"), true);

    $userId = $data['userId'] ?? null;
    $contentId = $data['contentId'] ?? null;
    $group = $data['group'] ?? null;
    $book = $data['book'] ?? null;

    if (!$userId) {
        echo json_encode(['success' => false, 'message' => 'Identifiant utilisateur manquant.']);
        exit;
    }

    // Récupérer l'id de la collection
    $collectionCheckStmt = $db->prepare("SELECT id FROM collection WHERE user_id = :user_id");
    $collectionCheckStmt->execute(['user_id' => $userId]);
    $collectionId = $collectionCheckStmt->fetchColumn();

    if (!$collectionId) {
        // Créer la collection si elle n'existe pas
        $createCollectionStmt = $db->prepare("INSERT INTO collection (user_id, collection_title) VALUES (:user_id, :title)");
        $createCollectionStmt->execute(['user_id' => $userId, 'title' => 'Dìwàn 1']);
        $collectionId = $db->lastInsertId();

        echo json_encode(['success' => false, 'message' => 'Collection créée car inexistante.']);
        exit;
    }

    if ($contentId) {
        // Suppression par ID direct
        $deleteStmt = $db->prepare("DELETE FROM content WHERE id = :id");
        $deleteStmt->execute(['id' => $contentId]);
    } elseif ($group && $book) {
        // Récupérer un ID correspondant au dernier à supprimer
        $selectStmt = $db->prepare("
            SELECT id FROM content
            WHERE collection_id = :collection_id AND group_name = :group_name AND book = :book
            LIMIT 1
        ");
        $selectStmt->execute([
            'collection_id' => $collectionId,
            'group_name' => $group,
            'book' => $book
        ]);

        $contentIdToDelete = $selectStmt->fetchColumn();

        if ($contentIdToDelete) {
            $deleteStmt = $db->prepare("DELETE FROM content WHERE id = :id");
            $deleteStmt->execute(['id' => $contentIdToDelete]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Aucune correspondance trouvée pour suppression.']);
            exit;
        }

    } else {
        echo json_encode(['success' => false, 'message' => 'Données insuffisantes pour supprimer.']);
        exit;
    }

    if ($deleteStmt->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Livre supprimé de la collection.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Aucun enregistrement supprimé.']);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Erreur : ' . $e->getMessage()]);
}
?>
