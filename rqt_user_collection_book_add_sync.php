<?php
/**
 * rqt_user_collection_book_add_sync.php
 * 
 */
// Récupération des informations de l'application
require_once __DIR__.'/xs-app-infos.php';

header("Content-Type: application/json");

// Connection à la base de données MySQL ou SQLite
require_once __DIR__.'/xs-db-connect.php';

$data = json_decode(file_get_contents("php://input"), true);

$userId = $data['userId'] ?? null;
$collectionId = $data['collectionId'] ?? null; 
$collectionTitle = $data['collectionTitle'] ?? null; // Pour la création de collection
$group = $data['group'] ?? null;
$book = $data['book'] ?? null;
$lang = $data['lang'] ?? null;
$arabicName = $data['arabicName'] ?? '';
$author = $data['author'] ?? '';
$translator = $data['translator'] ?? '';
$voice = $data['voice'] ?? '';
$trans = $data['trans'] ?? '';
$type = $data['type'] ?? '';
$position = $data['position'] ?? null;
$contenId = $data['contenId'] ?? null;

if (!$userId || !$group || !$book || !$lang) {
    echo json_encode(['success' => false, 'message' => 'Données manquantes.']);
    exit;
}

try {
    // Vérifier si l'utilisateur a déjà cette collection
    $collectionCheckStmt = $db->prepare("SELECT id FROM `collection` WHERE user_id = :user_id AND id = :collection_id LIMIT 1");
    $collectionCheckStmt->execute(['user_id' => $userId, 'collection_id' => $collectionId]);
    $foundCollectionId = $collectionCheckStmt->fetchColumn();

    // Si pas de collection, on en crée une
    if (!$foundCollectionId) {
        $createCollectionStmt = $db->prepare("INSERT INTO `collection` (user_id, id, collection_title) VALUES ( :user_id, :collection_id, :title)");
        $createCollectionStmt->execute([ 'user_id' => $userId, 'collection_id' => $collectionId, 'title' => $collectionTitle ? $collectionTitle : "Collection " . $collectionId]); // Nom par défaut
        $foundCollectionId = $db->lastInsertId();
    }

    // MODE SYNCHRONISATION (AJOUT DE LIVRE DEPUIS INDEXEDDB)
    if (!empty($position) && !empty($contenId)) {
        // Vérifier si le contenu (livre) avec cet ID existe déjà
        $checkContentStmt = $db->prepare("SELECT id FROM content WHERE id = :id");
        $checkContentStmt->execute([
            'id' => $contenId
        ]);
        $existingContentId = $checkContentStmt->fetchColumn();

        if ($existingContentId) {
            // SYNCHRONISATION DE POSITION
            // Mise à jour de la position uniquement
            $updateStmt = $db->prepare("UPDATE content SET position = :position WHERE id = :id");
            $updateStmt->execute([
                'position' => $position,
                'id' => $contenId
            ]);
        } else {
            // SYNCHRONISATION COMPLETE 
            // Insertion de livre inexistant depuis IndexedDB
            $insertStmt = $db->prepare("
                INSERT INTO content 
                    (collection_id, id, group_name, book, position, arabicName, author, translator, voice, lang, trans, type)
                VALUES 
                    (:collection_id, :id, :group_name, :book, :position, :arabicName, :author, :translator, :voice, :lang, :trans, :type)
            ");
            $insertStmt->execute([
                'collection_id' => $collectionId,
                'id' => $contenId,
                'group_name' => $group,
                'book' => $book,
                'position' => $position,
                'arabicName' => $arabicName,
                'author' => $author,
                'translator' => $translator,
                'voice' => $voice,
                'lang' => $lang,
                'trans' => $trans,
                'type' => $type
            ]);
        }
    } else {
        // MODE INSERTION (AJOUT DE NOUVEAU LIVRE)
        $maxPositionStmt = $db->prepare("SELECT MAX(position) FROM content WHERE collection_id = :collection_id");
        $maxPositionStmt->execute(['collection_id' => $collectionId]);
        $maxPosition = $maxPositionStmt->fetchColumn();
        $newPosition = $maxPosition ? $maxPosition + 1 : 1;

        $insertStmt = $db->prepare("
            INSERT INTO content 
                (collection_id, group_name, book, position, arabicName, author, translator, voice, lang, trans, type)
            VALUES 
                (:collection_id, :group_name, :book, :position, :arabicName, :author, :translator, :voice, :lang, :trans, :type)
        ");
        $insertStmt->execute([
            'collection_id' => $collectionId,
            'group_name' => $group,
            'book' => $book,
            'position' => $newPosition,
            'arabicName' => $arabicName,
            'author' => $author,
            'translator' => $translator,
            'voice' => $voice,
            'lang' => $lang,
            'trans' => $trans,
            'type' => $type
        ]);
    }

    echo json_encode(['success' => true, 'message' => 'Livre inséré dans la collection avec succès.']);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Erreur : ' . $e->getMessage()
    ]);
}
?>
