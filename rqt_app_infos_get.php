<?php
// On importe les variables sans perturber leur utilisation ailleurs
require_once 'xs-app-infos.php';

// Envoie les données au format JSON uniquement si la requête est AJAX
header('Content-Type: application/json');

// On peut choisir d'envoyer seulement une partie du tableau si on veut sécuriser
echo json_encode([
    'name' => $app['name'],
    'description' => $app['description'],
    'url' => $app['url'],
    'icone' => $app['icone'],
    'smtp_email' => $app['smtp_email']
]);
?>
