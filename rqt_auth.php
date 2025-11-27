<?php
/**
 * rqt_auth.php
 */

header("Content-Type: application/json");

// Fichier contenant les variables de l'application
require_once __DIR__.'/xs-app-infos.php';

// VÉRIFICATION ET L'ACTIVATION DE SESSION
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

// Connection à la base de données MySQL ou SQLite
require_once __DIR__.'/xs-db-connect.php';


$action = $_GET['action'] ?? '';

if ($action === 'login') {
    $login = $_POST['login'];
    $password = $_POST['password'];

    // Récupération de l'utilisateur avec l'email ou le téléphone fourni
    $stmt = $db->prepare("SELECT id, fullname, password, group_name, book, lang, page, last_update, collection_last_update, state FROM users WHERE email = :login OR phone = :login");
    $stmt->execute(['login' => $login]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // Vérification du mot de passe
    if ($user && password_verify($password, $user['password'])) {
        // Supprimer le parametre password de $user
        unset($user['password']);
        // État du compte
        $state = $user['state'];
        if ($state == 0) {
            // Réactiver compte
            $stmt = $db->prepare("UPDATE users SET state = 1, activation_code = NULL WHERE id = :id");
            $result = $stmt->execute(['id' => $user['id']]);
        }

        // Stockage de toutes les données de l'utilisateur dans la session
        $_SESSION['user']['id'] = $user['id'];
        $_SESSION['user']['fullname'] = $user['fullname'];
        $_SESSION['user']['group_name'] = $user['group_name'];
        $_SESSION['user']['book'] = $user['book'];
        $_SESSION['user']['lang'] = $user['lang'];
        $_SESSION['user']['page'] = $user['page'];
        $_SESSION['user']['last_update'] = $user['last_update'];
        $_SESSION['user']['collection_last_update'] = $user['collection_last_update'];

        echo json_encode(['success' => true, 'user' => $_SESSION['user']]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Identifiants incorrects']);
    }

} elseif ($action === 'register') {
    $fullname = $_POST['fullname'];
    $email = $_POST['email'];
    $phone = $_POST['phone'];
    $password = $_POST['password'];
    $confirmPassword = $_POST['confirm_password'];

    // Validation du nom complet (au moins 3 caractères alphanumériques)
    if (!preg_match('/^[a-zA-Z0-9 ]{3,}$/', $fullname)) {
        echo json_encode(['success' => false, 'message' => 'Le nom complet doit contenir au moins 3 caractères alphanumériques.']);
        exit;
    }

    // Validation de l'email (format correct)
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'message' => 'Format d\'email invalide.']);
        exit;
    }

    // Validation du téléphone (format simple : exemple pour un format sénégalais)
    if (!preg_match('/^\+?(\d{12,15})$/', $phone)) {
        echo json_encode(['success' => false, 'message' => 'Le téléphone doit contenir entre 12 et 15 chiffres.']);
        exit;
    }

    // Vérifiez la correspondance des mots de passe
    if ($password !== $confirmPassword) {
        echo json_encode(['success' => false, 'message' => 'Les mots de passe ne correspondent pas.']);
        exit;
    }

    // Vérification que le mot de passe fait au moins 6 caractères
    if (strlen($password) < 6) {
        echo json_encode(['success' => false, 'message' => 'Le mot de passe doit contenir au moins 6 caractères.']);
        exit;
    }

    // Vérifiez si l'email ou le téléphone existe déjà
    $stmt = $db->prepare("SELECT COUNT(*) FROM users WHERE email = :email OR phone = :phone");
    $stmt->execute(['email' => $email, 'phone' => $phone]);
    $exists = $stmt->fetchColumn();

    if ($exists) {
        echo json_encode(['success' => false, 'message' => 'Email ou téléphone déjà utilisé']);
    } else {
        // Hachage du mot de passe
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        // Insertion de l'utilisateur
        $stmt = $db->prepare("INSERT INTO users (fullname, email, phone, password) VALUES (:fullname, :email, :phone, :password)");
        if ($stmt->execute(['fullname' => $fullname, 'email' => $email, 'phone' => $phone, 'password' => $hashedPassword])) {
            $userId = $db->lastInsertId();

            $db->exec("INSERT INTO collection (user_id, collection_title) VALUES ($userId, 'Dìwàn 1')");

            // Récupération des données nécessaires de l'utilisateur depuis la base de données
            $userQuery = $db->prepare("SELECT * FROM users WHERE id = :id");
            $userQuery->execute(['id' => $userId]);
            $user = $userQuery->fetch(PDO::FETCH_ASSOC);

            // Envoi d'e-mail de bienvenue
            send_welcome_mail($app, $user);
            
            // Stockage de toutes les données de l'utilisateur dans la session
            $_SESSION['user']['id'] = $user['id'];
            $_SESSION['user']['fullname'] = $user['fullname'];
            $_SESSION['user']['group_name'] = $user['group_name'];
            $_SESSION['user']['book'] = $user['book'];
            $_SESSION['user']['lang'] = $user['lang'];
            $_SESSION['user']['page'] = $user['page'];
            $_SESSION['user']['last_update'] = $user['last_update'];
            $_SESSION['user']['collection_last_update'] = $user['collection_last_update'];

            echo json_encode(['success' => true, 'user' => $_SESSION['user']]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Erreur lors de l\'inscription']);
        }
    }
} elseif ($action === 'logout') {
    // Déconnexion
    session_destroy();
    echo json_encode(['success' => true]);
    
} elseif ($action === 'forgotPassword'){
    if (isset($_POST['email'])) {
        $email = $_POST['email'];
        
        // Validation de l'email (format correct)
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            echo json_encode(['success' => false, 'message' => 'Entrez une adresse email valide svp.']);
            exit;
        }
        // Récupération de toutes les données de l'utilisateur depuis la base de données
        $userQuery = $db->prepare("SELECT * FROM users WHERE email = :email");
        $userQuery->execute(['email' => $email]);
        $user = $userQuery->fetch(PDO::FETCH_ASSOC);
        if ($user) {
            $activationCode = bin2hex(random_bytes(8)); // Génère un code d'activation de 16 caractères hexadécimaux
            $mailer_response = send_password_mail($app, $user, $activationCode);
            if ($mailer_response) {
                $success_msg = "Nous vous avons envoyé un email de réinitialisation sur votre adresse email.\n Merci de cliquer sur le lien pour réinitialiser votre mot de passe. \nSi vous ne trouvez l'e-mail, veuillez vérifier dans vos SPAM.";
                echo json_encode(['success' => true, 'message' => $success_msg]); 
                // Désactiver le compte et ajouter un code d'activation
                $stmt = $db->prepare("UPDATE users SET state = 0, activation_code = :activation_code WHERE email = :email");
                $result = $stmt->execute([
                    'activation_code' => $activationCode,
                    'email' => $email
                ]);

            } else {
                echo json_encode(['success' => false, 'message' => "Erreur lors de l'envoi de l'email de récupération."]); 
            }
              
        } else {
            echo json_encode(['success' => false, 'message' => 'Vous n\'avez pas encore créer de compte.']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => 'Entrez votre adresse email d\'abord.']);
    }    
    
} elseif ($action === 'resetPassword') {
    $id = $_GET['id'] ?? '';
    $activationCode = $_GET['activation_code'] ?? '';

    if (empty($id) || empty($activationCode)) {
        echo json_encode(['success' => false, 'message' => 'Données manquantes.']);
        exit;
    }

    $stmt = $db->prepare("SELECT * FROM users WHERE id = :id");
    $stmt->execute(['id' => $id]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        exit;
    } elseif ($user['state'] == 0 && $user['activation_code'] === $activationCode) {
        // Code valide, utilisateur en état désactivé
        echo json_encode(['success' => true, 'message' => 'Créez un nouveau mot de passe s\'il vous plaît.']);
    } elseif ($user['state'] == 0 && $user['activation_code'] !== $activationCode) {
        echo json_encode(['success' => false, 'message' => 'Ce lien d\'activation a expiré.']);
    }
    exit;

} elseif ($action === 'updatePassword') {
    $id = $_POST['id'] ?? '';
    $newPassword = $_POST['new_password'] ?? '';

    if (empty($id) || empty($newPassword)) {
        echo json_encode(['success' => false, 'message' => 'Mot de passe invalide.']);
        exit;
    } elseif (strlen($newPassword) < 6) {
        echo json_encode(['success' => false, 'message' => 'Le Mot de passe doit contenir au moins 6 chiffres.']);
        exit;
    }

    $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);

    $stmt = $db->prepare("UPDATE users SET password = :password, state = 1, activation_code = NULL WHERE id = :id");
    $result = $stmt->execute(['password' => $hashedPassword, 'id' => $id]);

    if ($result) {
        echo json_encode(['success' => true, 'message' => 'Mot de passe mis à jour avec succès.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Erreur lors de la mise à jour.']);
    }
    exit;

} elseif ($action === "updateAccount") {
    // Récupérer les données envoyées
    $data = json_decode(file_get_contents('php://input'), true);

    // Validation des données (par exemple, email, téléphone, mot de passe)
    if (!isset($data['fullname'], $data['email'], $data['password'])) {
        echo json_encode(['success' => false, 'message' => 'Les champs `Nom complet`, `Email` et `Mot de passe` doivent être remplis.']);
        exit;
    }

    // Validation du nom complet (au moins 3 caractères alphanumériques)
    if (!preg_match('/^[a-zA-Z0-9 ]{3,}$/', $data['fullname'])) {
        echo json_encode(['success' => false, 'message' => 'Le nom complet doit contenir au moins 3 caractères alphanumériques.']);
        exit;
    }

    // Validation de l'email (format correct)
    if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'message' => 'Format d\'email invalide.']);
        exit;
    }

    // Validation du téléphone (format simple : exemple pour un format français)
    if (!preg_match('/^\+?(\d{10,15})$/', $data['phone'])) {
        echo json_encode(['success' => false, 'message' => 'Le téléphone doit contenir entre 10 et 15 chiffres.']);
        exit;
    }

    // Récupération de l'utilisateur avec l'email ou le téléphone fourni
    $stmt = $db->prepare("SELECT * FROM users WHERE id = :user_id");
    $stmt->execute(['user_id' => $_SESSION['user']['id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // Vérification du mot de passe
    if (!$user || !password_verify($data['password'], $user['password'])) {
        echo json_encode(['success' => false, 'message' => 'Le mot de passe est incorrecte.']);
        exit;
    }

    // Vérification du mot de passe si nécessaire
    if (!empty($data['newPassword']) && strlen($data['newPassword']) < 6) {
        echo json_encode(['success' => false, 'message' => 'Le mot de passe doit comporter au moins 6 caractères.']);
        exit;
    }

    // Vérifiez si l'email ou le téléphone existe déjà
    $stmt = $db->prepare("SELECT COUNT(*) FROM users WHERE id != :user_id AND (email = :email OR phone = :phone)");
    $stmt->execute(['user_id' => $_SESSION['user']['id'], 'email' => $data['email'], 'phone' => $data['phone']]);
    $exists = $stmt->fetchColumn();

    if ($exists && $exists > 0) {
        // Si l'email ou le téléphone existe déjà pour un autre utilisateur
        echo json_encode(['success' => false, 'message' => 'Email ou téléphone déjà utilisé']);
        exit;
    }

    // Mise à jour des informations de l'utilisateur
    $stmt = $db->prepare("UPDATE users SET fullname = :fullname, email = :email, phone = :phone WHERE id = :user_id");
    $stmt->execute([
        'fullname' => $data['fullname'],
        'email' => $data['email'],
        'phone' => $data['phone'],
        'user_id' => $_SESSION['user']['id'],
    ]);

    // Mettre à jour les données de session
    $_SESSION['user']['fullname'] = $data['fullname'];

    if (!empty($data['newPassword'])) {
        $hashedPassword = password_hash($data['newPassword'], PASSWORD_DEFAULT);
        $stmt = $db->prepare("UPDATE users SET password = :password WHERE id = :user_id");
        $stmt->execute([
            'password' => $hashedPassword,
            'user_id' => $_SESSION['user']['id'],
        ]);
    }

    echo json_encode(['success' => true, 'message' => 'Informations mises à jour avec succès.']);
    
} elseif ($action === 'user_infos_get') {
    // Vérifier si le serveur est en ligne
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Vérifier si une session utilisateur est active
        if (isset($_SESSION['user'])) {
            $userId = $_SESSION['user']['id'];
            // Récupération des données nécessaires de l'utilisateur depuis la base de données
            $userQuery = $db->prepare("SELECT * FROM users WHERE id = :id");
            $userQuery->execute(['id' => $userId]);
            $user = $userQuery->fetch(PDO::FETCH_ASSOC);

            echo json_encode(['success' => true, 'user' => $user]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Utilisateur non connecté']);
        }
    } else {
        http_response_code(400); // Mauvaise requête si ce n'est pas une requête GET
        echo json_encode(['success' => false, 'message' => 'Requête invalide']);
    }
}
 elseif ($action === 'session_check') {
    // Vérifier si le serveur est en ligne
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Vérifier si une session utilisateur est active
        if (isset($_SESSION['user'])) {
            echo json_encode(['success' => true, 'user' => $_SESSION['user']]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Utilisateur non connecté']);
        }
    } else {
        http_response_code(400); // Mauvaise requête si ce n'est pas une requête GET
        echo json_encode(['success' => false, 'message' => 'Requête invalide']);
    }
}

else {
    echo json_encode(['success' => false, 'message' => 'Action non reconnue']);
}

?>