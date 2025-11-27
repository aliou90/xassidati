<?php
/**
 * rqt_books_group_images_get.php
 */

header("Content-Type: application/json");

if (isset($_GET['group']) && isset($_GET['book'])) {
    $group = trim(basename($_GET['group']));
    $book = trim(basename($_GET['book']));
    $dir = "assets/documents/books/$group/$book/images/";

    error_log("Group: $group, Book: $book, Directory: $dir");

    if (is_dir($dir)) {
        error_log("Le répertoire existe: $dir");

        $images = array_diff(scandir($dir), array('..', '.'));

        error_log("Images trouvées: " . json_encode($images));

        $images = array_values(array_filter($images, function($file) use ($dir) {
            return preg_match('/\.(jpg|jpeg|png|gif)$/i', $file);
        }));

        $images = array_map(function($file) use ($dir) {
            return $dir . rawurlencode($file); // Encodage URL pour compatibilité JavaScript
        }, $images);

        error_log("Filtered images with full paths: " . json_encode($images));

        // Trier les images par ordre naturel (numérique)
        natsort($images);
        $images = array_values($images); // Réindexer les clés après le tri

        echo json_encode($images);
    } else {
        error_log("Directory not found: $dir");
        echo json_encode([]);
    }
} else {
    error_log("Missing group or book parameters");
    echo json_encode([]);
}
?>
