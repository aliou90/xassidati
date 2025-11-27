<?php
// Chargement des infos de l'application
require_once __DIR__ . '/xs-app-infos.php';

// --- Paramètres MySQL ---
$host = 'localhost';
$user = 'root';
$pass = ''; // Mets ton mot de passe MySQL si nécessaire
$dbName = $app['name'] . '_db';

// --- Fallback SQLite ---
$dbPath = __DIR__ . '/assets/database/' . $app['name'] . '.db';

try {
    // Tentative de connexion à MySQL
    $db = new PDO("mysql:host=$host;dbname=$dbName;charset=utf8mb4", $user, $pass);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $dbType = 'mysql';

} catch (PDOException $e) {
    // Si la connexion MySQL échoue, on passe à SQLite
    try {
        $db = new PDO("sqlite:" . $dbPath);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $dbType = 'sqlite';
    } catch (PDOException $e2) {
        // Si aucune connexion n'est possible
        die("❌ Impossible de se connecter ni à MySQL ni à SQLite : " . $e2->getMessage());
    }
}
?>
