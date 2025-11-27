<?php
/**
 * rqt_book_download.php
 */

header("Content-Type: application/json");

// Récupère le chemin du livre à partir de la requête, en s'assurant que le chemin est bien décodé
$bookPath = urldecode($_GET['path'] ?? '');  // Utilisez urldecode pour obtenir le chemin original

// Log pour vérifier les données reçues
error_log("Chemin reçu : " . $bookPath);

// Vérifie si le répertoire du livre existe
if (is_dir($bookPath)) {
    error_log("Répertoire du livre trouvé: " . $bookPath);

    // Récupère toutes les images du répertoire
    $images = array_merge(
        glob("$bookPath/*.png"),
        glob("$bookPath/*.jpg"),
        glob("$bookPath/*.jpeg"),
        glob("$bookPath/*.webp")
    );
    $images = array_map(function($image) {
        // Nettoyage et encodage de l'URL des images
        return rawurlencode($image);  // Utilisation de rawurlencode pour un meilleur encodage des URLs
    }, $images);

    // Vérifie si des images ont été trouvées et retourne le tableau
    if (!empty($images)) {
        echo json_encode($images);
    } else {
        echo json_encode([]);  // Retourne un tableau vide si aucune image n'est trouvée
    }
} else {
    error_log("Le répertoire du livre n'existe pas: " . $bookPath);
    echo json_encode([]);  // Retourne un tableau vide si le répertoire n'existe pas
}

?>
