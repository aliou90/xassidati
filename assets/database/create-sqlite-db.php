<?php
// Chemin vers le fichier de base de données
require_once __DIR__. '/../../xs-app-infos.php';

$dbFile = __DIR__ . '/' . $app['name'] . '.db';

// Création de la base de données SQLite
try {
    $db = new PDO('sqlite:' . $dbFile);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Création de la table des utilisateurs
    $createUsersTable = "
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullname TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT UNIQUE,
        password TEXT NOT NULL,
        date_inscription TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        group_name TEXT,    --- Pour le marque-page
        book TEXT,          --- Pour le marque-page
        lang TEXT,          --- Pour le marque-page
        page INTEGER,       --- Pour le marque-page
        last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        collection_last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        state INTEGER NOT NULL DEFAULT 1,  -- Définit l'état par défaut à 1 (actif)
        activation_code TEXT
    );";

    // Création de la table Collection
    $createCollectionTable = "
    CREATE TABLE IF NOT EXISTS collection (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        collection_title TEXT NOT NULL UNIQUE,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );";

    // Création de la table Collection
    $createCollectionContentTable = "
    CREATE TABLE IF NOT EXISTS content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_id INTEGER NOT NULL,
        group_name TEXT,    --- Pour les livres de la collection
        book TEXT,          --- Pour les livres de la collection
        lang TEXT,          --- Pour les livres de la collection
        position INTEGER,   --- Ordre de tri de la collection
        arabicName TEXT,    --- Pour les livres de la collection
        author TEXT,        --- Pour les livres de la collection
        translator TEXT,    --- Pour les livres de la collection
        voice TEXT,         --- Pour les livres de la collection
        trans TEXT,          --- Pour les livres de la collection
        type TEXT,          --- Pour les livres de la collection
        FOREIGN KEY (collection_id) REFERENCES collection(id)
    );";


    // Exécution des requêtes de création des tables
    $db->exec($createUsersTable);
    $db->exec($createCollectionTable);
    $db->exec($createCollectionContentTable);

    // Ajout d'index pour optimiser les recherches
    $db->exec("CREATE INDEX IF NOT EXISTS idx_users_email_phone ON users(email, phone);");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_collection_user_id ON collection(user_id);");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_content_collection_id ON content(collection_id);");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_content_group_book_lang ON content(group_name, book, lang);");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_content_position ON content(collection_id, position);");

    echo "Base de données et tables créées avec succès." . PHP_EOL;

} catch (PDOException $e) {
    echo "Erreur lors de la création de la base de données : " . $e->getMessage();
}
?>
