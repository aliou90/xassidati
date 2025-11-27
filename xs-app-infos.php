<?php
/**
 * xs-app-infos.php
 */

/** VARIABLES DE L'APPLICATION */
// Informations dynamiques de l'application
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost'; // Valeur par défaut si non définie
$port = isset($_SERVER['SERVER_PORT']) ? $_SERVER['SERVER_PORT'] : '80'; // Port par défaut
$ip = isset($_SERVER['SERVER_ADDR']) ? $_SERVER['SERVER_ADDR'] : '127.0.0.1'; // Adresse IP par défaut

$app = [
    'name' => 'Xassidati',
    'description' => 'Xassidati - Bibliothèque du Coran et des Livres de Cheikh Ahmadou Bamba Khadimou Rassoul',    
    'icone' => '/assets/icons/fall-icon-192x192.png',
    'host' => $host,
    'ip' => $ip, // Adresse IP du serveur
    'port' => $port,
    'url' => $protocol . $host . ':' . $port . '/', // Construit l'URL de base
    'url_ip' => $protocol . $ip . '/', // Construit l'URL de base avec l'ip
    'smtp_email' => 'tech.jamm.corp@gmail.com',
    'smtp_host' => 'smtp.gmail.com',
    'smtp_auth' => true,
    'smtp_secure' => 'tls',
    'smtp_port' => 587,
    'smtp_password' => 'zridwwwnrgvmhsgx'
];


// Gestion des Mails 
// autoload avec composer
// require __DIR__ . '/vendor/autoload.php';
require_once __DIR__.'/assets/PHPMailer/src/PHPMailer.php';
require_once __DIR__.'/assets/PHPMailer/src/SMTP.php';
require_once __DIR__.'/assets/PHPMailer/src/Exception.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

function send_welcome_mail($app, $user){
    $mail = new PHPMailer(true);

    // Configuration des paramètres SMTP
    $mail->isSMTP();
    $mail->Host = $app['smtp_host'];
    $mail->SMTPAuth = $app['smtp_auth'];
    $mail->Username = $app['smtp_email'];
    $mail->Password = $app['smtp_password'];
    $mail->SMTPSecure = $app['smtp_secure'];
    $mail->Port = $app['smtp_port'];

    // Envoi de l'email de confirmation
    $to = $user['email'];
    $subject = $app['name'] . " - " . "Inscription réussie !";
    // Corps
    $message = "Bonjour " . $user['fullname'] . ",\r\n\r\n";
    $message .= "Merci de vous être inscrit(e) sur notre plateforme ". $app['name'] ." \nVous pouvez: \nInstaller l'application,\nTélécharger et lire des livres même sans connexion internet,\nMarquer une page pour reprendre votre lecture ultérieurement \net encore plus de fonctionnalités. \r\n";
    $message .= "Nous sommes impatients de vous retrouver sur: \n" . $app['url'] . " \r\n\r\n";
    $message .= "Cordialement,\r\n";
    $message .= "L'équipe de ".$app['name'];

    $mail->setFrom($app['smtp_email'], $app['name']);
    $mail->addAddress($to, $user['fullname']);
    $mail->CharSet = 'UTF-8';
    $mail->Subject = "=?UTF-8?B?" . base64_encode($subject) . "?=";
    $mail->Body = $message;
    
    if($mail->send()) {
        //Affichage de message de succes de l'inscription 
        return  true;
    } else {
        return false;
    }
}

function send_password_mail($app, $user, $activation_code){
    $mail = new PHPMailer(true);

    // Configuration des paramètres SMTP
    $mail->isSMTP();
    $mail->Host = $app['smtp_host'];
    $mail->SMTPAuth = $app['smtp_auth'];
    $mail->Username = $app['smtp_email'];
    $mail->Password = $app['smtp_password'];
    $mail->SMTPSecure = $app['smtp_secure'];
    $mail->Port = $app['smtp_port'];

    // Envoi de l'email de confirmation
    $to = $user['email'];
    $subject = $app['name'] . " - " . "Récupération de mot de passe";
    // Corps
    $message = "Bonjour " . $user['fullname'] . ",\r\n\r\n";
    $message .= "Bienvenue sur notre plateforme ". $app['name'] ." \nPour réinitialiser votre mot de passe, veuillez cliquer sur le lien suivant : \r\n";
    $message .= $app['url']."index.php?id=" . $user['id'] . "&&" . "state=" . 0 . "&&" . "activation_code=". $activation_code . "\r\n\r\n";
    $message .= "Cordialement,\r\n";
    $message .= "L'équipe de ".$app['name'];

    $mail->setFrom($app['smtp_email'], $app['name']);
    $mail->addAddress($to, $user['fullname']);
    $mail->CharSet = 'UTF-8';
    $mail->Subject = "=?UTF-8?B?" . base64_encode($subject) . "?=";
    $mail->Body = $message;
    
    if($mail->send()) {
        //Affichage de message de succes de l'inscription 
        return  true;
    } else {
        return false;
    }
}

?>
