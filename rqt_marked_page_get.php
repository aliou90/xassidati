<?php
/**
 * rqt_marked_page_get.php
 * 
 */
header('Content-Type: application/json');

// VÉRIFICATION ET L'ACTIVATION DE SESSION
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

// Fichier contenant les variables
require_once __DIR__.'/xs-app-infos.php';

// Vérifiez que l'utilisateur est connecté
if (!isset($_SESSION['user']['id'])) {
    echo json_encode(['error' => 'Utilisateur non connecté']);
    exit;
}

// Connexion à la base de données SQLite
try {
    // Connection à la base de données MySQL ou SQLite
    require_once __DIR__.'/xs-db-connect.php';

    // Récupération de l'ID de l'utilisateur depuis la session
    $userId = $_SESSION['user']['id'];

    // Préparez la requête pour récupérer le marque-page de cet utilisateur
    $stmt = $db->prepare("SELECT group_name AS `group`, book, lang, page, last_update FROM users WHERE id = :userId");
    $stmt->bindParam(':userId', $userId, PDO::PARAM_INT);
    $stmt->execute();
    $markedPage = $stmt->fetch(PDO::FETCH_ASSOC);

    // Vérifiez si un marque-page est trouvé et retournez-le
    if ($markedPage) {
        echo json_encode($markedPage);
    } else {
        echo json_encode(['error' => 'Aucun marque-page trouvé pour cet utilisateur']);
    }

} catch (PDOException $e) {
    echo json_encode(['error' => 'Erreur de connexion à la base de données : ' . $e->getMessage()]);
}
?>
