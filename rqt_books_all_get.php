<?php
header('Content-Type: application/json');

// Fonction pour lire les groupes et livres
function getBooks($dir) {
    $groups = [];
    $groupDirs = array_filter(glob($dir . '/*'), 'is_dir');

    // Lire les répertoires dans le dossier books
    foreach ($groupDirs as $groupDir) {
        $groupName = basename($groupDir);
        $bookDirs = array_filter(glob($groupDir . '/*'), 'is_dir');
        $books = [];

        // Lire les livres dans le groupe
        foreach ($bookDirs as $bookDir) {
            $bookFolder = basename($bookDir);
            $configPath = "$bookDir/config/config.json";

            $config = [];
            $displayName = $bookFolder;

            // Lire le fichier de configuration s'il existe
            if (file_exists($configPath)) {
                $json = file_get_contents($configPath);
                $config = json_decode($json, true);
                if (!empty($config['nomLatin'])) {
                    $displayName = $config['nomLatin'];
                }
            }

            // Déterminer si le livre est en arabe selon la configuration ou le nom du dossier
            $isArabic = false;
            if (!empty($config['lang'])) {
                $isArabic = $config['lang'] === 'ar';
            } else {
                $isArabic = preg_match('/\p{Arabic}/u', $bookFolder);
            }

            // Ajouter le livre au tableau
            $books[] = [
                'folder' => $bookFolder,
                'name' => $displayName,
                'config' => $config,
                'isArabic' => $isArabic
            ];
        }

        // Trier les livres : arabe d’abord
        usort($books, function($a, $b) {
            if ($a['isArabic'] && !$b['isArabic']) return -1;
            if (!$a['isArabic'] && $b['isArabic']) return 1;
            return strnatcmp($a['name'], $b['name']);
        });

        $groups[$groupName] = $books;
    }

    // Trier les groupes : noms en arabe d'abord
    uksort($groups, function($a, $b) {
        $isArabicA = preg_match('/\p{Arabic}/u', $a);
        $isArabicB = preg_match('/\p{Arabic}/u', $b);

        if ($isArabicA && !$isArabicB) return -1;
        if (!$isArabicA && $isArabicB) return 1;
        return strnatcmp($a, $b);
    });

    return $groups;
}

// Appel de la fonction pour obtenir les livres
$books = getBooks(__DIR__.'/assets/documents/books');
// Envoyer la réponse JSON
echo json_encode($books, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
