<?php
require_once __DIR__ . '/../../xs-app-infos.php';

// Informations de connexion MySQL (adapter si besoin)
$host = 'localhost';
$user = 'root';
$pass = ''; // Mets ton mot de passe MySQL si nécessaire
$dbName = $app['name'] . '_db';

try {
    // Connexion initiale sans sélection de base pour pouvoir la créer
    $pdo = new PDO("mysql:host=$host;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Création de la base de données si elle n’existe pas
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;");
    echo "Base de données '$dbName' vérifiée/créée avec succès.<br>";

    // Connexion à la base nouvellement créée
    $db = new PDO("mysql:host=$host;dbname=$dbName;charset=utf8mb4", $user, $pass);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // --- Table des utilisateurs ---
    $createUsersTable = "
    CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fullname VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(50) UNIQUE,
        password VARCHAR(255) NOT NULL,
        date_inscription TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        group_name VARCHAR(255),
        book VARCHAR(255),
        lang VARCHAR(50),
        page INT,
        last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        collection_last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        state TINYINT(1) NOT NULL DEFAULT 1,
        activation_code VARCHAR(255)
    ) ENGINE=InnoDB;";

    // --- Table des collections ---
    $createCollectionTable = "
    CREATE TABLE IF NOT EXISTS collection (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        collection_title VARCHAR(255) NOT NULL UNIQUE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;";

    // --- Table des contenus ---
    $createContentTable = "
    CREATE TABLE IF NOT EXISTS content (
        id INT AUTO_INCREMENT PRIMARY KEY,
        collection_id INT NOT NULL,
        group_name VARCHAR(255),
        book VARCHAR(255),
        lang VARCHAR(50),
        position INT,
        arabicName VARCHAR(255),
        author VARCHAR(255),
        translator VARCHAR(255),
        voice VARCHAR(255),
        trans TEXT,
        type VARCHAR(100),
        FOREIGN KEY (collection_id) REFERENCES collection(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;";

    // Exécution des requêtes de création
    $db->exec($createUsersTable);
    $db->exec($createCollectionTable);
    $db->exec($createContentTable);

    // Création des index
    $db->exec("CREATE INDEX IF NOT EXISTS idx_users_email_phone ON users (email, phone);");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_collection_user_id ON collection (user_id);");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_content_collection_id ON content (collection_id);");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_content_group_book_lang ON content (group_name, book, lang);");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_content_position ON content (collection_id, position);");

    echo "Tables et index créés avec succès dans la base '$dbName'.";

} catch (PDOException $e) {
    echo "❌ Erreur : " . $e->getMessage();
}
?>
