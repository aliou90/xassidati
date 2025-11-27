<?php
/**
 * rqt_marked_page_set.php
 * 
 */

// VÉRIFICATION ET L'ACTIVATION DE SESSION
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}
header('Content-Type: application/json');
 
// Fichier contenant les variables
require_once __DIR__.'/xs-app-infos.php';

// Vérifier si l'utilisateur est connecté
if (!isset($_SESSION['user']['id'])) {
    http_response_code(401); // Non autorisé
    echo json_encode(['message' => 'Utilisateur non connecté']);
    exit;
}
 
// Récupération des données envoyées en JSON
$input = file_get_contents('php://input');
$data = json_decode($input, true);
 
// Vérifier que les données sont valides
if (isset($data['page'], $data['group'], $data['book'], $data['lang'], $data['last_update'])) {
    error_log(print_r($data, true)); // Afficher les données reçues

    try {
        // Connection à la base de données MySQL ou SQLite
        require_once __DIR__.'/xs-db-connect.php';

        // Récupération de l'ID de l'utilisateur depuis la session
        $userId = $_SESSION['user']['id'];

        // Mettre à jour les informations de marque-page existantes pour l'utilisateur
        $stmt = $db->prepare("
        UPDATE users 
        SET group_name = :group, book = :book, page = :page, lang = :lang, last_update = :last_update
        WHERE id = :userId
        ");
        
        // Exécuter la requête avec les données du marque-page
        $stmt->execute([
            'group' => $data['group'],
            'book' => $data['book'],
            'page' => $data['page'],
            'lang' => $data['lang'],
            'last_update' => $data['last_update'], 
            'userId' => $userId
        ]);

        // Vérifier si la mise à jour a affecté une ligne
        if ($stmt->rowCount() > 0) {
            // Mettre à jour la session avec les nouvelles informations
            $_SESSION['user']['group_name'] = $data['group'];
            $_SESSION['user']['book'] = $data['book'];
            $_SESSION['user']['page'] = $data['page'];
            $_SESSION['user']['lang'] = $data['lang'];
            $_SESSION['user']['last_update'] = $data['last_update'];

            echo json_encode(['message' => 'Page marquée avec succès']);
        } else {
            // Aucune ligne affectée
            http_response_code(404);
            echo json_encode(['message' => 'Aucun marque-page trouvé pour cet utilisateur']);
        }
        
    } catch (PDOException $e) {
        // Afficher l'erreur dans les logs
        error_log('Erreur PDO : ' . $e->getMessage());
        http_response_code(500); // Erreur interne du serveur
        echo json_encode(['message' => 'Erreur lors de la mise à jour : ' . $e->getMessage()]);
    }

} else {
    // Réponse en cas de données manquantes ou invalides
    http_response_code(400); // Mauvaise requête
    echo json_encode(['message' => 'Données invalides']);
}
 

?>
