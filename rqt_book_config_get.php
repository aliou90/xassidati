<?php
// rqt_book_config_get.php

header('Content-Type: application/json');

// Sécuriser les entrées
$group = isset($_GET['group']) ? basename($_GET['group']) : '';
$book = isset($_GET['book']) ? basename($_GET['book']) : '';

$configPath = __DIR__ . "/assets/documents/books/$group/$book/config/config.json";

// Vérifier si le fichier existe
if (!file_exists($configPath)) {
    echo json_encode(["error" => "Fichier config.json introuvable"]);
    exit;
}

// Lire et décoder le contenu JSON
$json = file_get_contents($configPath);
$config = json_decode($json, true);

if (!$config) {
    echo json_encode(["error" => "Erreur de lecture ou format invalide"]);
    exit;
}

// Construire la réponse renommée
$response = [
    "group" => $group,
    "book" => $config['nomLatin'] ?? $book,
    "arabicName" => $config['nomArabe'] ?? '',
    "author" => $config['auteur'] ?? '',
    "translator" => $config['traducteur'] ?? '',
    "voice" => $config['voix'] ?? '',
    "lang" => ($config['lang'] ?? 'ar') === 'ar' ? 'ar' : 'noar',
    "trans" => $config['trans'] ?? '',
    "type" => $config['type'] ?? ''
];

echo json_encode($response);
