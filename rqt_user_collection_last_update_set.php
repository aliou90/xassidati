<?php
/**
 * rqt_user_collection_last_update_set.php
 */

// VÉRIFICATION ET L'ACTIVATION DE SESSION
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}
header('Content-Type: application/json');

// Vérifiez si l'utilisateur est connecté
if (!isset($_SESSION['user']['id'])) {
    http_response_code(401); // Non autorisé
    echo json_encode(['success' => false, 'message' => 'Utilisateur non connecté']);
    exit;
}

// Récupération des données envoyées en JSON
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// Vérifiez que les données sont valides
if (!isset($data['user_id'], $data['collection_last_update'])) {
    http_response_code(400); // Mauvaise requête
    echo json_encode(['success' => false, 'message' => 'Données invalides']);
    exit;
}

try {
    // Récupération des informations de l'application
    require_once __DIR__.'/xs-app-infos.php';

    // Connection à la base de données MySQL ou SQLite
    require_once __DIR__.'/xs-db-connect.php';

    $userId = $data['user_id'];
    $lastUpdate = $data['collection_last_update'];

    // Vérifier si la collection de l'utilisateur existe
    $checkStmt = $db->prepare("SELECT id FROM collection WHERE user_id = :user_id");
    $checkStmt->execute(['user_id' => $userId]);
    $collectionId = $checkStmt->fetchColumn();

    if (!$collectionId) {
        // Créer une collection par défaut nommée "Dìwàn 1"
        $createStmt = $db->prepare("
            INSERT INTO collection (user_id, collection_title)
            VALUES (:user_id, :title)
        ");
        $createStmt->execute([
            'user_id' => $userId,
            'title' => 'Dìwàn 1' // Nom par défaut en attendant qu'il soit reçu
        ]);
    }

    // Mettre à jour la date de dernière mise à jour de la collection existante dans `users`
    $updateStmt = $db->prepare("
        UPDATE users
        SET collection_last_update = :collection_last_update
        WHERE id = :user_id
    ");
    $updateStmt->execute([
        'collection_last_update' => $lastUpdate,
        'user_id' => $userId,
    ]);

    if ($updateStmt->rowCount() > 0) {
        $_SESSION['user']['collection_last_update'] = $lastUpdate;
        echo json_encode(['success' => true, 'message' => 'Mise à jour réussie.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Aucune mise à jour effectuée.']);
    }

} catch (PDOException $e) {
    error_log('Erreur PDO : ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
