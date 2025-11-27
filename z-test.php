<?php
// Récupération des informations de l'application
require_once __DIR__.'/xs-app-infos.php';

$dbPath = __DIR__ . '/assets/database/' . $app['name'] . '.db';
echo "Taille de la base : " . filesize($dbPath) / (1024 * 1024) . " Mo\n";
