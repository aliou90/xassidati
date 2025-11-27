# 📚 Xassidati — Visionneuse de Livres en Images (PWA)

<div align="center">
  <img src="assets/images/screenshots/screenshot2.png" alt="Aperçu de Xassidati" width="600">
  <br><em>Aperçu de la visionneuse Xassidati</em>
</div>

---

Xassidati est une **visionneuse moderne** de livres numériques scannés (images), intégrant la navigation fluide, la recherche, les catégories, le stockage hors-ligne (PWA), les marque-pages et les collections personnalisées pour organiser les livres téléchargés.

Cette version inclut :
✔️ Multi-collections
✔️ Téléchargement via modal et sélection de collection
✔️ Synchronisation IndexedDB ↔ MySQL
✔️ Lecture hors-ligne complète

---

## 🚀 Fonctionnalités principales

### 📖 Visionneuse de livres

* Navigation page par page
* Champ de saisie pour accéder rapidement à une page précise
* Bouton “Retour à la page marquée”

### 📚 Sidebar dynamique

* Liste de tous les livres classés par catégories
* Recherche instantanée
* Filtrage intelligent (titres, translitération, catégories)

### 📥 Lecture hors-ligne (PWA)

* Téléchargement complet du livre dans **IndexedDB**
* Modal de choix/ajout de collection
* Lecture fluide même sans connexion

### 🔖 Marque-pages

* Marque-page persistant et synchronisé en ligne et hors
* Stockage local ou utilisateur connecté

### 🗂️ Collections personnalisées

* Regroupement visuel par collection
* Support dans `refreshDownloadedBooks()`
* Mise à jour ciblée si nécessaire

---

## 🖼️ Captures écran

### 📌 Page de lecture

<div align="center">
  <img src="assets/images/screenshots/screenshot2.png" alt="Lecture d'une page" width="600">
</div>

---

## 🛠️ Technologies utilisées

| Technologie                         | Description                      |
| ----------------------------------- | -------------------------------- |
| **PHP**                             | Backend, API internes            |
| **MySQL / SQLite**                  | Stockage serveur                 |
| **JavaScript**                      | Navigation, recherche, IndexedDB |
| **IndexedDB**                       | Stockage offline des livres      |
| **Bootstrap 5**                     | Interface responsive             |
| **PWA (Service Worker + Manifest)** | Mode hors-ligne                  |
| **Ajax**                            | Chargements dynamiques           |

---

## 📂 Structure du projet

```
Xassidati/
│── assets/
│   ├── books/             # Petit échantillon version GitHub
│   ├── books_sample/      # Gros livres (ignoré par Git)
│   └── images/screenshots/ # Captures pour README
│
│── db/
│   └── xs-db-connect.php
│
│── js/
│   ├── indexeddb.js
│   └── viewer.js
│
│── pages/
│   └── view.php
│
│── index.php
│── service-worker.js
│── manifest.json
│── README.md
```

---

## 🔧 Installation

### 1️⃣ Cloner le projet

```bash
git clone git@github.com:aliou90/xassidati.git
cd xassidati

# Renommer dossier des livres
sudo mv assets/documents/books_sample assets/documents/books
```

### 2️⃣ Configurer la base de données

#### Option A — MySQL (recommandé)
1. Assurez-vous que votre serveur MySQL est en marche 
2. Exécutez ce script pour créer la Base de Données et insérer les tables
```php
php CHEMIN_VERS_DOSSIER_DU_POJET/assets/database/create-mysql-db.php
```
Le script crée automatiquement les tables si elles n’existent pas.

#### Option B — SQLite
- Exécutez ce script pour créer la Base de Données et insérer les tables
```php
php CHEMIN_VERS_DOSSIER_DU_POJET/assets/database/create-sqlite-db.php
```

Le fichier sera créé :

```
assets/database/Xassidati.db
```

---

## 📦 Mode hors-ligne (PWA)

La PWA permet :

* Mise en cache statique (service worker)
* Sauvegarde de tous les livres téléchargés dans IndexedDB
* Ouverture des livres offline
* Synchronisation silencieuse avec le serveur quand une connexion est disponible

Le cœur de la synchronisation :

```js
syncIndexedDBWithServer(userId)
```

---

## 🤝 Contribution

1. Fork
2. Nouvelle branche
3. Commit
4. Pull Request

---

## 👨‍💻 Auteur

**Aliou Mbengue**
Développeur Full-Stack / DevOps
Créateur d’outils et bibliothèques religieuses numériques


