<?php
/**
 * rqt_marked_page_sync.php
 */
header("Content-Type: application/json");

// VÉRIFICATION ET L'ACTIVATION DE SESSION
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}
// Fichier contenant les variables
require_once __DIR__.'/xs-app-infos.php';

try {
    // Connection à la base de données MySQL ou SQLite
    require_once __DIR__.'/xs-db-connect.php';
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Erreur lors de la connexion à la base de données."]);
    exit();
}

// Récupération des données envoyées par le client
$data = json_decode(file_get_contents("php://input"), true);
if (!$data || !isset($data['id']) || !isset($data['last_update'])) {
    http_response_code(400);
    echo json_encode(["error" => "Données de synchronisation non valides."]);
    exit();
}

// Vérification si l'utilisateur existe dans la base de données
$query = $db->prepare("SELECT last_update FROM users WHERE id = :id");
$query->bindValue(':id', $data['id'], PDO::PARAM_INT);
$query->execute();
$user = $query->fetch(PDO::FETCH_ASSOC);

if ($user) {
    // Vérification si les données du client sont plus récentes
    if ($data['last_update'] > $user['last_update']) {
        // Mise à jour de l'utilisateur
        $update = $db->prepare("
            UPDATE users
            SET last_update = :last_update, group_name = :group_name, book = :book, lang = :lang, page = :page
            WHERE id = :id
        ");
        $update->bindValue(':last_update', $data['last_update'], PDO::PARAM_STR);
        $update->bindValue(':group_name', $data['group_name'], PDO::PARAM_STR);
        $update->bindValue(':book', $data['book'], PDO::PARAM_STR);
        $update->bindValue(':lang', $data['lang'], PDO::PARAM_STR);
        $update->bindValue(':page', $data['page'], PDO::PARAM_INT);
        
        if ($update->execute()) {
            $_SESSION['user']['last_update'] = $data['last_update'];
            echo json_encode(["success" => "Données mises à jour avec succès."]);
        } else {
            http_response_code(500);
            echo json_encode(["error" => "Erreur lors de la mise à jour de la base de données."]);
        }
    } else {
        echo json_encode(["info" => "Les données sont déjà à jour."]);
    }
} else {
    http_response_code(404);
    echo json_encode(["error" => "Utilisateur non trouvé."]);
}
?>
