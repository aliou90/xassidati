<?php
/**
 * rqt_user_collection_last_update_get.php
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

// Récupération des informations de l'application
require_once __DIR__.'/xs-app-infos.php';

try {
    // Connection à la base de données MySQL ou SQLite
    require_once __DIR__.'/xs-db-connect.php';

    $userId = $_SESSION['user']['id'];

    // Rechercher une collection existante
    $stmt = $db->prepare("SELECT collection_last_update FROM users WHERE id = :user_id LIMIT 1");
    $stmt->execute(['user_id' => $userId]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($result) {
        // ✅ Collection existante → renvoyer la date
        echo json_encode(['success' => true, 'last_update' => $result['collection_last_update']]);
    } else {
        // ❌ Pas de collection → en créer une par défaut
        $createStmt = $db->prepare("
            INSERT INTO collection (user_id, collection_title)
            VALUES (:user_id, :title)
        ");
        $createStmt->execute([
            'user_id' => $userId,
            'title' => 'Dìwàn 1'
        ]);

        // ✅ Renvoyer null car c’est une création "tardive" (pas de données encore)
        echo json_encode(['success' => true, 'last_update' => null]);
    }

} catch (PDOException $e) {
    error_log('Erreur PDO : ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erreur interne du serveur']);
}
?>
