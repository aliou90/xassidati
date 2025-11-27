<?php
// xs-sitemap.php
// Ce script génère un fichier JSON contenant les livres et un fichier sitemap.xml pour le référencement
// Il parcourt les livres dans le dossier assets/documents/books et extrait les informations nécessaires
// pour créer un fichier JSON et un sitemap XML.
// Il met également à jour le fichier robots.txt pour inclure le lien vers le sitemap.xml

// information sur l'application
require_once __DIR__ . '/xs-app-infos.php';

$baseDir = __DIR__ . '/assets/documents/books/';
$outputFile = __DIR__ . '/assets/data/books.json';
$sitemapFile = __DIR__ . '/sitemap.xml';
$baseUrl = $app['url']; // URL de base de l'application

$books = [];
$sitemapEntries = [];

$sitemapEntries[] = '<?xml version="1.0" encoding="UTF-8"?>';
$sitemapEntries[] = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

$groups = array_filter(glob($baseDir . '*'), 'is_dir');

foreach ($groups as $groupPath) {
    $groupName = basename($groupPath);
    $booksInGroup = array_filter(glob($groupPath . '/*'), 'is_dir');

    foreach ($booksInGroup as $bookPath) {
        $bookName = basename($bookPath);
        $configPath = $bookPath . '/config/config.json';

        if (file_exists($configPath)) {
            $configContent = file_get_contents($configPath);
            $config = json_decode($configContent, true);

            if (isset($config['nomLatin']) && isset($config['nomArabe']) && isset($config['lang'])) {
                $lang = $config['lang'];

                $books[] = [
                    'group' => $groupName,
                    'folder' => $bookName,
                    'nomLatin' => $config['nomLatin'],
                    'nomArabe' => $config['nomArabe'],
                    'lang' => $lang
                ];

                // Créer une URL avec nomLatin
                $url1 = $baseUrl . '/index.html?group=' . rawurlencode($groupName) . 
                        '&book=' . rawurlencode($config['nomLatin']) . 
                        '&lang=' . rawurlencode($lang);

                // Créer une URL avec nomArabe
                $url2 = $baseUrl . '/index.html?group=' . rawurlencode($groupName) . 
                        '&book=' . rawurlencode($config['nomArabe']) . 
                        '&lang=' . rawurlencode($lang);

                foreach ([$url1, $url2] as $url) {
                    $sitemapEntries[] = '  <url>';
                    $sitemapEntries[] = "    <loc>$url</loc>";
                    $sitemapEntries[] = '    <changefreq>monthly</changefreq>';
                    $sitemapEntries[] = '    <priority>0.8</priority>';
                    $sitemapEntries[] = '  </url>';
                }
            }
        }
    }
}

// Sauvegarde
file_put_contents($outputFile, json_encode($books, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
$sitemapEntries[] = '</urlset>';
file_put_contents($sitemapFile, implode("\n", $sitemapEntries));

echo "books.json généré avec succès : " . count($books) . " livres.\n";
echo "sitemap.xml généré avec succès.\n";

$robotsFile = __DIR__ . '/robots.txt';
$sitemapUrl = $baseUrl . '/sitemap.xml';

// Lire l'existant s'il y a
$robotsContent = file_exists($robotsFile) ? file($robotsFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) : [];

$foundSitemap = false;
foreach ($robotsContent as &$line) {
    if (stripos(trim($line), 'sitemap:') === 0) {
        $line = "Sitemap: $sitemapUrl";
        $foundSitemap = true;
        break;
    }
}
unset($line);

// Si pas trouvé, on l’ajoute à la fin
if (!$foundSitemap) {
    $robotsContent[] = "Sitemap: $sitemapUrl";
}

// Réécriture du fichier
file_put_contents($robotsFile, implode("\n", $robotsContent) . "\n");

echo "robots.txt mis à jour sans supprimer les lignes existantes.\n";


// Création du fichier books.jsonld
// Ce fichier contient les métadonnées des livres au format JSON-LD pour le SEO
// On suppose que le fichier books.json a déjà été généré précédemment
$booksJson = file_get_contents(__DIR__ . '/assets/data/books.json');
if ($booksJson === false) {
    die("Erreur lors de la lecture du fichier books.json");
}
// Décodage du JSON pour le traitement
if (empty($booksJson)) {
    die("Le fichier books.json est vide ou n'existe pas.");
}
$books = json_decode($booksJson, true);

$items = [];

foreach ($books as $book) {
    $items[] = [
        "@context" => "https://schema.org",
        "@type" => "Book",
        "name" => $book['nomLatin'],
        "alternateName" => $book['nomArabe'],
        "inLanguage" => "fr", // ou extraire depuis config.json si dispo
        "url" => $app["url"] . "/index.html?group={$book['group']}&book={$book['folder']}&lang=fr"
    ];
}

file_put_contents(
    __DIR__ . '/assets/data/books.jsonld',
    json_encode($items, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
);
echo "✅ books.jsonld généré.";
