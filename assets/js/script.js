let currentIndex = 0; // Index actuel des images
let totalImages = 0; // Nombre total d'images
let currentGroupAndBookValues = { group : null, book: null, lang: null }; // Valeurs du groupe et du livre actuellement affichés
let bookIsArabic; // Variable de la langue du livre affiché ar/noar
let currentPage;
// Variables de gestion marque-page
const showMarkedPageBtn = document.getElementById('showMarkedPageBtn');
const markPageBtn = document.getElementById('markPageBtn');
const pageInput = document.getElementById('pageInput');
let markedPage;
// Image Affichée par défaut
const defaultPage = "assets/images/covers/pre.png";
const chargingPage = "assets/images/covers/processing.gif";
// Variables des états de connexion (mises à jour chaque 5s avec l'appel de updateComponentsVisibility)
let appConnectedToWebServer;
let userConnectedToServerAccount;
let userConnectedToLocalAccount;
// Token de recherche actuel
let currentSearchToken = 0;

// Vérification et Enregistrement du Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').then(function(registration) {
      console.log('Service Worker enregistré avec succès:', registration);
    }).catch(function(error) {
      console.log('Échec de l\'enregistrement du Service Worker:', error);
    });
}

// Fonction pour afficher un message flottant
function showFloatingMessage(message, type = 'info') {
    const validTypes = ['success', 'info', 'warning', 'danger'];
    const alertClass = validTypes.includes(type) ? `alert alert-${type}` : 'alert alert-info';

    // Définir les émojis selon le type
    const emojis = {
        success: '✅',
        info: 'ℹ️',
        warning: '⚠️',
        danger: '❌'
    };
    const emoji = emojis[type] || emojis['info'];

    const duration = 3000;
    const floatingMessage = document.getElementById('floating-message');

    // Remplacer \n par <br> et ajouter l’émoji au début
    floatingMessage.innerHTML = `${emoji} ${message.replace(/\n/g, '<br>')}`;

    // Supprimer d'anciennes classes alert-* et ajouter la nouvelle
    floatingMessage.className = ''; // reset
    floatingMessage.classList.add(...alertClass.split(' '));

    floatingMessage.style.display = 'block';

    // Forcer une légère pause pour permettre la transition
    setTimeout(() => {
        floatingMessage.classList.add('show');
    }, 10);

    // Cacher après délai
    setTimeout(() => {
        floatingMessage.classList.remove('show');
        setTimeout(() => {
            floatingMessage.style.display = 'none';
        }, 500); // temps de transition
    }, duration);
}

// Variable globale pour stocker l'intervalle actif
let blinkInterval = null;

// Fonction pour montrer la direction de navigation du livre selon la langue
function showNavigationDirectionArrow(bookIsArabic, pageNumber) {
    const container = document.getElementById('nav-direction-container');
    const arrow = document.getElementById('nav-direction-arrow');

    if (!container || !arrow) return;

    // Arrêter l'ancien clignotement s'il y en a un
    if (blinkInterval !== null) {
        clearInterval(blinkInterval);
        blinkInterval = null;
    }

    // Afficher le conteneur
    container.style.display = 'block';

    // Choisir la direction
    if (bookIsArabic === 'ar') {
        arrow.setAttribute("transform", "rotate(0 8 8)");
        document.getElementById("lastPageLbl").innerText = `P.${pageNumber}`;
        document.getElementById("prevPageLbl").innerText = "Suiv";
        document.getElementById("nextPageLbl").innerText = "Préc";
        document.getElementById("firstPageLbl").innerText = "P.1";
    } else {
        arrow.setAttribute("transform", "rotate(180 8 8)");
        document.getElementById("lastPageLbl").innerText = "P.1";
        document.getElementById("prevPageLbl").innerText = "Préc";
        document.getElementById("nextPageLbl").innerText = "Suiv";
        document.getElementById("firstPageLbl").innerText = `P.${pageNumber}`;
    }

    // Démarrer clignotement 7 fois (on/off)
    let count = 0;
    blinkInterval = setInterval(() => {
        arrow.style.opacity = arrow.style.opacity === '0' ? '0.8' : '0';
        count++;
        if (count >= 14) {
            clearInterval(blinkInterval);
            blinkInterval = null;
            container.style.display = 'none';
            arrow.style.opacity = '0.8'; // reset
        }
    }, 500);
}


// Vérification de la session utilisateur et de la connectivité
async function checkUserSession() {
    try {
        // Vérifier si l'utilisateur est en ligne (Internet)
        const isOnline = navigator.onLine;
        appConnectedToWebServer = isOnline ? true : false;
        
        console.log('Connexion réseau:', appConnectedToWebServer ? 'En ligne' : 'Hors ligne');

        if (appConnectedToWebServer) {
            // Si en ligne, vérifier la session
            const response = await fetch('rqt_auth.php?action=session_check', {
                credentials: 'include' // ← Obligatoire pour récupérer la vraie session
            });
            const data = await response.json();
    
            if (data.success && data.user) {
                console.log('Utilisateur connecté.');
                userConnectedToServerAccount = { loggedIn: true, user: data.user }; // Globale
                return { loggedIn: true, user: data.user, source: 'server' };
            } else {
                console.log('Utilisateur déconnecté.');
                userConnectedToServerAccount = { loggedIn: false, user: null }; // Globale
                return { loggedIn: false, user: null, source: 'server' }; 
            }
        } else {
            // Si hors ligne, vérifier la session depuis le cache local
            const cachedSession = localStorage.getItem('userSession');
            if (cachedSession) {
                console.log('Utilisateur connecté.');
                userConnectedToLocalAccount = JSON.parse(cachedSession); // Globale
                return JSON.parse(cachedSession);
            } else {
                console.log('Utilisateur déconnecté.');
                userConnectedToLocalAccount = { loggedIn: false, user: null }; // Globale
                return { loggedIn: false, user: null };
            }
        }
    } catch (error) {
        console.error("Erreur lors de la vérification de la session:", error);
        userConnectedToServerAccount = { loggedIn: false, user: null }; // Globale
        userConnectedToLocalAccount = { loggedIn: false, user: null }; // Globale
        return { loggedIn: false, user: null };
    }
}
// Lancer le premier check Session
checkUserSession();

/**
 * Met à jour le style des éléments .bookItem en fonction de leur état de téléchargement
 * et gère l'affichage des boutons (téléchargement/suppression).
 */
async function refreshDownloadedBookOpacity(groupElement = false) {
    try { 
        const downloadedBooks = await getLocalBooksFromIndexedDB();
        const isOnline = appConnectedToWebServer;

        if (!isOnline) {
            console.error("Hors connexion. Pas de coloration nécessaire. Tous les livres sont des livres téléchargés.");
            highlightSacredNames();
            return;
        }

        const downloadedBookSet = new Set(downloadedBooks.map(({ group, book }) => `${group}:${book}`));
        const allBookItems = groupElement
            ? groupElement.querySelectorAll(".bookItem")
            : document.querySelectorAll('.groupListForAll .bookItem');

        const currentGroup = currentGroupAndBookValues?.group;
        const currentBook = currentGroupAndBookValues?.book;

        const BATCH_SIZE = 50;
        let index = 0;

        function processBatch() {
            const end = Math.min(index + BATCH_SIZE, allBookItems.length);

            for (let i = index; i < end; i++) {
                const bookItem = allBookItems[i];
                const bookLink = bookItem.querySelector('a');
                const group = bookLink.getAttribute('data-group-name').trim();
                const book = bookLink.getAttribute('data-book-name').trim();

                const isDownloaded = downloadedBookSet.has(`${group}:${book}`);
                const isCurrent = (group === currentGroup && book === currentBook);

                const downloadButton = bookItem.querySelector(".bookDownloadButton");
                const deleteButton = bookItem.querySelector(".bookDeleteButton");

                // Appliquer style téléchargé
                if (isDownloaded) {
                    bookItem.style.opacity = "0.9";
                    bookItem.style.backgroundColor = "#d9ffd9";
                    if (deleteButton) deleteButton.style.display = "inline-block";
                    if (downloadButton) downloadButton.style.display = "none";
                    // Ajouter un attribut avec l'id de téléchargement correspondant depuis IndexedDB
                    bookLink.setAttribute('data-content-id', downloadedBooks.find(b => b.group === group && b.book === book)?.id);
                } else {
                    bookItem.style.opacity = "1";
                    bookItem.style.backgroundColor = "white";
                    if (downloadButton && isOnline) downloadButton.style.display = "inline-block";
                    if (deleteButton) deleteButton.style.display = "none";
                    // Supprimer l'attribut data-content-id si le livre n'est pas téléchargé
                    bookLink.removeAttribute('data-content-id');
                }

                // Mettre en évidence le livre en cours
                if (isCurrent) {
                    bookItem.classList.add('active-book-highlight');
                } else {
                    bookItem.classList.remove('active-book-highlight');
                }
            }

            index += BATCH_SIZE;
            if (index < allBookItems.length) {
                requestAnimationFrame(processBatch);
            } else {
                highlightSacredNames();
            }
        }

        requestAnimationFrame(processBatch);
    } catch (error) {
        console.error("Erreur lors de la mise à jour du style des livres téléchargés :", error);
    }
}

// Fonction pour afficher toutes les listes des livres du serveur
function renderBooks(data) {
    const container = document.getElementById("allBooksGroups"); // Vous devez avoir un div#allBooksGroups dans le HTML
    container.innerHTML = '';

    for (const [group, books] of Object.entries(data)) {
        const groupDiv = document.createElement('div');
        groupDiv.className = "list-group-item list-group-item-action groupList groupListForAll p-0 mb-3";
        groupDiv.style.backgroundColor = "#130a4d";
        groupDiv.style.color = "white";

        const header = document.createElement('h6');
        header.className = "bookList-header mb-2 shadow";
        header.textContent = group;
        header.onclick = () => toggleBookList(header);

        const bookList = document.createElement('div');
        bookList.className = "list-group bookList open bg-light";

        books.forEach(book => {
            const config = book.config || {};
            const isArabic = book.isArabic;
            const langName = isArabic ? "ar" : "noar";
            const trans = config.trans || '';
            const type = config.type || '';
            const arabicName = config.nomArabe || '';
            const author = config.Auteur || '';
            const translator = config.traducteur || '';
            const voice = config.voix || '';

            const bookSpan = document.createElement('span');
            bookSpan.className = "list-group-item list-group-item-action bookItem";

            bookSpan.innerHTML = `
                <span class="DownDelBtnGroup">
                    <span class="bookDownloadButton" style="display: none;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="green" class="bi bi-arrow-down-circle" viewBox="0 0 16 16">
                            <path fill-rule="evenodd" d="M1 8a7 7 0 1 0 14 0A7 7 0 0 0 1 8m15 0A8 8 0 1 1 0 8a8 8 0 0 1 16 0M8.5 4.5a.5.5 0 0 0-1 0v5.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293z"/>
                        </svg>
                    </span>
                    <span class="bookDeleteButton" style="display: none;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="red" class="bi bi-x-circle" viewBox="0 0 16 16">
                            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
                            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/>
                        </svg>
                    </span>
                </span>
                <a href="#" class="flex-grow-1 bookLink" 
                   data-group-name="${group}"
                   data-book-name="${book.name}"
                   data-book-arabic-name="${arabicName}"
                   data-book-author="${author}"
                   data-book-translator="${translator}"
                   data-book-voice="${voice}"
                   data-book-lang="${langName}"
                   data-book-trans="${trans}"
                   data-book-type="${type}"
                   style="color: black; text-decoration: none;"
                   onclick="loadImages('${group}', '${book.name}', '${langName}')">
                    <div class="bookName bookNameLatin">${book.name}</div>
                    <div class="bookName bookNameArabic">${arabicName}</div>
                </a>
            `;

            bookList.appendChild(bookSpan);
        });

        groupDiv.appendChild(header);
        groupDiv.appendChild(bookList);
        container.appendChild(groupDiv);

        const separator = document.createElement('div');
        separator.className = "separator";
        container.appendChild(separator);
    }
}

function loadBooksFromServer() {
    fetch('rqt_books_all_get.php')
        .then(response => response.json())
        .then(data => {
            renderBooks(data);
            console.log("Livres chargés avec succès depuis le serveur.");
            refreshDownloadedBookOpacity();
        })
        .catch(error => {
            console.error("Erreur lors du chargement des livres :", error);
        });
}
// Lancer le chargement des livres depuis le serveur
loadBooksFromServer();

// Ouvrir ou créer la base de données IndexedDB
async function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("booksDB", 1);

        request.onupgradeneeded = function (event) {
            const db = event.target.result;
        
            if (!db.objectStoreNames.contains("images")) {
                db.createObjectStore("images");
            }
        
            if (!db.objectStoreNames.contains("metadata")) {
                const metadataStore = db.createObjectStore("metadata", { keyPath: "id", autoIncrement: true });
                metadataStore.createIndex("group_book", ["group", "book"], { unique: false });
            }
        };
        
        request.onerror = function(event) {
            console.error("Erreur lors de l'ouverture de IndexedDB:", event);
            // Ne rejette pas la promesse, mais retourne null ou un objet de secours
            resolve(null); // ou resolve({}) si tu préfères retourner un objet vide
        };

        request.onsuccess = function(event) {
            resolve(event.target.result);
        };
    });
}

async function getAllMetadata() {
    // Ouvrir IndexedDB
    const db = await openIndexedDB();

    // Vérification si IndexedDB n'est pas ouvert ou si db est invalide
    if (!db) {
        console.error("Impossible d'ouvrir la base de données IndexedDB.");
        return []; // Retourne un tableau vide si l'ouverture échoue
    }

    // Création de la transaction et du store
    const transaction = db.transaction(["metadata"], "readonly");
    const store = transaction.objectStore("metadata");

    // Retourner une promesse pour récupérer les données
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result || []);
        
        request.onerror = () => reject("Erreur lors de la récupération des métadonnées.");
    });
}

// Fonction pour récupérer les URLs des images d'un livre depuis le serveur
async function getBookImagesUrls(group, book) {
    const bookPath = `assets/documents/books/${group}/${book}/images/`;
    console.log("Chemin du répertoire pour le livre:", bookPath);

    const encodedPath = encodeURIComponent(bookPath); // Encodage du path
    console.log("Chemin encodé pour la requête:", encodedPath);

    // Vérifier la connexion au serveur
    const isOnline = appConnectedToWebServer;

    if (isOnline) {
        try {
            const imageUrls = await fetch(`rqt_book_download.php?path=${encodedPath}`)
                .then(res => res.json());
            return Array.isArray(imageUrls) ? imageUrls : [];
        } catch (err) {
            console.error("Erreur de récupération des images:", err);
                
        }
    } else {
        console.warn("Hors ligne, impossible de récupérer les images du livre depuis le serveur.");
        return [];
    }
}

// Fonction pour stocker les images d'un livre sur indexedDB ou synchroniser depuis serveur
async function storeBookImagesInIndexedDB(group, book, metaId = null, collectionId = null, collectionTitle = null, position = null) {
    const db = await openIndexedDB();
    if (!db) {
        console.error("Impossible d'ouvrir la base de données IndexedDB.");
        return null;
    } else {
        console.log("Base de données IndexedDB ouverte avec succès.");
    }
    
    // Récupérer les images du livre depuis le serveur
    const imageUrls = await getBookImagesUrls(group, book);

    if (imageUrls.length === 0) {
        console.error("Aucune image trouvée pour le livre:", book);
        return;
    }

    console.log("Images reçues:", imageUrls);

    let allImagesStored = true;

    for (let imageUrl of imageUrls) {
        const existingImage = await checkImageInIndexedDB(imageUrl);
        if (existingImage) {
            console.log(`Image déjà stockée, sautée: ${imageUrl}`);
            continue;
        }

        try {
            const decodedImageUrl = decodeURIComponent(imageUrl);
            const response = await fetch(decodedImageUrl);
            if (response.ok) {
                const blob = await response.blob();
                const transaction = db.transaction(["images"], "readwrite");
                const store = transaction.objectStore("images");
                store.put(blob, imageUrl);
                console.log(`Image ajoutée à IndexedDB: ${imageUrl}`);
            } else {
                console.warn(`Erreur de téléchargement pour l'image: ${imageUrl}`);
                allImagesStored = false;
            }
        } catch (error) {
            console.error(`Erreur lors de la requête pour ${imageUrl}:`, error);
            allImagesStored = false;
        }
    }

    if (allImagesStored) {
        const allMetadata = await getAllMetadata();

        if (!position) {
            // Si aucune position n'est fournie, on calcule la position maximale pour un nouveau livre
            const maxPosition = allMetadata.reduce((max, item) => Math.max(max, item.position || 0), 0); 
            position = maxPosition + 1;           
        }

        const { arabicName, author, translator, voice, lang, trans, type } = await getBookInfos(group, book);

        const metadata = {
            collection_id: collectionId || 1, // Par défaut 1 si non fourni
            collection_title: collectionTitle || "Dìwàn 1", // Par défaut "Dìwàn 1" si non fourni
            group: group,
            book: book,
            arabicName,
            author,
            translator,
            voice,
            lang,
            trans,
            type,
            position,
        };

        // Ajout de l'id si fourni
        if (metaId !== null) {
            metadata.id = metaId;
        }

        const metadataTransaction = db.transaction(["metadata"], "readwrite");
        const metadataStore = metadataTransaction.objectStore("metadata");

        // Retourner une promesse (id et position ou null si échec)
        return new Promise((resolve, reject) => {
            const request = metadataStore.put(metadata); // Remplace ou ajoute
            request.onsuccess = (event) => {
                const insertedId = event.target.result;
                console.log("Métadonnées stockées avec ID :", insertedId, metadata);
                resolve({
                    id: insertedId,
                    position: position
                });
            };
            request.onerror = (event) => {
                console.error("Erreur lors de l'ajout des métadonnées :", event.target.error);
                reject(null);
            };
        });        
    } else {
        console.warn("Certaines images n'ont pas pu être téléchargées.");
        return null;
    }
}

// Mise à jour des images des livres téléchargés sur l'indexedDb
// Fonction pour mettre à jour les images des livres locaux depuis le serveur
async function updateBookImagesInIndexedDb() {
    const localBooks = await getLocalBooksFromIndexedDB();

    if (localBooks.length === 0) {
        console.log("Aucun livre local trouvé pour la mise à jour des images.");
        return;
    }

    console.log(`Mise à jour des images pour ${localBooks.length} livres locaux.`);

    for (const localBook of localBooks) {
        const { group, book, id, collection_id, collection_title, position } = localBook;

        console.log(`Vérification des images pour le livre ${group}/${book}...`);

        // Réutilise ta fonction d’ajout intelligente
        const result = await storeBookImagesInIndexedDB(group, book, id, collection_id, collection_title, position);

        if (result) {
            console.log(`Images du livre ${group}/${book} mises à jour.`);
        } else {
            console.warn(`Échec de mise à jour des images pour ${group}/${book}.`);
        }
    }
}

// Supprime un livre dans IndexedDB et retourne un état à interpréter à l'extérieur
async function deleteBookImagesFromIndexedDB(group, book, id = null, collectionId = null) {
    const db = await openIndexedDB();
    if (!db) {
        console.error("Impossible d'ouvrir la base de données IndexedDB.");
        return { status: "error", message: "Échec ouverture base IndexedDB." };
    }

    const deleteById = (id) => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(["metadata"], "readwrite");
            const store = transaction.objectStore("metadata");
            const request = store.delete(Number(id));

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject("Erreur lors de la suppression par ID.");
        });
    };

    const deleteOneMetadataWithMaxPosition = () => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(["metadata"], "readwrite");
            const store = transaction.objectStore("metadata");
            const index = store.index("group_book");
            const keyRange = IDBKeyRange.only([group, book]);
            const request = index.openCursor(keyRange);

            let maxPosition = -1;
            let maxPrimaryKey = null;

            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    const data = cursor.value;
                    if (typeof data.position === 'number' && data.position > maxPosition) {
                        maxPosition = data.position;
                        maxPrimaryKey = cursor.primaryKey;
                    }
                    cursor.continue();
                } else {
                    if (maxPrimaryKey !== null) {
                        const deleteRequest = store.delete(maxPrimaryKey);
                        deleteRequest.onsuccess = () => resolve(true);
                        deleteRequest.onerror = () => reject("Erreur lors de la suppression.");
                    } else {
                        resolve(false);
                    }
                }
            };

            request.onerror = () => reject("Erreur lors de la recherche.");
        });
    };

    const checkRemainingMetadata = () => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(["metadata"], "readonly");
            const store = transaction.objectStore("metadata");
            const index = store.index("group_book");

            const keyRange = IDBKeyRange.only([group, book]);
            const request = index.openCursor(keyRange);
            let count = 0;

            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    count++;
                    cursor.continue();
                } else {
                    resolve(count);
                }
            };

            request.onerror = () => reject("Erreur lors du comptage.");
        });
    };

    const deleteImages = () => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(["images"], "readwrite");
            const store = transaction.objectStore("images");
            const request = store.openCursor();
            let deletedCount = 0;

            request.onsuccess = event => {
                const cursor = event.target.result;
                if (cursor) {
                    const decodedPath = decodeURIComponent(cursor.key);
                    const [storedGroup, storedBook] = extractGroupAndBookFromPath(decodedPath);
                    if (storedGroup === group && storedBook === book) {
                        store.delete(cursor.key);
                        deletedCount++;
                    }
                    cursor.continue();
                } else {
                    resolve(deletedCount);
                }
            };

            request.onerror = () => reject("Erreur lors de la suppression des images.");
        });
    };

    // 🔄 Traitement principal
    try {
        let deletedMeta = id !== null 
            ? await deleteById(id)
            : await deleteOneMetadataWithMaxPosition();

        if (!deletedMeta) {
            return {
                status: "not_found",
                message: `Le livre "${book}" n'est pas dans votre collection.`
            };
        } else {
            // Supprimer le livre de la liste affichée
            await removeBookFromDisplay(id);
        }

        const remainingCount = await checkRemainingMetadata();

        if (remainingCount === 0) {
            const deletedImages = await deleteImages();
            return {
                status: "all_deleted",
                message: `Le livre "${book}" a été supprimé avec succès.`
            };
        } else {
            return {
                status: "partial_deleted",
                message: `1 exemplaire supprimé de "${book}". ${remainingCount} restant(s).`
            };
        }

    } catch (err) {
        console.error("Erreur lors de la suppression :", err);
        return {
            status: "error",
            message: `Erreur lors de la suppression de "${book}".`
        };
    }
}

// Fonction pour extraire le groupe et le livre d'un chemin décodé
function extractGroupAndBookFromPath(path) {
    const regex = /assets\/documents\/books\/([^\/]+)\/([^\/]+)\//;
    const match = path.match(regex);
    return match ? [match[1], match[2]] : [null, null];
}

// Vérifier si l'image existe déjà dans IndexedDB
async function checkImageInIndexedDB(imageUrl) {
    // Ouvrir IndexedDB
    const db = await openIndexedDB();
    if (!db) {
        console.error("Impossible d'ouvrir la base de données IndexedDB.");
        return null;  // Retourner null si la base de données n'est pas ouverte
    }
    
    // Ouvrir une transaction en lecture seule sur le store "images"
    const transaction = db.transaction(["images"], "readonly");
    const store = transaction.objectStore("images");

    return new Promise((resolve, reject) => {
        const request = store.get(imageUrl);
        request.onsuccess = function(event) {
            resolve(event.target.result);  // Si l'image est trouvée, la retourner
        };
        request.onerror = function(event) {
            console.error("Erreur lors de la recherche de l'image dans IndexedDB.", event);
            resolve(null);  // Si une erreur se produit, retourner null
        };
    });
}

// Fonction pour supprimer IndexedDB
async function deleteIndexedDB() {
    return new Promise((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase("booksDB");

        deleteRequest.onerror = function(event) {
            console.error("Erreur lors de la suppression d'IndexedDB :", event.target.error);
            reject("Erreur lors de la suppression d'IndexedDB");
        };

        deleteRequest.onsuccess = function(event) {
            console.log("IndexedDB supprimée avec succès.");
            resolve();
        };
    });
}

// Afficher/Cacher une liste de livres
async function toggleBookList(toggleButton) {
    const groupElement = toggleButton.closest('.groupList');
    const bookList = groupElement.querySelector('.bookList');

    // Toggle la classe 'open' pour déclencher la transition
    const isOpen = bookList.classList.contains('open');

    if (isOpen) {
        bookList.classList.remove('open');
    } else {
        bookList.classList.add('open');
    }

    // Rafraîchir l'opacité ou les livres selon le groupe
    if (groupElement.classList.contains('groupListForAll')) {
        await refreshDownloadedBookOpacity(groupElement);
    }

    if (groupElement.classList.contains('groupListForUser')) {
        const collectionId = groupElement.getAttribute('data-collection-id')?.trim() || null;
        await refreshDownloadedBooks(collectionId);
    }
}

// Fonction pour activer/désactiver les boutons et la navigation au clavier
function toggleButtons(disable) {
    // Désactiver/Activer les boutons de navigation
    document.getElementById('prevBtn').disabled = disable;
    document.getElementById('nextBtn').disabled = disable;
    document.getElementById('prevPageBtn').disabled = disable;
    document.getElementById('nextPageBtn').disabled = disable;

    // Désactiver/Activer la navigation par les touches fléchées
    if (disable) {
        // Retirer les écouteurs d'événements pour les flèches du clavier
        document.removeEventListener('keydown', handleArrowNavigation);
    } else {
        // Ajouter les écouteurs d'événements pour les flèches du clavier
        document.addEventListener('keydown', handleArrowNavigation);
    }
}

// Fonction pour ouvrir/fermer barre latérale
function setSidebarState(state) {
    const sidebar = document.getElementById('sidebar');
    const isOpen = !sidebar.classList.contains('toggled');
    const menuHeaders = document.querySelectorAll('.menu-header');

    if (state === 'open' && !isOpen) {
        sidebar.classList.remove('toggled');
        menuHeaders.forEach(header => header.classList.add('open'));
    } else if (state === 'close' && isOpen) {
        sidebar.classList.add('toggled');
        menuHeaders.forEach(header => header.classList.remove('open'));
    }
}

/* Script pour basculer la barre latérale - Appelée directement sur le html*/
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('toggled');

    const menuHeaders = document.querySelectorAll('.menu-header');

    menuHeaders.forEach(header => {
        header.classList.toggle('open');
    });
}

// Fonction pour afficher le livre sélectionné dans la sidebar
function showDisplayedBookOnSidebar() {
    const metaBookGroup = document.getElementById('meta-book-group').innerText.trim();
    const metaBookName = document.getElementById('meta-book-name').innerText.trim();

    // Si les deux sont vides, ne rien faire
    if (metaBookGroup === '' && metaBookName === '') return;

    // Identifiants des tabs
    const booksTabBtn = document.getElementById('allbooks-tab');
    const booksTabPane = document.getElementById('allBooksGroups');

    const collectionsTabBtn = document.getElementById('downloaded-tab');
    const collectionsTabPane = document.getElementById('downloadedBooksGroup');

    // Si c'est une *collection* (au moins un des deux est vide)
    if (metaBookGroup === '' || metaBookName === '') {
        // Ouvrir l'onglet des collections téléchargées
        collectionsTabBtn.click();

        // Attendre le rendu (au cas où il y a un rechargement async)
        setTimeout(() => {
            const targetDiv = collectionsTabPane.querySelector(`div[data-collection-title="${metaBookName}"]`);
            if (targetDiv) {
                targetDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetDiv.classList.add('bg-highlight');
                setTimeout(() => targetDiv.classList.remove('bg-highlight'), 2000);
            }
        }, 200);
    } else {
        // C'est un livre, on ouvre le tab des livres
        booksTabBtn.click();

        // Attendre le rendu (au cas où il y a un rechargement async)
        setTimeout(() => {
            const bookLinks = booksTabPane.querySelectorAll('a[data-book-name][data-group-name]');
            for (const link of bookLinks) {
                const bookName = link.getAttribute('data-book-name').trim();
                const bookGroup = link.getAttribute('data-group-name').trim();

                if (bookName === metaBookName && bookGroup === metaBookGroup) {
                    link.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    link.classList.add('bg-highlight');
                    setTimeout(() => link.classList.remove('bg-highlight'), 2000);
                    break;
                }
            }
        }, 200);
    }
}

// Fonction pour ouvrir la barre latérale
function openSidebar() {
    const sidebar = document.getElementById('sidebar');

    if (sidebar.classList.contains('toggled')) {
        toggleSidebar(); // Ouvre la barre latérale si elle est fermée
    }
}

// Fonction pour fermer la barre latérale
function closeSidebar() {
    const sidebar = document.getElementById('sidebar');

    if (!sidebar.classList.contains('toggled')) {
        toggleSidebar(); // Ferme la barre latérale si elle est ouverte
    }
}

// Fermer la barre latérale si l'utilisateur clique en dehors
document.getElementById('content-section').addEventListener('click', function (e) {
    if (!document.getElementById('metaBookLink').contains(e.target)) {
        closeSidebar();
    }
});

// Ouvrir la barre latérale si l'utilisateur clique sur le contenu metadata
document.getElementById('metaBookLink').addEventListener('click', function () {
    openSidebar();
    showDisplayedBookOnSidebar(); // Afficher le livre sélectionné dans la sidebar
});

// Empêcher la propagation du clic sur la sidebar pour éviter de fermer le contenu
document.getElementById('sidebar').addEventListener('click', function (e) {
    e.stopPropagation(); // Ne pas propager le clic vers #content-section
});

// Fermer la sidebar si clic sur le footer
document.querySelector('footer').addEventListener('click', function () {
    closeSidebar();
});

/**
 * POSITIONNEMENT AUTO DU TEXT RTL/LTR - CHAMP DE RECHERCHE
 */
function adjustSearchDirection(input) {
    const text = input.value.trim();
    // Détection très simple : si le texte commence par un caractère arabe, on passe en RTL
    const isArabic = /^[\u0600-\u06FF]/.test(text);
    input.style.direction = isArabic ? 'rtl' : 'ltr';
    input.style.textAlign = isArabic ? 'right' : 'left';
    if (text === '') {
        input.style.direction = 'rtl';
        input.style.textAlign = 'right';
    }
}

// Fonction pour traiter les livres d'un groupe
async function processGroupBooks(group, filter, foundBooks, token) {
    if (token !== currentSearchToken) return false; // Cette recherche est dépassée
    
    const bookItems = group.querySelectorAll('.bookItem');
    const tempItems = [];
    let hasFoundBooks = false;

    for (const bookItem of bookItems) {
        const groupNameElement = bookItem.querySelector('a[data-group-name]');
        const groupName = groupNameElement?.getAttribute('data-group-name')?.trim();
        const bookName = groupNameElement?.getAttribute('data-book-name')?.trim();
        const bookNameArabic = groupNameElement?.getAttribute('data-book-arabic-name')?.trim();
        const bookLang = groupNameElement?.getAttribute('data-book-lang')?.trim();

        const filterText = normalizeText(filter);
        const normalizsedBookName = normalizeText(bookName);
        const normalizedBookNameArabic = normalizeText(bookNameArabic);
        const nameMatch = normalizsedBookName?.includes(filterText);
        const arabicMatch = normalizedBookNameArabic?.includes(filterText);

        if (nameMatch || arabicMatch) {
            const foundBookItem = await createBookItem(groupName, bookName, bookLang);
            tempItems.push(foundBookItem);
            hasFoundBooks = true;
        }
    }

    // Vérifie encore une fois le token avant de modifier le DOM
    if (token !== currentSearchToken) return false;
    
    // Ajouter les éléments seulement après tous les traitements
    for (const item of tempItems) {
        foundBooks.appendChild(item);
    }

    return hasFoundBooks;
}

/**
 * Filtrer les livres par nom et afficher les résultats dans une zone dédiée.
*/
async function cherchBooks(formInput) {
    const token = ++currentSearchToken; // Génère un nouveau token
    adjustSearchDirection(formInput); // Ajuster direction du texte
    
    const input = document.getElementById('cherchBook');
    const filter = input.value.toLowerCase(); // Texte de recherche en minuscule
    const bookList = document.getElementById('all-books'); // Liste complète des livres
    const foundBooks = document.getElementById('found-books'); // Zone des livres trouvés

    if (filter === '') {
        // Si le champ de recherche est vide
        foundBooks.innerHTML = ''; // Réinitialiser la zone des livres trouvés
        foundBooks.style.display = 'none';
        bookList.style.display = 'block';
        console.log('Aucune recherche !');
        return;
    }

    const isOnline = appConnectedToWebServer; // Connexion au serveur
    const localSession = JSON.parse(localStorage.getItem('userSession') || '{}'); //Session Local
    let serverBooksGroups, downloadedBooksGroup;
    if (isOnline) {
        serverBooksGroups = bookList.getElementsByClassName('groupListForAll'); // Groupes dans la liste
    } else if (localSession?.user) {
        downloadedBooksGroup = bookList.getElementsByClassName('groupListForUser')[0]; // Premier groupe
    }
            
    // Réinitialiser la zone des livres trouvés
    foundBooks.innerHTML = '';
    foundBooks.style.display = 'none';

    // Masquer la liste des groupes par défaut
    // bookList.style.display = 'none';

    // Variable pour vérifier si des livres ont été trouvés
    let hasFoundBooks = false;

    // Parcourir les groupes ou traiter un seul groupe
    if (serverBooksGroups) {
        for (const group of serverBooksGroups) {
            const foundInGroup = await processGroupBooks(group, filter, foundBooks, token);
            if (foundInGroup) {
                hasFoundBooks = true;
            }
        }
    } else if (downloadedBooksGroup) {
        hasFoundBooks = await processGroupBooks(downloadedBooksGroup, filter, foundBooks, token);
    } else {
        return;
    }

    if (token !== currentSearchToken) return; // Cette recherche est dépassée
    
    // Gérer l'affichage en fonction des résultats
    if (hasFoundBooks) {
        // Si des résultats ont été trouvés
        bookList.style.display = 'none'; // Masquer la liste complète des livres
        foundBooks.style.height =  'calc(100vh - 180px)'; // Largeur prévenu pour éventuel scroll 
        foundBooks.style.display = 'block'; // Afficher la zone des livres trouvés
        console.log('Résultat(s) affiché(s) !');

        // Attendre que le DOM finisse les insertions
        await new Promise(resolve => requestAnimationFrame(resolve));

        await highlightSerchedWord(filter, token); // Mettre en évidence les mots recherchés

    } else {
        // Si aucun résultat trouvé
        bookList.style.display = 'block';
        
        notResultsFound = document.createElement('div');
        notResultsFound.innerHTML = `<p class="alert alert-warning text-center">Aucun résultat trouvé pour «${filter}»</p>`;
        foundBooks.style.height =  'auto'; // Pas de srcoll donc largeur suffisant 
        foundBooks.appendChild(notResultsFound);
        foundBooks.style.display = 'block'; // Afficher la zone des livres trouvés
        console.log('Aucun résultat ;)');
    }
}

// Fonction pour mettre en évidence les mots recherchés dans les livres
async function highlightSerchedWord(searchedWord, token) {
    const bookNames = Array.from(document.querySelectorAll('#found-books .bookName'));

    const BATCH_SIZE = 30;
    let index = 0;

    async function processBatch() {
        const end = Math.min(index + BATCH_SIZE, bookNames.length);

        for (let i = index; i < end; i++) {
            const el = bookNames[i];

            // Vérifie encore une fois le token avant de modifier le DOM
            if (token !== currentSearchToken) return false;

            // Mise en évidence des noms sacrés
            await highlightElementSacredNames(el); // nouvelle version optimisée

            // Mise en évidence du mot recherché
            const normalizedText = await normalizeText(el.textContent);
            const normalizedSearch = await normalizeText(searchedWord);

            const matches = (normalizedText.match(new RegExp(normalizedSearch, 'gi')) || []).length;
            if (matches > 0) {
                const highlightedHTML = await highlightSearchedWordProperly(el.innerHTML, normalizedSearch);
                el.innerHTML = highlightedHTML;
                el.closest('.bookItem').style.display = 'flex';

                // 👇 Ajoute cette ligne pour appliquer la logique d'opacité sur chaque résultat trouvé
                refreshSearchedElementOpacity(el.closest('.bookItem'));
            }
        }

        index += BATCH_SIZE;
        if (index < bookNames.length) {
            requestIdleCallback(processBatch); // ou requestAnimationFrame(processBatch)
        }
    }

    requestIdleCallback(processBatch);
} 

// échappement de caractères spéciaux
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}  

// Mettre en évidence proprement le mot recherché sans toucher au html ni détruire les dernières mises en évidence
// Mise en évidence du mot recherché sans casser le HTML ni les précédentes balises
async function highlightSearchedWordProperly(html, word) {
    let safeWord = escapeRegExp(word);
    let normalizedSearch = normalizeText(word);

    // Crée un élément temporaire pour manipuler le HTML
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null, false);
    let node;

    while ((node = walker.nextNode())) {
        if (!node.nodeValue.trim()) continue;

        const originalText = node.nodeValue;
        const normalizedText = normalizeText(originalText);

        let startIndex = normalizedText.indexOf(normalizedSearch);
        if (startIndex === -1) continue;

        // Trouver la position exacte dans le texte d'origine correspondant à la recherche normalisée
        let matchLength = word.length;
        let charMap = [];
        let normalizedCursor = 0;

        for (let i = 0; i < originalText.length; i++) {
            const c = originalText[i];
            const normalizedChar = normalizeText(c);
            if (normalizedChar.length > 0) {
                charMap.push(i);
                normalizedCursor++;
            }
        }

        // Si le match commence trop près de la fin pour contenir tous les caractères, on ignore
        if (startIndex + matchLength > charMap.length) continue;

        const realStart = charMap[startIndex];
        const realEnd = charMap[startIndex + matchLength - 1] + 1;

        const before = originalText.slice(0, realStart);
        const match = originalText.slice(realStart, realEnd);
        const after = originalText.slice(realEnd);

        // Ne pas doubler la mise en évidence
        if (node.parentNode.closest('.highlight')) continue;

        const span = document.createElement('span');
        span.className = 'highlight';
        span.textContent = match;

        const fragment = document.createDocumentFragment();
        if (before) fragment.appendChild(document.createTextNode(before));
        fragment.appendChild(span);
        if (after) fragment.appendChild(document.createTextNode(after));

        node.replaceWith(fragment);
    }

    return tempDiv.innerHTML;
}

// Mise en évidence des noms sacrés
// Fonction utilitaire pour normaliser un mot (supprime harakats et accents)
function normalizeText(text) {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Accents latins
        .replace(/[\u064B-\u065F]/g, "") // Harakats arabes
        .replace(/[^\w\u0600-\u06FF]/g, "") // Supprime ponctuations sauf lettres arabes
        .toLowerCase()
        .trim();
}

// Fonction pour mettre en évidence les noms sacrés dans le texte
async function highlightElementSacredNames(el) {
    const text = el.textContent;

    // Divise le texte en mots en gardant la ponctuation
    const words = text.split(/(\s+|[.,;!?()])/); // garde séparateurs

    // Reconstruit le texte avec mise en évidence
    const highlightedTextParts = await Promise.all(words.map(async word => {
        const normalized = await normalizeText(word);

        if (normalized === "الله" || normalized === "allah" || normalized === "allahu" || normalized === "بالله" || normalized === "والله" || normalized === "بالله" || normalized === "تالله" || normalized === "تالله" || normalized === "والله" || normalized === "بالله" || normalized === "لله") {  
            return `<span style="color:red; font-weight:bold">${word}</span>`;
        }

        const nomsProphete = [
            "محمد", "mouhammad", "mouhammadun", "mouhammadoun", "mouhammadan", "mouhammadin",
            "muhammadu", "muhammadan", "muhammadin", "muhammadun", "mouhamad", "mahomet", "mohammed",
            "mohamed", "mohammad", "muhammad", "muhamad"
        ];

        if (nomsProphete.includes(normalized)) {
            return `<span style="color:blue; font-weight:bold">${word}</span>`;
        }

        if (["خديم", "khadim", "khadimi", "khadimu", "khadimou", "xadim", "الخديم"].includes(normalized)) {
            return `<span style="color:green; font-weight:bold">${word}</span>`;
        }

        return word;
    }));

    el.innerHTML = highlightedTextParts.join('');
}

// Fonction pour mettre à jour l'opacité des éléments de recherche successivement
async function refreshSearchedElementOpacity(bookItem = null) {
    try {
        const downloadedBooks = await getLocalBooksFromIndexedDB();
        const isOnline = appConnectedToWebServer;
        const foundBooksContainer = document.getElementById('found-books');

        if (!isOnline || !foundBooksContainer) {
            console.warn("Hors connexion ou conteneur introuvable");
            return;
        }

        const downloadedBookSet = new Set(
            downloadedBooks.map(({ group, book }) => `${group}:${book}`)
        );
        const currentGroup = currentGroupAndBookValues?.group;
        const currentBook = currentGroupAndBookValues?.book;

        // Fonction de traitement d’un seul élément
        const processBookItem = (item) => {
            const bookLink = item.querySelector('a');
            if (!bookLink) return;

            const group = bookLink.getAttribute('data-group-name')?.trim();
            const book = bookLink.getAttribute('data-book-name')?.trim();

            const isDownloaded = downloadedBookSet.has(`${group}:${book}`);
            const isCurrent = (group === currentGroup && book === currentBook);

            const downloadButton = item.querySelector(".bookDownloadButton");
            const deleteButton = item.querySelector(".bookDeleteButton");

            if (isDownloaded) {
                item.style.opacity = "0.9";
                item.style.backgroundColor = "#d9ffd9";
                if (deleteButton) deleteButton.style.display = "inline-block";
                if (downloadButton) downloadButton.style.display = "none";
                bookLink.setAttribute('data-content-id', downloadedBooks.find(b => b.group === group && b.book === book)?.id);
            } else {
                item.style.opacity = "1";
                item.style.backgroundColor = "white";
                if (downloadButton && isOnline) downloadButton.style.display = "inline-block";
                if (deleteButton) deleteButton.style.display = "none";
                bookLink.removeAttribute('data-content-id');
            }

            if (isCurrent) {
                item.classList.add('active-book-highlight');
            } else {
                item.classList.remove('active-book-highlight');
            }
        };

        // Si un élément est fourni, on le traite seul
        if (bookItem) {
            processBookItem(bookItem);
        } else {
            // Sinon on traite tous les .bookItem du conteneur
            const allItems = foundBooksContainer.querySelectorAll('.bookItem');
            allItems.forEach(processBookItem);
        }

    } catch (error) {
        console.error("Erreur dans refreshSearchedElementOpacity :", error);
    }
}

// FONCTION DE VÉRIFICATION DE TEXTE ARABE POUR LA FONCTION EN DESSUS
function isArabic(str) {
    var arabicLetters = /[\u0600-\u06FF]/;
    return arabicLetters.test(str);
}

// Réinitialiser le carousel en attendant l'affichage
function resetCarousel() {
    const carouselElement = document.getElementById('images-container');
    const carouselInner = document.getElementById('carousel-inner');
    
    carouselElement.classList.remove('slide'); // Désactiver temporairement le carrousel pour éviter les animations conflictuelles
    // Image par défaut - // Pour la supprimer => carouselInner.innerHTML = ""
    carouselInner.innerHTML = `<img src="${chargingPage}" alt="Livre en images" style="width: 100%; object-fit: contain; border-radius: 20px;">`;
    currentIndex = 0; // Réinitialiser l'index
    totalImages = 0;  // Réinitialiser le nombre total d'images
    
    // Cacher la barre de Navigation 
    showFullPageNavigation(false);

    // Effacer les dernières metadatas du livre précédemment affiché
    document.getElementById('metaBookSection').style.display = 'none'; // Cacher le lien vers le livre
    document.getElementById('meta-book-group').innerText = '';
    document.getElementById('meta-book-name').innerText = '';
    document.getElementById('meta-book-arabic-name').innerText = '';

    // Réactiver le carrousel après avoir réinitialisé
    setTimeout(() => {
        carouselElement.classList.add('slide');
    }, 10); // Ajouter un délai pour permettre à l'état de se réinitialiser correctement
}

// Fonction pour basculer l'affichage de la barre de navigation
function showFullPageNavigation(show) { 
    const pageNavigationForm = document.getElementById("pageNavigationForm");
    const showMarkedPageBtn = document.getElementById("showMarkedPageBtn");
    const LabelGroupIds = [
        "firstPageLbl",
        "prevPageLbl",
        "markPageLbl",
        "pageInputGrpLbl",
        // "showMarkedPageLbl",
        "nextPageLbl",
        "lastPageLbl",
        "toggle-orientation" // Icône d'orientation portrait/paysage
    ];

    if (show) {
        // Afficher tous les éléments
        pageNavigationForm.querySelectorAll('svg').forEach(button => {
            button.style.display = 'inline-block';
        });

        document.getElementById("pageInputGroup").style.display = 'inline-block';
        document.getElementById("goToPageBtn").style.display = 'inline-block';
        pageNavigationForm.style.display = 'flex';
    } else {
        // Masquer tous les éléments sauf le bouton 'showMarkedPageBtn'
        pageNavigationForm.querySelectorAll('svg').forEach(button => {
            if (button !== showMarkedPageBtn) {
                button.style.display = 'none';
            }
        });
        document.getElementById("pageInputGroup").style.display = 'none';
        document.getElementById("goToPageBtn").style.display = 'none';
        pageNavigationForm.style.display = 'flex';
    }

    // Afficher/Masquer les labels des boutons
    LabelGroupIds.forEach(id => {
        const group = document.getElementById(id);
        if (group) {
            group.style.display = show ? "block" : "none";
        }
    });
}

// Avant le rechargement de la page (avant que l'utilisateur actualise ou quitte)
window.addEventListener("beforeunload", function(event) {
    // Sauvegarder les infos de la dernière page lues sur le sessionStorage
    saveStateIfValid(currentGroupAndBookValues?.group, currentGroupAndBookValues?.book, currentGroupAndBookValues?.lang, currentPage);   
});

// Fonction pour sauvegarder l'état si les 4 variables sont valides
function saveStateIfValid(group, book, lang, page) {
    // Vérifier si les variables ont des valeurs valides avant de les sauvegarder
    if (group && book && lang && page) {
        const state = { group, book, lang, page };
        sessionStorage.setItem("currentPageState", JSON.stringify(state));  // Sauvegarde dans sessionStorage
        console.log("État sauvegardé dans sessionStorage");
    } else {
        // Supprimer l'état si les valeurs sont invalides
        sessionStorage.removeItem("currentPageState");
        console.log("État supprimé, données invalides ou inexistantes.");
    }
}

// Afficher la page principale
function showMainPage() {
    // Réinitialiser le carrousel et masquer la navigation
    resetCarousel();
    showFullPageNavigation(false);

    // Réafficher l'image par défaut sur le carousel
    const carouselInner = document.getElementById('carousel-inner');
    carouselInner.innerHTML = ''; // Vider le contenu précédent, le cas échéant    
    carouselInner.innerHTML = `<img src="${defaultPage}" alt="Livre en images" style="width: 100%; object-fit: contain; border-radius: 20px;">`;    

    // Réinitialiser la mise en opacité des livres téléchargés
    refreshDownloadedBookOpacity(); // Réinitialiser l'opacité des livres téléchargés
    refreshSearchedElementOpacity(); // Réinitialiser l'opacité des éléments de recherche

    // Réinitialiser les valeurs globales
    currentGroupAndBookValues = { group: null, book: null, lang: null };
    currentPage = null; // Réinitialiser la page actuelle
    
    bookIsArabic = 'noar'; // Réinitialiser la langue du livre

    // Défiller vers le haut de la page
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Remonter vers le haut de la page
function scrollToTop() {
    // Défiller vers le haut de la page
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Au chargement de la page
document.addEventListener("DOMContentLoaded", async function () {
    showFullPageNavigation(false); // Initialisation avec seulement 'showMarkedPageBtn' visible

    // Récupérer l'état de la dernière page vue depuis sessionStorage
    const savedState = sessionStorage.getItem("currentPageState");

    if (savedState) {
        const { group, book, lang, page } = JSON.parse(savedState);  // Parse le JSON sauvegardé

        // Si les 4 valeurs sont présentes et valides, afficher la dernière page
        if (group && book && lang && page) {
            // Si group et book sont des entiers, c'est une collection
            if (!isNaN(group) && !isNaN(book)) {
                await checkUserSession(); // Obtenir les etats de connexion d'abord

                console.log("Dernière vue sur collection.");
                await loadCollection(group, page); // Charger la collection et afficher la page
            } else {
                await checkUserSession(); // Obtenir les etats de connexion d'abord

                console.log("Dernière vue sur le livre.");
                await loadImages(group, book, lang, page); // Charger le livre et afficher la page
            }
        }
    }
});

// Afficher l'intégralité de la collection
async function loadCollection(collectionId = null, searchedPageNumber = null) {
    // S'assurer que collectionId est un entier ou null
    collectionId = parseInt(collectionId, 10);
    if (isNaN(collectionId)) {
        console.error("ID de collection invalide. Veuillez fournir un ID valide.");
        return;
    }

    // Définir group et livre sur "collectionId" pour la collection
    currentGroupAndBookValues = { group: collectionId, book: collectionId }; // Groupe et livre actuels (Globale)
    currentPage = searchedPageNumber; // Page actuelle (Globale)
    bookIsArabic = 'ar'; // Langue du livre

    // Réinitialiser les éléments et actions du carousel
    resetCarousel();

    try {
        // Récupérer les livres de la collection depuis IndexedDB
        console.log("Chargement de la collection depuis IndexedDB...");
        const localBooks = await getCollectionBooksFromIndexedDB(collectionId);
        console.log("Livres de la collection récupérés depuis IndexedDB :", localBooks);

        if (localBooks.length > 0) {            
            // Définir la langue
            const firstBook = localBooks[0].book; // Récupérer le premier livre
            const firstBookLang = localBooks[0].lang; // Récupérer langue du premier livre
            const firstBookCollectionName = localBooks[0].collection_title; // Récupérer le nom de la collection (selon le premier)
            if (firstBookLang === 'ar') {
                bookIsArabic = 'ar';
                localBooks.reverse(); // Renverser l'ordre pour avoir la lecture arabe
            } else {
                bookIsArabic = 'noar';
            }             
            // Ajouter langue de la collection (langue du 1er livre)
            currentGroupAndBookValues = { ...currentGroupAndBookValues, 'lang': bookIsArabic };
            console.log(`Langue du premier livre "${firstBook}" : ${bookIsArabic}`); // Log pour débogage

            const collectionBookImages = [];

            // Récupérer les images de chaque livre, une par une
            for (const { group, book } of localBooks) {
                const bookImages = await getImagesFromIndexedDB(group, book);
                collectionBookImages.push(...bookImages); // Ajouter les images au tableau global
            }
            // Afficher toutes les images récupérées dans le carrousel
            await displayImagesInCarousel(collectionBookImages, searchedPageNumber);
            
            // Afficher le metadata correspondant
            document.getElementById('meta-book-name').innerText = firstBookCollectionName;
            document.getElementById('metaBookSection').style.display = 'block'; // Afficher le nom du livre cliquable
            
        } else {
            throw new Error("⚠ Aucun livre téléchargé n'est disponible en local.");
        }
    } catch (error) {
        console.error("⚠ Erreur lors de l'affichage de la collection depuis l'indexedDB:", error);
        if (userConnectedToServerAccount?.user?.id) {
            console.log("Utilisateur en ligne. Tentative d'affichage de la collection depuis le serveur.");

            const userId = userConnectedToServerAccount.user.id;
            // Obtenez les livres du serveur
            serverBooks = await getCollectionFromServer(collectionId);
            if (!serverBooks || serverBooks.length === 0) {
                console.log("⚠ Aucun livre trouvé sur le serveur pour cette collection.");
                return;
            }

            if (serverBooks.length > 0) {
                // Définir la langue
                const firstBook = serverBooks[0].book; // Récupérer le premier livre
                const firstBookLang = serverBooks[0].lang; // Récupérer langue du premier livre
                const firstBookCollectionName = serverBooks[0].collection_title; // Récupérer nom de la collection
                if (firstBookLang === 'ar') {
                    bookIsArabic = 'ar';
                    serverBooks.reverse(); // Renverser l'ordre pour avoir la lecture arabe
                } else {
                    bookIsArabic = 'noar';
                }       
                // Ajouter langue de la collection (langue du 1er livre)
                currentGroupAndBookValues = { ...currentGroupAndBookValues, 'lang': bookIsArabic };
                console.log(`Langue du premier livre "${firstBook}" : ${bookIsArabic}`); // Log pour débogage

                const collectionBookImages = [];
        
                // Récupérer les images de chaque livre, une par une
                for (const { group, book } of serverBooks) {
                    const bookImages = await getImagesFromServerDB(group, book);
                    collectionBookImages.push(...bookImages); // Ajouter les images au tableau global
                }
                // Afficher toutes les images récupérées dans le carrousel
                await displayImagesInCarousel(collectionBookImages, searchedPageNumber);

                // Afficher le metadata correspondant
                document.getElementById('meta-book-name').innerText = firstBookCollectionName;
                document.getElementById('metaBookSection').style.display = 'block'; // Afficher le nom du livre cliquable

            } else {
                console.log("⚠ Aucun livre téléchargé n'est disponible sur le compte de l'utilisateur.");

                // Réafficher l'image par défaut sur le carousel
                const carouselInner = document.getElementById('carousel-inner');
                carouselInner.innerHTML = ''; // Vider le contenu précédent, le cas échéant    
                carouselInner.innerHTML = `<img src="${defaultPage}" alt="Livre en images" style="width: 100%; object-fit: contain; border-radius: 20px;">`;    

                // Vider les données de livre et page actuelles
                currentGroupAndBookValues = { group : null, book: null, lang: null };
                currentPage = null;
                bookIsArabic = null; // Langue du livre
                
            }
        } else {
            console.error("Aucune collection trouvée. \n Veuillez télécharger d'abord des livres.");
            showFloatingMessage("Aucune collection trouvée. Veuillez télécharger d'abord des livres.", "danger");
            
            const carouselInner = document.getElementById('carousel-inner');
            carouselInner.innerHTML = ''; // Vider le contenu précédent, le cas échéant    
            carouselInner.innerHTML = `<img src="${defaultPage}" alt="Livre en images" style="width: 100%; object-fit: contain; border-radius: 20px;">`;

            // Vider les données de livre et page actuelles
            currentGroupAndBookValues = { group : null, book: null, lang: null };
            currentPage = null;
            bookIsArabic = null; // Langue du livre
        }
    } finally {
        // Mettre à jour l'opacité des livres téléchargés 
        // (Pour mettre en hightlight le livre en cours de lecture)
        refreshDownloadedBookOpacity();
    }
}

// Charger les images dans le carrousel
async function loadImages(group, book, lang, searchedPageNumber = null) {
    group = group?.trim() || null;
    book = book?.trim() || null;
    if (group === currentGroupAndBookValues.group && book === currentGroupAndBookValues.book && lang === currentGroupAndBookValues.lang && (searchedPageNumber === null || searchedPageNumber === currentPage) ) {
        console.log("Livre déjà en cours de lecture.");
        return; // Si le livre est déjà en cours de lecture, ne rien faire
    }
    
    currentGroupAndBookValues = { group: group, book: book, lang: lang }; // Groupe et livre actuels (Globale)
    currentPage = searchedPageNumber; // Page actuelle (Globale)
    bookIsArabic = lang === 'ar' ? 'ar' : 'noar'; // Récupérer la langue du livre

    // Réinitialiser les éléments et actions du carousel
    resetCarousel();

    console.log("Tentative de chargement des images...");

    // Vérifier la connexion au serveur (exécution asynchrone)
    const isOnline = appConnectedToWebServer;

    console.log("Appel de getImagesFromIndexedDB (local)...");
    const imagesFromIndexedDB = await getImagesFromIndexedDB(group, book);

    console.log("Résultat de getImagesFromIndexedDB:", imagesFromIndexedDB);

    if (!imagesFromIndexedDB || imagesFromIndexedDB.length > 0) {
        console.log('Images chargées depuis IndexedDB, envoi à displayImagesInCarousel');
        await displayImagesInCarousel(imagesFromIndexedDB, searchedPageNumber);
    } else if (isOnline) {
        console.log("⚠ Livre non trouvé en local (IndexedDB)");
        console.log("Appel de getImagesFromServerDB (Serveur)...");
        const imagesFromServerDB = await getImagesFromServerDB(group, book);
        if (imagesFromServerDB.length > 0) {
            await displayImagesInCarousel(imagesFromServerDB, searchedPageNumber);
        } else {
            console.log("⚠ Livre non trouvé sur le serveur.");
            showFloatingMessage("Livre non trouvé ou serveur inaccessible", "danger");

            const carouselInner = document.getElementById('carousel-inner');
            carouselInner.innerHTML = ''; // Vider le contenu précédent, le cas échéant    
            carouselInner.innerHTML = `<img src="${defaultPage}" alt="Livre en images" style="width: 100%; object-fit: contain; border-radius: 20px;">`;    

            // Vider les données de livre et page actuelles
            currentGroupAndBookValues = { group : null, book: null, lang: null };
            currentPage = null;
            bookIsArabic = null; // Langue du livre
        }
    } else {
        console.log("Livre non trouvé en local et aucune connexion avec le serveur.");

        const carouselInner = document.getElementById('carousel-inner');
        carouselInner.innerHTML = ''; // Vider le contenu précédent, le cas échéant    
        carouselInner.innerHTML = `<img src="${defaultPage}" alt="Livre en images" style="width: 100%; object-fit: contain; border-radius: 20px;">`;
        
        // Vider les données de livre et page actuelles
        currentGroupAndBookValues = { group : null, book: null, lang: null };
        currentPage = null;
        bookIsArabic = null; // Langue du livre

        showFloatingMessage("Livre introuvable en local \n Veuillez vous connecter et télécharger ce livre pour le consulter hors connexion.", "danger");
    }
    // Mettre à jour l'opacité des livres téléchargés 
    // (Pour mettre en hightlight le livre en cours de lecture)
    refreshDownloadedBookOpacity();
}

// Fonction pour charger les images depuis le Serveur
async function getImagesFromServerDB(group, book) {
    console.log("L'application est en ligne, chargement des images depuis le serveur...");
        
    try {
        const response = await fetch(`rqt_books_group_images_get.php?group=${encodeURIComponent(group)}&book=${encodeURIComponent(book)}`);
        
        if (!response.ok) {
            throw new Error('La réponse du serveur est incorrecte : ' + response.statusText);
        }

        const images = await response.json();
        
        if (images.length > 0) {
            console.log('Images récupérées depuis le serveur');
            if (bookIsArabic === 'noar') {
                return images;
            } else {
                images.reverse(); // Retourner l'ordre pour un affichage correct en RTL
                return images; // Retourner les images pour un traitement externe
            }            
            
        } else {
            throw new Error('Aucune page trouvée pour ce livre sur le serveur');
        }
    } catch (error) {
        console.error('Erreur lors de la récupération des images depuis le serveur:', error);

        // Renvoyer une valeur vide ou une image par défaut en cas d'erreur
        return [];
    }
}

// Fonction pour récupérer les images depuis IndexedDB
async function getImagesFromIndexedDB(group, book) {
    console.log("Début de la récupération des images depuis IndexedDB...");
    console.log(`Groupe: ${group}, Livre: ${book}`);

    const db = await openIndexedDB();
    if (!db) {
        console.error("Impossible d'ouvrir la base de données IndexedDB.");
        return [];
    } else {
        console.log("Base de données IndexedDB ouverte avec succès.");
    }

    const transaction = db.transaction(["images"], "readonly");
    const store = transaction.objectStore("images");
    const images = [];

    // Construire le chemin complet non encodé pour la recherche
    const basePath = 'assets/documents/books/';
    const completePath = `${basePath}${group}/${book}/images/`;
    console.log(`Chemin complet recherché: ${completePath}`);

    return new Promise((resolve, reject) => {
        const request = store.openCursor();
        const imageEntries = [];  // Tableau pour stocker chaque clé décodée et son blob

        request.onsuccess = function(event) {
            const cursor = event.target.result;
            if (cursor) {
                const storedImagePath = cursor.key;
                console.log(`Clé trouvée dans IndexedDB: ${storedImagePath}`);

                // Décoder l'URL de la clé pour la comparaison
                const decodedStoredImagePath = decodeURIComponent(storedImagePath);

                // Vérifier si le chemin correspond au chemin de recherche
                if (decodedStoredImagePath.includes(completePath)) {
                    console.log(`Image correspondant au chemin trouvée, ajout à la liste: ${decodedStoredImagePath}`);
                    imageEntries.push({ path: decodedStoredImagePath, blob: cursor.value }); // Ajouter le chemin décodé et le blob dans le tableau
                } else {
                    console.log(`Clé ignorée, ne correspond pas au chemin: ${decodedStoredImagePath}`);
                }
                cursor.continue();
            } else {
                console.log("Fin de la recherche dans IndexedDB.");
                console.log(`Nombre total d'images récupérées: ${imageEntries.length}`);

                // Trier les entrées en fonction des clés décodées croissant si pas arabe
                if (bookIsArabic === 'noar') {
                    imageEntries.sort((a, b) => b.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' }));
                } else {
                    imageEntries.sort((a, b) => b.path.localeCompare(a.path, undefined, { numeric: true, sensitivity: 'base' }));
                }

                // Afficher en log les clés décodées triées pour vérifier l'ordre
                console.log("Ordre des clés décodées après le tri:");
                imageEntries.forEach(entry => console.log(entry.path));

                // Créer un tableau final contenant uniquement les blobs dans l'ordre trié
                const sortedImages = imageEntries.map(entry => entry.blob);
                
                console.log("Images triées par clé décodée:", sortedImages);

                resolve(sortedImages); // Retourner les Blobs triés
            }
        };

        request.onerror = function(event) {
            console.error("Erreur lors de la récupération des images depuis IndexedDB:", event);
            reject([]);
        };
    });
}

// Fonction pour afficher les images dans le carrousel
async function displayImagesInCarousel(images, searchedPageNumber = null) {
    const carouselInner = document.getElementById('carousel-inner');
    carouselInner.innerHTML = ''; // Vider le contenu précédent, le cas échéant

    console.log("Images reçues: " + images );

    // Si on est hors ligne, s'assurer que toutes les images proviennent d'IndexedDB
    const processedImages = images.map(image => {
        // Si l'image est une chaîne (stockée dans IndexedDB sous forme d'URL encodée)
        if (typeof image === 'string') {
            console.log("Décoder image provenant du serveur.");
            try {
                const decodedImage = decodeURIComponent(image);
                console.log("Image décodée :", decodedImage);
                return decodedImage;
            } catch (e) {
                console.warn("Erreur de décodage, image brute utilisée :", image);
                return image; // Utiliser l'image brute si le décodage échoue
            }
        } else {
            // Pour les images Blob
            console.log("Création d'URL pour un objet Blob provenant d'IndexedDB");
            return URL.createObjectURL(image);
        }
    });

    totalImages = processedImages.length;  // Mise à jour Variable globale nécessaire 
    console.log(`Images reçues pour affichage après traitement: ${processedImages}`);

    // Vérification et affichage des images
    if (totalImages > 0) {
        processedImages.forEach((image, index) => {
            const item = document.createElement('div');
            item.classList.add('carousel-item');

            if (bookIsArabic === 'noar') {
                if (index === 0) item.classList.add('active');    
            } else {
                if (index === totalImages - 1) item.classList.add('active');
            }

            // Ajouter une vérification pour l'affichage d'image
            item.innerHTML = `<img src="${image}" class="d-block w-100" alt="Page">`;
            carouselInner.appendChild(item);
            console.log("Image ajoutée au carrousel:", image);
        });

        // Si ce n'est pas une collection
        if (isNaN(currentGroupAndBookValues.group) && isNaN(currentGroupAndBookValues.book)) {
            // Ajouter le nom du livre en bas du carousel (images)
            const bookInfos = await getBookInfos(currentGroupAndBookValues.group, currentGroupAndBookValues.book);
            document.getElementById('meta-book-group').innerText = bookInfos.group;
            document.getElementById('meta-book-name').innerText = bookInfos.book;
            document.getElementById('meta-book-arabic-name').innerText = bookInfos.arabicName;
            document.getElementById('metaBookSection').style.display = 'block'; // Afficher le nom du livre cliquable
        }

        // Affichage de la barre de navigation
        showFullPageNavigation(true);
        // Réinitialiser la valeur de l'input à 1
        document.getElementById('pageInput').value = 1;
        document.getElementById('totalPageTextInfo').innerText = `/${totalImages}`;
        currentPage = 1; // Page actuelle (Globale)

        // Définir la valeur maximale à 'totalImages'
        document.getElementById('pageInput').max = totalImages;

        // Montrer la direction de navigation
        showNavigationDirectionArrow(bookIsArabic, totalImages);

    } else {
        console.log("Aucune image disponible pour l'affichage en mode hors ligne.");
        carouselInner.innerHTML = `<img src="${defaultPage}" alt="Livre en images" style="width: 100%; object-fit: contain; border-radius: 20px;">`;

        // Vider les données de livre et page actuelles
        currentGroupAndBookValues = { group : null, book: null, lang: null };
        currentPage = null;
        bookIsArabic = null; // Langue du livre

        // Affichage de la barre de navigation
        showFullPageNavigation(false);
    }

    // Afficher le conteneur d'images
    document.getElementById('images-container').style.display = 'block';

    // activer/désactiver les boutons et la navigation (Enlève désactivation)
    toggleButtons(false);

    if (searchedPageNumber) {
        goToPage(searchedPageNumber);
        document.getElementById('pageInput').value = searchedPageNumber;
    } else {
        // Fonction asynchrone pour vérifier la session et mettre à jour le bouton si connecté
        const userLoggedIn = userConnectedToServerAccount;
        const localSession = JSON.parse(localStorage.getItem('userSession') || '{}');
        if (userLoggedIn || localSession?.user) {
            await updateBookmarkButton(); // Mettre à jour l'état du bouton bookMark
        }
    }
}

/**
 * Basculer entre les modes portrait et paysage du carrousel.
 */
// Basculement Mode portrait/paysage
document.getElementById('toggle-orientation').addEventListener('click', function () {
    const carousel = document.getElementById('images-container');
    const icon = this.querySelector('.icon');
    
    carousel.classList.toggle('portrait-mode');
    icon.classList.toggle('rotated'); // Rotation uniquement de l’icône
    console.log('mode portrait!');
});

// Masquer auto le bouton paysage/portrait sur mobile
document.addEventListener("DOMContentLoaded", function () { 
    const toggleBtn = document.getElementById("toggle-orientation"); 
    function handleResponsiveToggle() { 
        if (window.innerWidth <= 780) { 
            toggleBtn.classList.add("d-none"); 
        } else { toggleBtn.classList.remove("d-none"); 

        } 
    } // Au chargement 
    handleResponsiveToggle(); 
    // Si la fenêtre est redimensionnée 
window.addEventListener("resize", handleResponsiveToggle); });

// Aller à une page spécifique
async function goToPage(pageNumber) {
    if (pageNumber > 0 && pageNumber <= totalImages) {
        const carouselElement = document.getElementById('images-container');
        const carousel = new bootstrap.Carousel(carouselElement, {
            interval: false, // Désactiver l'auto-play si besoin
            ride: false
        });

        //Définir l'Index exacte selon la langue (ar/noar) 
        let actualIndex;
        if (bookIsArabic === 'noar') {
            // Si non arabe prendre l'index
            actualIndex = pageNumber - 1;
        } else {
            // sinon calculer l'index
            actualIndex = totalImages - pageNumber;
        }
        
        carousel.to(actualIndex);
        currentIndex = actualIndex; // Mettre à jour l'index courant

        // Mettre à jour l'input avec la page courante
        document.getElementById('pageInput').value = pageNumber;
        currentPage = pageNumber; // Page actuelle (globale) 

        // Fonction asynchrone pour vérifier la session et mettre à jour le bouton si connecté
        const userLoggedIn = userConnectedToServerAccount;
        const localSession = JSON.parse(localStorage.getItem('userSession') || '{}');
        if (userLoggedIn || localSession?.user) {
            await updateBookmarkButton(); // Mettre à jour l'état du bouton bookMark
        }
    } else {
        if (totalImages === 1) {
            showFloatingMessage(`Ce livre a une seule page.`, "warning");
        } else {
            showFloatingMessage(`Veuillez saisir un numéro de page valide \n entre 1 et ${totalImages}.`, "warning");
        }

        // Remettre le dernier numéro de page au champ Numéro de page
        document.getElementById('pageInput').value = currentPage;
        
    }
}

// Fonction pour obtenir la page actuelle depuis l'input de page
function getCurrentPage() { 
    return parseInt(pageInput.value, 10);
}

// Fonction pour charger les informations du marque-page en priorité depuis le localStorage
async function loadBookmark() {
    const userSession = JSON.parse(localStorage.getItem('userSession') || '{}');
    userBookMarkPage = userSession?.user?.page || null;

    // Vérifier si les informations du marque-page sont présentes dans localStorage
    if (userBookMarkPage) {
        console.log("Chargement du marque-page depuis localStorage ...");
        // Si les données sont disponibles dans localStorage, les utiliser
        markedPage = {
            page: userSession.user.page,
            group: userSession.user.group_name,
            book: userSession.user.book,
            lang: userSession.user.lang
        };
        console.log('Marque-page chargé depuis localStorage:', markedPage);
    } else {
        // Vérifier la connexion utilisateur (exécution asynchrone)
        const userConnected = userConnectedToServerAccount;

        if (userConnected) {
            console.log("Chargement du marque-page depuis le serveur ...");
            // Si les données ne sont pas présentes, charger depuis PHP
            fetch('rqt_marked_page_get.php')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Erreur HTTP : ' + response.status);
                }
                return response.json();
            })
            .then(data => {
                markedPage = data;
                console.log('Marque-page chargé depuis PHP:', markedPage);
            })
            .catch(error => console.error('Erreur lors du chargement du marque-page:', error));
        }
    }
}

// Initialiser le marque-page
loadBookmark();

// Fonction pour mettre à jour le contenu et le style d'un bouton
function updateButton(button, iconHTML, backgroundColor) {
    button.innerHTML = iconHTML;
    button.style.backgroundColor = backgroundColor;
}

// Mettre à jour l'affichage du bouton marque-page en fonction de la page actuelle
async function updateBookmarkButton() {
    await loadBookmark(); // Recharger le marque-page 
    currentPage = getCurrentPage(); // Obtenir la page actuelle
    const currentGroup = currentGroupAndBookValues?.group || null; // Utiliser var Globale pour le groupe
    const currentBook = currentGroupAndBookValues?.book || null;  // Utiliser var Globale pour le livre
    const currentBookLang = currentGroupAndBookValues?.lang || null;  // Utiliser var Globale pour le livre

    // Si la page courante est la marquée, changer l'icône
    if (markedPage && markedPage.group === currentGroup && markedPage.book === currentBook && markedPage.page === currentPage) {
        // Icône pour la page marquée
        const markedIcon = `
            <path d="M2 2v13.5a.5.5 0 0 0 .74.439L8 13.069l5.26 2.87A.5.5 0 0 0 14 15.5V2a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2"/>
        `;
        // Mettre à jour les deux boutons avec l'icône marquée
        updateButton(showMarkedPageBtn, markedIcon,  'transparent'); // Noir transparent
        updateButton(markPageBtn, markedIcon,  'transparent'); // Noir transparent
    } else {
        // Icônes pour une page non marquée
        const showMarkedIcon = `
            <path fill-rule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2z"/>
            <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466"/>
        `;
        const markPageIcon = `
            <path d="M2 4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v11.5a.5.5 0 0 1-.777.416L7 13.101l-4.223 2.815A.5.5 0 0 1 2 15.5zm2-1a1 1 0 0 0-1 1v10.566l3.723-2.482a.5.5 0 0 1 .554 0L11 14.566V4a1 1 0 0 0-1-1z"/>
            <path d="M4.268 1H12a1 1 0 0 1 1 1v11.768l.223.148A.5.5 0 0 0 14 13.5V2a2 2 0 0 0-2-2H6a2 2 0 0 0-1.732 1"/>
        `;
        // Mettre à jour les deux boutons avec les icônes par défaut
        updateButton(showMarkedPageBtn, showMarkedIcon, 'transparent');
        updateButton(markPageBtn, markPageIcon, 'transparent');
    }
}

// Événements de carrousel pendant la transition - désactiver tous les boutons de navigation
document.getElementById('images-container').addEventListener('slide.bs.carousel', function (event) {
    toggleButtons(true); // Désactiver les boutons pendant la transition
});

// Événements de carrousel après la transition - réactiver tous les boutons de navigation
document.getElementById('images-container').addEventListener('slid.bs.carousel', async function () {
    toggleButtons(false); // Réactiver les boutons après la transition

    // Fonction asynchrone pour vérifier la session et mettre à jour le bouton si connecté
    const userLoggedIn = userConnectedToServerAccount;
    const localSession = JSON.parse(localStorage.getItem('userSession') || '{}');
    if (userLoggedIn || localSession?.user) {
        await updateBookmarkButton(); // Mettre à jour l'état du bouton bookMark
    }
});

// Gérer les boutons de navigation
document.getElementById('prevBtn').addEventListener('click', function () {
    currentPage = parseInt(document.getElementById('pageInput').value, 10);

    // Si pas arabe, afficher normale de la page précédente
    if (bookIsArabic === 'noar') {
        if (currentPage > 1) {
            document.getElementById('pageInput').value = currentPage - 1;
            goToPage(currentPage - 1);
        }
    } else {
        if (currentPage < totalImages) {
            document.getElementById('pageInput').value = currentPage + 1;
            goToPage(currentPage + 1);
        }
    }

});

document.getElementById('nextBtn').addEventListener('click', function () {
    currentPage = parseInt(document.getElementById('pageInput').value, 10);
    if (bookIsArabic === 'noar') {
        if (currentPage < totalImages) {
            document.getElementById('pageInput').value = currentPage + 1;
            goToPage(currentPage + 1);
        }
    } else {
        if (currentPage > 1) {
            document.getElementById('pageInput').value = currentPage - 1;
            goToPage(currentPage - 1);
        }
    }
});

document.getElementById('prevPageBtn').addEventListener('click', function () {
    currentPage = parseInt(document.getElementById('pageInput').value, 10);
    if (bookIsArabic === 'noar') {
        if (currentPage > 1) {
            document.getElementById('pageInput').value = currentPage - 1;
            goToPage(currentPage - 1);
        }
    } else {
        if (currentPage < totalImages) {
            document.getElementById('pageInput').value = currentPage + 1;
            goToPage(currentPage + 1);
        }
    }
});

document.getElementById('nextPageBtn').addEventListener('click', function () {
    currentPage = parseInt(document.getElementById('pageInput').value, 10);
    if (bookIsArabic === 'noar') {
        if (currentPage < totalImages) {
            document.getElementById('pageInput').value = currentPage + 1;
            goToPage(currentPage + 1);
        }
    } else {
        if (currentPage > 1) {
            document.getElementById('pageInput').value = currentPage - 1;
            goToPage(currentPage - 1);
        }
    }
});

document.getElementById('firstPageBtn').addEventListener('click', function () {
    currentPage = parseInt(document.getElementById('pageInput').value, 10);
    if (bookIsArabic === 'noar') {
        if (currentPage > 1) {
            document.getElementById('pageInput').value = 1;
            goToPage(1);
        }
    } else {
        if (currentPage < totalImages) {
            document.getElementById('pageInput').value = totalImages;
            goToPage(totalImages);
        }
    }
});

document.getElementById('lastPageBtn').addEventListener('click', function () {
    currentPage = parseInt(document.getElementById('pageInput').value, 10);
    if (bookIsArabic === 'noar') {
        if (currentPage < totalImages) {
            document.getElementById('pageInput').value = totalImages;
            goToPage(totalImages);
        }
    } else {
        if (currentPage > 1) {
            document.getElementById('pageInput').value = 1;
            goToPage(1);
        }
    }
});

// Fonction pour gérer la navigation avec les flèches du clavier
function handleArrowNavigation(e) {
    // Flèche droite (Suivant)
    if (e.key === 'ArrowLeft') {
        currentPage = parseInt(document.getElementById('pageInput').value, 10);
        if (bookIsArabic === 'noar') {
            if (currentPage > 1) {
                document.getElementById('pageInput').value = currentPage - 1;
                goToPage(currentPage - 1);
            }
        } else {
            if (currentPage < totalImages) {
                document.getElementById('pageInput').value = currentPage + 1;
                goToPage(currentPage + 1);
            }
        }
    }

    // Flèche gauche (Précédent)
    if (e.key === 'ArrowRight') {
        currentPage = parseInt(document.getElementById('pageInput').value, 10);
        if (bookIsArabic === 'noar') {
            if (currentPage < totalImages) {
                document.getElementById('pageInput').value = currentPage + 1;
                goToPage(currentPage + 1);
            }
        } else {
            if (currentPage > 1) {
                document.getElementById('pageInput').value = currentPage - 1;
                goToPage(currentPage - 1);
            }
        }
    }
}

// Gestion du swipe manuel pour mobile
const carouselElement = document.getElementById('images-container');

if (carouselElement) {
    // Gérer les événements de navigation avec swipe
    carouselElement.addEventListener('slide.bs.carousel', function (e) {
        // Récupérer l'index de la nouvelle image active après le swipe
        const newIndex = e.to; // Index de la nouvelle image
        
        let newPage;
        if (bookIsArabic === 'noar') {
            // Langue non arabe (les pages sont dans l'ordre normal)
            newPage = newIndex + 1;
        } else {
            // Arabe - Calculer la page correspondante (les pages sont inverses)
            newPage = totalImages - newIndex;
        }

        // Mettre à jour le numéro de page dans l'input
        document.getElementById('pageInput').value = newPage;
    });
}

document.getElementById('goToPageBtn').addEventListener('click', function () {
    const pageInput = parseInt(document.getElementById('pageInput').value, 10);
    goToPage(pageInput);
});

document.getElementById('pageInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        const pageInput = parseInt(document.getElementById('pageInput').value, 10);
        goToPage(pageInput);
    }
});

// Marquer la page actuelle
markPageBtn.addEventListener('click', async (event) => {
    await loadBookmark(); // Recharger le marque-page 
    currentPage = getCurrentPage(); // Obtenir la page actuelle
    const currentGroup = currentGroupAndBookValues?.group || null; // Utiliser var Globale pour le groupe
    const currentBook = currentGroupAndBookValues?.book || null;  // Utiliser var Globale pour le livre
    const currentBookLang = currentGroupAndBookValues?.lang || null;  // Utiliser var Globale pour le livre

    // Si la page courante est différente de celle marquée
    if (!markedPage || (markedPage?.group !== currentGroup || markedPage?.book !== currentBook || markedPage?.page !== currentPage)) {
        const popoverContent2 = document.getElementById('popoverContent2');
        popoverContent2.style.display = 'block';

        // Écouter les clics sur les boutons Oui et Non, mais une seule fois
        const confirmYesBtn = document.getElementById('confirmYes2');
        const confirmNoBtn = document.getElementById('confirmNo2');

        const confirmYesHandler = async () => {
            const now = new Date();
            const currentDateTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        
            const markedPageData = {
                page: currentPage,
                group: currentGroup,
                book: currentBook,
                lang: currentBookLang,
                last_update: currentDateTime
            };
            
            // Vérifier la connexion utilisateur (exécution asynchrone)
            const userLoggedIn = userConnectedToServerAccount;

            try {
                if (userLoggedIn) {
                    const response = await fetch('rqt_marked_page_set.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(markedPageData),
                    });
                    if (!response.ok) throw new Error('Erreur lors de l\'enregistrement en base de données');

                    const data = await response.json();
                    console.log('Données enregistrées avec succès en base de données:', data);
                } else {
                    console.warn('Mode hors ligne : Enregistrement dans localStorage uniquement');
                }
            } catch (error) {
                console.warn('Base de données inaccessible. Enregistrement local uniquement:', error);
            } finally {
                const userSession = JSON.parse(localStorage.getItem('userSession') || '{}');
                localStorage.setItem('userSession', JSON.stringify({
                    ...userSession,
                    user: {
                        ...userSession.user,
                        group_name: currentGroup,
                        book: currentBook,
                        page: currentPage,
                        lang: currentBookLang,
                        last_update: currentDateTime
                    }
                }));

                // Fermer le popover après confirmation
                popoverContent2.style.display = 'none';

                // Mettre à jour l'objet markedPage
                markedPage = {
                    page: currentPage,
                    group: currentGroup,
                    book: currentBook,
                    lang: currentBookLang
                };

                // Vérifier la session utilisateur d'abord
                const userLoggedIn = userConnectedToServerAccount;
                const localSession = JSON.parse(localStorage.getItem('userSession') || '{}');
                if (userLoggedIn || localSession?.user) {
                    await updateBookmarkButton(); // Mettre à jour l'état du bouton bookMark
                }
            }
        };

        confirmYesBtn.addEventListener('click', confirmYesHandler, { once: true });

        confirmNoBtn.addEventListener('click', () => {
            popoverContent2.style.display = 'none';
        }, { once: true });

        const outsideClickListener = (event) => {
            if (!popoverContent2.contains(event.target) && event.target !== markPageBtn) {
                popoverContent2.style.display = 'none';
                document.removeEventListener('click', outsideClickListener);
            }
        };
        document.addEventListener('click', outsideClickListener);
    }
});

// Fonction pour afficher le popover de confirmation
function showPopover() {
    const popoverContent = document.getElementById('popoverContent');
    
    // Afficher le popover au centre de la page
    popoverContent.style.display = 'block';

    // Assurez-vous de ne pas ajouter plusieurs fois les mêmes écouteurs d'événements
    const confirmYesBtn = document.getElementById('confirmYes');
    const confirmNoBtn = document.getElementById('confirmNo');
    
    // Supprimer les écouteurs existants avant d'ajouter de nouveaux
    confirmYesBtn.replaceWith(confirmYesBtn.cloneNode(true));
    confirmNoBtn.replaceWith(confirmNoBtn.cloneNode(true));

    currentPage = getCurrentPage(); // Obtenir la page actuelle
    const currentGroup = currentGroupAndBookValues?.group || null; // Utiliser var Globale pour le groupe
    const currentBook = currentGroupAndBookValues?.book || null;  // Utiliser var Globale pour le livre
    const currentBookLang = currentGroupAndBookValues?.lang || null;  // Utiliser var Globale pour le livre

    
    // Ajouter un nouvel écouteur d'événement pour le bouton Oui
    document.getElementById('confirmYes').addEventListener('click', () => {
        // Si le livre affiché est celui marqué, aller à la page directement
        if (markedPage.group === currentGroup && markedPage.book === currentBook) {
            goToPage(markedPage.page);

        // Si group et book sont des entiers, c'est une collection
        } else if (markedPage.group && markedPage.book && !isNaN(markedPage.group) && !isNaN(markedPage.book)) {
            // Charger la collection et aller à la page
            loadCollection(markedPage.group, markedPage.page);
        } else {
            // Appeler loadImages avec le groupe, le livre et la page marquée
            loadImages(markedPage.group, markedPage.book, markedPage.lang, markedPage.page);
        }

        // Cacher le popover après confirmation
        popoverContent.style.display = 'none';
    }, { once: true });

    // Ajouter un nouvel écouteur d'événement pour le bouton Non
    document.getElementById('confirmNo').addEventListener('click', () => {
        // Cacher le popover si l'utilisateur clique sur Non
        popoverContent.style.display = 'none';
    }, { once: true });

    // Ajouter un écouteur pour fermer le popover si l'utilisateur clique en dehors
    const outsideClickListener = (event) => {
        if (!popoverContent.contains(event.target) && event.target !== showMarkedPageBtn) {
            popoverContent.style.display = 'none';

            // Retirer cet écouteur une fois qu'il a été utilisé
            document.removeEventListener('click', outsideClickListener);
        }
    };

    // S'assurer qu'il n'y a qu'un seul écouteur pour le clic en dehors
    document.addEventListener('click', outsideClickListener, { once: true });
}

// Aller vers la page marquée
showMarkedPageBtn.addEventListener('click',  async (event) => {
    await loadBookmark(); // Recharger le marque-page 
    currentPage = getCurrentPage(); // Obtenir la page actuelle
    const currentGroup = currentGroupAndBookValues?.group || null; // Utiliser var Globale pour le groupe
    const currentBook = currentGroupAndBookValues?.book || null;  // Utiliser var Globale pour le livre
    const currentBookLang = currentGroupAndBookValues?.lang || null;  // Utiliser var Globale pour le livre

    if (!markedPage || !markedPage?.group || !markedPage?.book || !markedPage?.page) {
        showFloatingMessage("Vous n'avez pas encore de page marquée.", "info");
        return;
    }

    // Si la page courante est différente de la page marquée, afficher le popover
    if (markedPage && markedPage.group && markedPage.book && markedPage.page && (markedPage.group !== currentGroup || markedPage.book !== currentBook || markedPage.page !== currentPage)) {
        showPopover(); // Appeler la fonction pour afficher le popover
    }
});


/**
 * Vérifie si une adresse email est valide.
 * @param {string} email - L'adresse email à valider.
 * @returns {boolean} - Retourne true si l'email est valide, sinon false.
 */
function isValidEmail(email) {
    // Expression régulière pour valider un email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Fonctionnalité d'affichage/masquage du mot de passe
document.querySelectorAll('.toggle-password').forEach(item => {
    item.addEventListener('click', function() {
        const target = document.getElementById(this.dataset.target);
        if (target.type === "password") {
            target.type = "text";
            this.textContent = "🙈"; // Icône pour caché
        } else {
            target.type = "password";
            this.textContent = "👁️"; // Icône pour visible
        }
    });
});

// Fonction pour vérifier si la session utilisateur est active (avec une récursivité et un delai MAX)
async function waitForSessionReady(timeout = 3000, interval = 200) {
    const start = Date.now();
    let session;

    while (Date.now() - start < timeout) {
        session = await checkUserSession();

        if (session?.loggedIn && session.user && session.source === 'server') {
            return session;
        }

        await new Promise(resolve => setTimeout(resolve, interval));
    }

    return null; // session non disponible après le délai
}

// Fonction pour afficher les informations utilisateur après connexion
function loadUserInfo(user) { // Affichage des infos user à la place des forms
    document.getElementById("auth-section").style.display = "none";
    document.getElementById("user-info").style.display = "block";
    document.getElementById("user-name").textContent = user.fullname;
}

// GESTION DES CONNEXIONS/INSCRIPTIONS
document.getElementById("loginForm").addEventListener("submit", async function(event) {
    event.preventDefault();
    const formData = new FormData(this);

    // Si application connectée au serveur (exécution asynchrone)
    if (appConnectedToWebServer) {
        fetch('rqt_auth.php?action=login', {
            method: 'POST',
            body: formData,
            credentials: 'include' // ← Obligatoire pour récupérer la vraie session
        })
        .then(response => response.json())
        .then(async (data) => {
            if (data.success) {
                const delay = 30000; // Délai pour attendre la session
                session = await waitForSessionReady(delay); // Attendre que la session soit prête

                if (!session) {
                    console.warn(`Session utilisateur non disponible après délai (${delay}).`);
                }

                console.log("Session utilisateur après connexion et attente:", session);

                // Mettre à jour les composants de l'interface utilisateur
                await updateComponentsVisibility(); // Mettre à jour les Widgets

                // Vérifier si même utilisateur s'est reconnecté
                const userLocalSession = JSON.parse(localStorage.getItem('userSession') || '{}');
                const userId = data.user.id;
                const localUserId = userLocalSession?.user?.id || null;
                
                if (localUserId === userId) {
                    // Mettre à jour loggedIn à true dans localStorage
                    localStorage.setItem('userSession', JSON.stringify({
                        ...userLocalSession,
                        loggedIn: true
                    }));                    
                    
                    // Synchroniser les données marque-page
                    await syncLocalStorageMarkedPageWithServer();

                    if (session.loggedIn && session?.source === 'server') {
                        // Si localStorage existe et l'utilisateur est le même, synchroniser
                        await syncIndexedDBWithServer(userId);
                    }

                } else {
                    // Sinon réinitialiser LocalStorage et indexDB
                    // Suppression de l'IndexedDB
                    await deleteIndexedDB();

                    // Supprimer complètement l'élément 'userSession' du localStorage
                    localStorage.removeItem('userSession');

                    // Redéfinir 'userSession' avec les nouvelles données
                    localStorage.setItem('userSession', JSON.stringify({ loggedIn: true, user: data.user }));

                    // Synchroniser les livre du nouvel utilisateur 
                    await syncBooksFromServer(userId);
                    
                    await refreshDownloadedBooks(); // Mettre à jour les livres téléchargés
                }

                // Effacer tous les champs de saisie
                let inputs = document.getElementsByClassName('allFormInput');
                for (let i = 0; i < inputs.length; i++) {
                    inputs[i].value = '';
                }

                // Afficher les infos utilisateur
                loadUserInfo(data.user);
            } else {
                showFloatingMessage(data.message, "danger");
            }
        })
        .catch(error => {
            console.error('Erreur lors de la connexion:', error);
        });   
    }
});

// GESTION DE L'INSCRIPTION
document.getElementById("registerForm").addEventListener("submit", async function(event) {
    event.preventDefault();

    // Stocker les données localStorage (userSession) avant inscription (Pour maj marque-page)
    userSessionBeforeRegister = JSON.parse(localStorage.getItem('userSession') || '{}');

    if (appConnectedToWebServer) {
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirm_password").value;

        // Vérification de la correspondance des mots de passe
        if (password !== confirmPassword) {
            showFloatingMessage("Les mots de passe ne correspondent pas.", "warning");
            return;
        }

        const formData = new FormData(this);

        fetch('rqt_auth.php?action=register', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(async data => {
            if (data.success) {                
                const delay = 30000; // Délai pour attendre la session
                session = await waitForSessionReady(delay); // Attendre que la session soit prête

                if (!session) {
                    console.warn(`Session utilisateur non disponible après délai (${delay}).`);
                }

                console.log("Session utilisateur après connexion et attente:", session);

                // Mettre à jour les composants de l'interface utilisateur
                await updateComponentsVisibility(); // Mettre à jour les Widgets
                const userId = data?.user?.id || null; // ID utilisateur

                const localBooks = await getLocalBooksFromIndexedDB(); // await getAllMetadata();
                let userConfirmed = false;
                if (localBooks.length > 0) {
                    // Demander à l'utilisateur s'il veut importer ses livres
                    userConfirmed = window.confirm("Voulez-vous importer les livres que vous avez téléchargés vers votre compte ?");   
                }
                
                const now = new Date();
                const currentDateTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
            
                if (userConfirmed) {
                    
                    // Si l'utilisateur a confirmé, envoyer les livres vers le serveur
                    // Ajouter les livres locaux au serveur
                    console.log("L'utilisateur a confirmé l'importation des livres locaux.");
                    if (session.loggedIn && session?.source === 'server') {
                        for (const localBook of localBooks) {
                            console.log(`Ajout du livre local au serveur : ${localBook.group}/${localBook.book}`);
                            await addBookToUserCollection(localBook.group, localBook.book, localBook.collection_id, localBook.collection_title, localBook.id, localBook.position);
                        }
                    }

                    // Mise à jour des données de marque-page si elles existent
                    console.log("Données marque-page avant inscription: ", userSessionBeforeRegister.user);
                    const localMarkedPageGroup = userSessionBeforeRegister?.user?.group_name || null;
                    const localMarkedPageBook = userSessionBeforeRegister?.user?.book || null;
                    const localMarkedPagePage = userSessionBeforeRegister?.user?.page || null;
                    const localMarkedPageLang = userSessionBeforeRegister?.user?.lang || null;
                    const localMarkedPageLastUpdate = userSessionBeforeRegister?.user?.last_update || currentDateTime;

                    // Afficher les valeurs des variables
                    if (localMarkedPageGroup && localMarkedPageBook && localMarkedPagePage && localMarkedPageLang && localMarkedPageLastUpdate) {
                        console.log(`Mise à jour du marque-page: ${localMarkedPageGroup}/${localMarkedPageBook} à la page ${localMarkedPagePage}`);
                        await updateMarkedPageOnServer(userSessionBeforeRegister.user); 
                    }

                    // Mise à jour de collection_last_update dans le Serveur et en local
                    await updateCollectionLastUpdate();

                    // Mettre à jour le localStorage avec les nouvelles données utilisateur
                    await updateLocalStorageWithUserDataFromServer();

                    // Synchroniser les livre du nouvel utilisateur 
                    await syncBooksFromServer(userId);
                    
                    await refreshDownloadedBooks(); // Mettre à jour les livres téléchargés
                    
                } else {                        
                    // Sinon réinitialiser LocalStorage et indexDB
                    // Suppression de l'IndexedDB
                    await deleteIndexedDB();

                    // Supprimer complètement l'élément 'userSession' du localStorage
                    localStorage.removeItem('userSession');

                    // Redéfinir 'userSession' avec les nouvelles données
                    localStorage.setItem('userSession', JSON.stringify({ loggedIn: true, user: data.user }));
                }                
                
                // Effacer tous les champs de saisie
                let inputs = document.getElementsByClassName('allFormInput');
                for (let i = 0; i < inputs.length; i++) {
                    inputs[i].value = '';
                }

                // Afficher les infos utilisateur
                loadUserInfo(data.user); 
            } else {
                showFloatingMessage(data.message, "danger");
            }
        });   
    }
});

// GESTION DE LA DÉCONNEXION
document.getElementById("logout").addEventListener("click", async function(event) {
    event.preventDefault();
    
    const logoutConfirmed = window.confirm(`Êtes-vous sûr de vouloir vous déconnecter ?`);
    if (!logoutConfirmed) {
        console.log("Déconnexion annulé.");
        return;
    } 
    // Vérifier la connexion au serveur (exécution asynchrone)
    const isOnline = appConnectedToWebServer;
    const userId = userConnectedToServerAccount?.user?.id || null;

    if (isOnline && userId) {
        // Envoi de la requête pour la déconnexion sur le serveur
        fetch('rqt_auth.php?action=logout')
        .then(response => response.json())
        .then(async (data) => {
            if (data.success) {
                await updateComponentsVisibility(); // Mettre à jour les Widgets
                // Masquer les sections et afficher celles de connexion
                document.getElementById("auth-section").style.display = "block";
                document.getElementById("user-info").style.display = "none";

                // Mettre à jour loggedIn à false dans localStorage
                const userSession = JSON.parse(localStorage.getItem('userSession') || '{}');
                if (userSession) {
                    localStorage.setItem('userSession', JSON.stringify({
                        ...userSession,
                        loggedIn: false
                    }));                    
                    console.log("Utilisateur déconnecté, loggedIn=false dans localStorage.");
                } else {
                    console.log("Utilisateur absent de localStorage.");
                }
                                
            } else {
                showFloatingMessage("Erreur lors de la déconnexion.", "danger");
            }
        })
        .catch(error => {
            console.error('Erreur lors de la déconnexion:', error);
            showFloatingMessage("Erreur de connexion.", "danger");
        });   
    }
});

// GESTION RÉCUPÉRATION MOT DE PASSE OUBLIÉ
document.getElementById("forgotPasswordForm").addEventListener("submit", async function(event) {
    event.preventDefault();
    const formData = new FormData(this);
    
    // Si application connectée au serveur (exécution asynchrone)
    if (appConnectedToWebServer) {
        fetch('rqt_auth.php?action=forgotPassword', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(async (data) => {
            if (data.success) {
                // Lbérer les entêtes et afficher celle de connexion
                document.querySelectorAll('.nav-link.active').forEach(navLink => {
                    navLink.classList.remove('active');
                });
                document.getElementById('login-nav').classList.add('active');
                
                // Masquer les autres sections
                document.getElementById('forgot-password-tab').classList.remove('show', 'active');
                document.getElementById('register-tab').classList.remove('show', 'active');

                // Afficher la section login
                const loginTab = document.getElementById('login-tab');
                loginTab.classList.add('show', 'active');

                // Afficher email dans le champ login de connexion
                const recoverEmail = document.getElementById("recover-email").value.trim();
                document.getElementById("login").value = recoverEmail;
                
                /// Afficher le Message de réponse
                showFloatingMessage(data.message, "success");

            } else {
                showFloatingMessage(data.message, "danger");
            }
        })
        .catch(error => {
            console.error('Erreur lors de la connexion:', error);
        });   
    }
});

// AFFICHAGE FORMULAIRE RÉCUPÉRATION MOT DE PASSE
document.getElementById('openForgotPasswordtab').addEventListener('click', (event) => {
    event.preventDefault();

    // Lbérer les entêtes
    document.querySelectorAll('.nav-link.active').forEach(navLink => {
        navLink.classList.remove('active');
    });

    // Masquer les autres sections
    document.getElementById('login-tab').classList.remove('show', 'active');
    document.getElementById('register-tab').classList.remove('show', 'active');

    // Afficher la section Mot de passe oublié
    const forgotPasswordTab = document.getElementById('forgot-password-tab');
    forgotPasswordTab.classList.add('show', 'active');

    // Ajouter l'email au champ s'il était dans le champ d'inscription
    const loginEmail = document.getElementById('login').value.trim();
    document.getElementById("recover-email").value = isValidEmail(loginEmail) ? loginEmail : '';
});

// Récupérer les paramètres GET - Pour vérifier la demande réinitialisation mot de passe
// Vérifier si l'URL contient des paramètres GET
const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get('id');
const userState = urlParams.get('state');
const activationCode = urlParams.get('activation_code');

if (userId && userState === '0' && activationCode) {
    // Vérifier la validité du code et l'état du compte
    fetch(`rqt_auth.php?action=resetPassword&id=${userId}&activation_code=${activationCode}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Cacher la section par défaut et afficher la page de réinitialisation
                document.getElementById('pageDefault').style.display = 'none';
                document.getElementById('pageResetPassword').style.display = 'block';
            } else {
                showFloatingMessage(data.message, "danger");
                location.href = '/'; // Redirige vers la page d'accueil ou une autre page
            }
        })
        .catch(error => console.error('Erreur lors de la vérification:', error));
}

// Soumettre le formulaire de réinitialisation
document.getElementById('resetPasswordForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        showFloatingMessage("Les mots de passe ne correspondent pas.", "danger");
        return;
    }

    fetch('rqt_auth.php?action=updatePassword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            id: userId,
            new_password: newPassword
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showFloatingMessage(data.message, "success");
            location.href = '/'; // Redirige vers la page d'accueil ou une autre page
        } else {
            showFloatingMessage(data.message, "danger");
        }
    })
    .catch(error => console.error('Erreur lors de la mise à jour:', error));
});

// Afficher le modal de modification du compte
document.getElementById('modifyAccount').addEventListener('click', openModifyAccountModal);

function openModifyAccountModal(event) {
    event.preventDefault(); // Empêche le comportement par défaut du lien
    // Afficher le modal
    const modal = document.getElementById('modifyAccountModal');
    modal.style.display = 'block';

    // Récupérer les données de l'utilisateur via fetch
    fetch('rqt_auth.php?action=user_infos_get') // Remplace par ton API pour récupérer les données utilisateur
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Remplir les champs avec les données de l'utilisateur
                document.getElementById('updateFullname').value = data.user.fullname;
                document.getElementById('updateEmail').value = data.user.email;
                document.getElementById('updatePhone').value = data.user.phone;
            } else {
                showFloatingMessage('Erreur lors de la récupération des données', 'danger');
            }
        })
        .catch(error => console.error('Erreur:', error));
}

document.getElementById('closeModal').addEventListener('click', closeModifyAccountModal);

function closeModifyAccountModal() {
    // Effacer tous les champs de saisie
    let inputs = document.getElementsByClassName('allFormInput');
    for (let i = 0; i < inputs.length; i++) {
        inputs[i].value = '';
    }

    // Fermer le modal
    const modal = document.getElementById('modifyAccountModal');
    modal.style.display = 'none';
}

document.getElementById('modifyAccountForm').addEventListener('submit', handleFormSubmit);

async function handleFormSubmit(event) {
    event.preventDefault(); // Empêche le comportement par défaut du formulaire

    const fullname = document.getElementById('updateFullname').value;
    const email = document.getElementById('updateEmail').value;
    const phone = document.getElementById('updatePhone').value;
    const password = document.getElementById('updatePassword').value;
    const newPassword = document.getElementById('updateNewPassword').value;
    const confirmPassword = document.getElementById('updateConfirmPassword').value;

    // Validation des champs avant soumission
    const errors = [];
    if (!fullname || !email || !phone || !password) {
        errors.push('Les champs `Nom complet`, `Email`, `Téléphone` et `Mot de passe` doivent être remplis.');
    }

    if (newPassword && (newPassword !== confirmPassword)) {
        errors.push('Les mots de passe ne correspondent pas.');
    }

    if (newPassword && newPassword.length < 6) {
        errors.push('Le mot de passe doit comporter au moins 6 caractères.');
    }

    if (errors.length > 0) {
        showFloatingMessage(errors.join('\n'), "danger");
        return;
    }

    const data = {
        fullname,
        email,
        phone,
        password,
        newPassword: newPassword || null // Si aucun nouveau mot de passe, ne l'envoyer pas
    };

    try {
        const response = await fetch('rqt_auth.php?action=updateAccount', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (result.success) {
            showFloatingMessage('Les modifications ont été enregistrées avec succès.', "success");
            closeModifyAccountModal(); // Fermer le modal après la mise à jour
        } else {
            showFloatingMessage(`${result.message || 'Erreur lors de la mise à jour.'}`, "danger" );
        }
    } catch (error) {
        console.error('Erreur:', error);
        showFloatingMessage('Une erreur est survenue.', "danger");
    }
}

// Affichage Boutons téléchargement si l'app est installée et apareil connecté au serveur
// Et Afficher les formulaires connexions/inscription si apareil connecté à internet
// Fonction pour gérer la visibilité des boutons en fonction de l'état de l'appareil et de la connexion
async function updateComponentsVisibility() {
    const installAppMsg = document.getElementById("installAppMsg");
    const authSection = document.getElementById("auth-section");
    const userInfo = document.getElementById("user-info");
    const connexionInfo = document.getElementById("connexion-info");

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    // Les signaux de connexion réseau
    const connexionSignalText = document.getElementById('connexionSignalText');
    const connexionSignalIcon = document.getElementById('connexionSignalIcon').querySelector('img');
    // Les signaux de login
    const loginSignalText = document.getElementById('loginSignalText');
    const loginSignalIcon = document.getElementById('loginSignalIcon').querySelector('img');

    // Vérifier Session 
    const sessionStatus = await checkUserSession();
            
    // Vérifier la connexion au serveur (exécution asynchrone)
    const isOnline = appConnectedToWebServer;

    // Affichage message et bouton (icône) d'installation si l'app n'est pas installée et connectée
    installAppMsg.style.display = !isStandalone && isOnline ? 'block' : 'none';

    const localSession = JSON.parse(localStorage.getItem('userSession') || '{}'); // Session locale

    if (isOnline) {
        // Mettre à jour le statut et l'icône  - en ligne
        connexionSignalText.textContent = "En ligne";
        connexionSignalIcon.src = "assets/images/icons/icon-online.png";

        // En ligne, afficher tous les groupes de livre du serveur (Non téléchargés)
        const allBooksBlock = document.getElementById('allBooksGroups');
        allBooksBlock.style.display = "block";

        // Afficher tous les livres du serveur
        if (
            allBooksBlock.children.length === 0 ||
            allBooksBlock.querySelector('.offlineDiv')
        ) {
            // Le conteneur est vide ou contient le message hors ligne, générer les listes de livres
            loadBooksFromServer();
        }

        // Gérer l'affichage en fonction de l'état de la session
        if (sessionStatus.loggedIn) {
            // L'utilisateur est connecté
            authSection.style.display = 'none';
            userInfo.style.display = 'block';
            connexionInfo.style.display = 'none';
        } else {
            // L'utilisateur n'est pas connecté
            authSection.style.display = 'block';
            userInfo.style.display = 'none';
            connexionInfo.style.display = 'none';
        }
    } else {
        // Hors ligne
        // Mettre à jour le statut et l'icône - hors ligne
        connexionSignalText.textContent = "Hors ligne";
        connexionSignalIcon.src = "assets/images/icons/icon-offline.png";

        // Hors ligne, cacher tous les groupes de livre du serveur (Non téléchargés)
        // document.getElementById('allBooksGroups').style.display = "none";

        const allBooksBlock = document.getElementById('allBooksGroups');        

        // Hors ligne, Vider le conteneur des livres du serveur 
        // (Rechargement lors de la prochaine connexion)
        // Ajoute la div offlineDiv seulement si elle n'existe pas déjà
        if (!allBooksBlock.querySelector('.offlineDiv')) {
            allBooksBlock.innerHTML = ''; // Vider uniquement s'il n'existe pas encore le message
            const offlineBlockMsg = document.createElement('div');
            offlineBlockMsg.className = 'offlineDiv bg-light text-warning text-center p-3 fw-bold';
            offlineBlockMsg.style.userSelect = 'none';
            offlineBlockMsg.textContent = "Vous êtes hors connexion internet";
            allBooksBlock.appendChild(offlineBlockMsg);
        }

        allBooksBlock.style.display = "block";
            
        // Affichage message hors ligne
        connexionInfo.style.display = "block";
        authSection.style.display = "none";
        userInfo.style.display = "none";

        // Afficher nom utilisateur s'il est hors ligne mais connecté 
        if (sessionStatus.loggedIn) {
            // Session hors ligne et connecté
            document.getElementById("user-name-offline").textContent = sessionStatus.user.fullname;
        } else {
            // Session hors ligne mais pas connecté
            document.getElementById("user-name-offline").textContent = localSession?.user?.fullname || 'Bienvenue !';
        }

    }

    // Gestion des signaux de connexion et Boutons marque-page
    if (sessionStatus.loggedIn) {                
        // Mettre à jour le statut et l'icône login
        loginSignalText.textContent = "Connecté(e)";
        loginSignalIcon.src = "assets/images/icons/fall-icon-192x192.png";

    } else {       
        // Mettre à jour le statut et l'icône login
        loginSignalText.textContent = "Déonnecté(e)";
        loginSignalIcon.src = "assets/images/icons/fall-icon-192x192.png";
    }
}

document.addEventListener("DOMContentLoaded", function () {
    updateComponentsVisibility();

    // Mise à jour périodique
    setInterval(updateComponentsVisibility, 3000);

    // Sur changement du mode standalone
    window.matchMedia('(display-mode: standalone)').addEventListener('change', updateComponentsVisibility);
});

// GESTION DU BOUTON POUR INSTALLER L'APP PWA    
let deferredPrompt;
const installAppButton = document.getElementById('installAppButton');

// Capture l'événement 'beforeinstallprompt' pour stocker l'invite d'installation
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e; // Sauvegarde l'invite
    installAppButton.style.display = 'inline-block'; // Affiche le bouton d'installation si prêt
});

// Ajoute un écouteur au bouton pour lancer l'invite d'installation
installAppButton.addEventListener('click', () => {
    if (deferredPrompt) {
        deferredPrompt.prompt(); // Lance l'invite
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('L\'utilisateur a accepté l\'installation');
                installAppButton.style.display = 'none'; // Cache le bouton une fois l'installation acceptée
            } else {
                console.log('L\'utilisateur a refusé l\'installation');
            }
            deferredPrompt = null; // Réinitialise l'invite après l'installation
        });
    }
});

// Fonction pour supprimer un livre de l'affichage
async function removeBookFromDisplay(contentId) {
    console.log(`Tentative de suppression du livre avec contentId: ${contentId}`);
    const downloadedBooksContainer = document.getElementById('downloadedBooksGroup');
    const bookItem = downloadedBooksContainer?.querySelector(`a[data-content-id="${contentId}"]`)?.closest('.downloadedBookItem');

    if (bookItem) {
        bookItem.remove();
        console.log(`Livre avec contentId ${contentId} supprimé de l'affichage.`);
    }
}

// Fonction pour supprimer un livre de indexedDB et le serveur
async function deleteBookImages(group, book, contentId = null, collectionId = null){
    group?.trim();
    book?.trim();

    const deleteConfirmed = window.confirm(`Êtes-vous sûr de vouloir supprimer ${book} de votre collection"?`);
    if (!deleteConfirmed) {
        console.log("Suppression annulé.");
        return;
    } 

    try {
        console.log("Tentative de Suppression du livre de la collection...");
        const userId = userConnectedToServerAccount?.user?.id || null;
        
        // Appeler la fonction pour supprimer les images du livre dans IndexedDB
        const result = await deleteBookImagesFromIndexedDB(group, book, contentId, collectionId);

        if (result.status === "all_deleted" || result.status === "partial_deleted") {
            showFloatingMessage(result.message, "success");             
        } else if (result.status === "not_found") {
            showFloatingMessage(result.message, "warning");
        } else if (result.status === "error") {
            showFloatingMessage(result.message, "danger");
        }

        if (userId) {
            // S'il y a un utilisateur connecté à son compte
            // Appeler la fonction pour supprimer le livre de la collection dans la base de données
            await deleteBookFromCollections(userId, group, book, contentId);
        }

        // Mise à jour de l'affichage des livres téléchargés 
        await refreshDownloadedBooks(collectionId);

        // Récupération et mise à jour des positions dans le serveur et en local
        const order = await getDownloadedBookItemsOrder(collectionId);
        // Mettre à jour les positions en Serveur et local après la suppression
        await updateBookPositions(order);

        // Mise à jour de collection_last_update en Local et sur Serveur
        await updateCollectionLastUpdate();

        // Mettre à jour le style et les boutons des livres
        await refreshDownloadedBookOpacity();

        //alert(`Le livre "${book}" du groupe "${group}" a été supprimé avec succès.`);
    } catch (error) {
        console.error("Erreur lors de la suppression du livre :", error);
        showFloatingMessage("Une erreur est survenue lors de la suppression du livre.", "danger");
    }
}

// Supprimer livre de la collection de l'utilisateur sur la base de données
async function deleteBookFromCollections(userId, group, book, contentId = null) {
    if (userConnectedToServerAccount?.user?.id) { // Si l'utilisateur est connecté à son compte
        try {
            console.log("Tentative de Suppression du livre de la BD Serveur");
            const response = await fetch('rqt_user_collection_book_delete.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId, group, book, contentId }),
            });

            const data = await response.json();
            
            if (data.success) { 
                console.log(data.message);  // Message de succès
            } else {
                console.log(data.message);  // Message d'erreur
            }
        } catch (error) {
            console.log("Erreur lors de la suppression du livre :", error);
        }

    } else {
        console.warn("L'utilisateur n'est pas connecté en ligne. Le livre n'est pas supprimé du serveur. En attente de la prochaine synchronisation pour une suppression effective.");
    }
}

// Fonction pour télécharger les images d'un livre et les stocker dans IndexedDB
// Ou renvoyer une collection par défaut (Dìwàn 1)
async function getLocalCollections() {
    const db = await openIndexedDB();

    if (!db) {
        console.warn("Impossible d'accéder à IndexedDB.");
        return [];
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["metadata"], "readonly");
        const store = transaction.objectStore("metadata");

        const request = store.getAll();

        request.onsuccess = () => {
            const allBooks = request.result || [];

            // Utiliser un Map pour regrouper de façon unique
            const collectionsMap = new Map();

            allBooks.forEach(book => {
                const id = book.collection_id ?? 1; // Fallback si ID absent
                const title = book.collection_title ?? "Dìwàn 1";

                if (!collectionsMap.has(id)) {
                    collectionsMap.set(id, { id, name: title });
                }
            });

            // Retourne un tableau unique des collections
            const uniqueCollections = Array.from(collectionsMap.values());

            // (Optionnel) Trier par nom ou ID
            uniqueCollections.sort((a, b) => {
                return a.name.localeCompare(b.name);
            });

            resolve(uniqueCollections);
        };

        request.onerror = () => {
            console.error("Erreur lors de la lecture de IndexedDB.");
            resolve([]);
        };
    });
}

// Affiche le modal et retourne la collection sélectionnée (ou nouvelle) avant d'enregistrer
function promptUserForCollection(group = null, book = null) {
  return new Promise(async (resolve, reject) => {
    const modal = document.getElementById('collectionModal');
    const select = document.getElementById('collectionSelect');
    const newBtn = document.getElementById('newCollectionBtn');
    const saveBtn = document.getElementById('saveCollectionBtn');
    const cancelBtn = document.getElementById('cancelCollectionBtn');

    function closeModal(result) {
      modal.style.display = 'none';
      cleanup();
      resolve(result);
    }

    function cleanup() {
      newBtn.removeEventListener('click', onNew);
      saveBtn.removeEventListener('click', onSave);
      cancelBtn.removeEventListener('click', onCancel);
    }

    async function onNew() {
      const name = prompt('Nom de la nouvelle collection :');
      if (name) {
        // Récupérer l'option avec Max value
        const maxOption = Array.from(select.options).reduce((max, option) => {
          const value = parseInt(option.value, 10);
          return value > max ? value : max;
        }, 0);

        // Ajouter la nouvelle collection à la liste déroulante
        const option = document.createElement('option');
        // Valeur numérique suivant dans la liste
        option.value = maxOption + 1;
        option.textContent = name;
        select.appendChild(option);
        select.value = option.value; // Sélectionner la nouvelle collection
      }
    }

    function onSave() {
        // Sauvegarde de la collection sélectionnée
        const selectedOption = select.options[select.selectedIndex];
        if (selectedOption && selectedOption.value) {
            closeModal({
            collection_id: parseInt(selectedOption.value, 10),
            collection_title: selectedOption.textContent
            });
        } else {
            alert('Veuillez choisir ou créer une collection.');
        }
    }


    function onCancel() {
      closeModal(null);
    }

    newBtn.addEventListener('click', onNew);
    saveBtn.addEventListener('click', onSave);
    cancelBtn.addEventListener('click', onCancel);

    let activeOption = false; // Pour vérifier si une option est active

    // Remplir la liste de collections depuis le serveur
    if (userConnectedToServerAccount?.user?.id) {   
        try {
        const resp = await fetch('rqt_user_collection_list_get.php');
        const cols = await resp.json(); // tableau de { id, name }
        select.innerHTML = '<option value="">-- choisir une collection --</option>';        
        cols.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;            
            if (!activeOption) {
                opt.selected = true; // Sélectionner la première collection par défaut
                activeOption = true; // Marquer qu'une option est active                
            }
            opt.textContent = c.name;
            // Ajouter l'option à la liste déroulante
            select.appendChild(opt);
        });
        } catch(err) {
        console.error('Erreur chargement des collections', err);
        select.innerHTML = '<option value="">Erreur</option>';
        }
    } else {
        // Si l'utilisateur n'est pas connecté et en ligne, récupérer les collections locales
        const localCollections = await getLocalCollections(); // Fonction à implémenter pour récupérer les collections locales

        if (localCollections && localCollections.length > 0) {
            select.innerHTML = '<option value="">-- choisir une collection --</option>';
            localCollections.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id; // ou c.name selon la structure
                if (!activeOption) {
                    opt.selected = true; // Sélectionner la première collection par défaut
                    activeOption = true; // Marquer qu'une option est active                    
                }
                opt.textContent = c.name;
                select.appendChild(opt);
            });
        } else {
            // Si aucune collection locale et serveur, afficher une option par défaut
            select.innerHTML = '<option value="">-- Choisir une collection --</option>';
            const opt = document.createElement('option');
            opt.value = 1; // ID par défaut
            if (!activeOption) {
                opt.selected = true; // Sélectionner la première collection par défaut
                activeOption = true; // Marquer qu'une option est active                
            }
            opt.textContent = 'Dìwàn 1'; // Nom par défaut
            select.appendChild(opt);
        }
    }

    // Mettre à jour le message du modal
    const msg = document.getElementById('collectionModalMessage');
    if (msg) {
    msg.textContent = `Dans quelle collection souhaitez-vous enregistrer le livre "${book ?? 'inconnu'}" ?`;
    }

    // Afficher le modal
    modal.style.display = 'flex';
  });
}

// Fonction pour télécharger et stocker les images dans IndexedDB
async function downloadBookImages(group, book, position = null, collectionContentId = null, collectionId = null, collectionTitle = null, duplicatedBook = false) {
    group?.trim();
    book?.trim();

    // Si c'est un téléchargement
    if (!duplicatedBook) {
        // Si c'est pas pour une synchronisation Server-Local
        const chosen = await promptUserForCollection(group, book);
        if (!chosen) return; // Annulé
        // Si l'utilisateur a choisi une collection ou en a créé une
        collectionId = chosen.collection_id; // ID de la collection choisie
        collectionTitle = chosen.collection_title; // Titre de la collection choisie
    }
    
    // Vérifier la connexion au serveur
    const isOnline = appConnectedToWebServer;

    if (isOnline) {
        // Télécharger et stocker les images dans IndexedDB
        const result = await storeBookImagesInIndexedDB(group, book, collectionContentId, collectionId, collectionTitle, position);
        // Récupérer lastInsertedId et lastInsertedPosition renvoyés par storeBookImagesInIndexedDB
        let lastInsertedId, lastInsertedPosition;
        if (result) {
            showFloatingMessage(`${book} téléchargé avec succès.`, 'success');
            const { id, position } = result;
            lastInsertedId = id;
            lastInsertedPosition = position;
        } else {
            showFloatingMessage(`Erreur lors du téléchargement de ${book}.`, 'danger');
        }

        // Mettre à jour la collection de l'utilisateur si connecté et en ligne avec l'ID (si reçu)
        await addBookToUserCollection(group, book, collectionId, collectionTitle, lastInsertedId, lastInsertedPosition);  

        // Mise à jour de l'affichage des livres téléchargés
        await refreshDownloadedBooks(collectionId);

        // Récupération et mise à jour des positions dans le serveur et en local
        const order = await getDownloadedBookItemsOrder(collectionId);
        // Mettre à jour les positions en Serveur et local après le téléchargement
        await updateBookPositions(order);

        // Mise à jour de collection_last_update en Local et sur Serveur
        await updateCollectionLastUpdate(); 

        // Mettre à jour le style et les boutons des livres
        await refreshDownloadedBookOpacity();

    } else {
        showFloatingMessage("Action non autorisée. Vous êtes hors connexion", "warning");
    }
}

// Fonction JS pour récupérer la config d'un livre
async function getBookInfos(group, book) {
    const isOnline = appConnectedToWebServer; // Connexion au serveur
    if (isOnline) {
        try {
            const response = await fetch(`rqt_book_config_get.php?group=${encodeURIComponent(group)}&book=${encodeURIComponent(book)}`);
            const result = await response.json();
    
            return result;
        } catch (error) {
            console.error("Erreur lors de la récupération du fichier config.json :", error);
            return null;
        }
    } else {
        return await getBookInfosOffline(group, book); // version hors-ligne
    }
}

// RÉCUPÉRER LES INFOS DU LIVRES EN HORS LIGNE
async function getBookInfosOffline(group, book) {
    const allMetadata = await getAllMetadata();

    // Chercher la configuration correspondante
    const found = allMetadata.find(meta => meta.group === group && meta.book === book);

    if (!found) {
        console.warn(`Aucune configuration trouvée pour ${group}/${book} dans IndexedDB.`);
        return {
            group,
            book,
            arabicName: '',
            author: '',
            translator: '',
            voice: '',
            lang: 'ar',
            trans: '',
            type: ''
        };
    }

    return {
        group: found.group,
        name: found.book,
        arabicName: found.arabicName || '',
        author: found.author || '',
        translator: found.translator || '',
        voice: found.voice || '',
        lang: found.lang === 'ar' ? 'ar' : 'noar',
        trans: found.trans || '',
        type: found.type || ''
    };
}

/**
 * Fonction pour ajouter le livre téléchargé à la 
 * collection de l'utilisateur sur la BD Serveur
 * @param {string} group // Group du livre
 * @param {string} book  // Nom du livre
 * @param {number} position // Indique c'est un ajout Mise à jour
 */
async function addBookToUserCollection(group, book, collectionId = null, collectionTitle = null, contenId = null, position = null) {
    if (userConnectedToServerAccount?.user?.id) {
        console.log("Utilisateur connecté, tentative d'ajout du livre à la collection...");
        console.log(`ID:, ${contenId}`);
        const userId = userConnectedToServerAccount?.user?.id || null;

        try {
            // Récupérer les infos du livre
            const { lang, arabicName, author, translator, voice, trans, type } = await getBookInfos(group, book);
            
            // Envoyer une requête pour ajouter le livre à la collection de l'utilisateur
            const response = await fetch('rqt_user_collection_book_add_sync.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId, collectionId, collectionTitle, contenId, group, book, position, lang, arabicName, author, translator, voice, trans, type }),
            });

            const result = await response.json();

            if (result.success) {
                console.log("Le livre a été ajouté avec succès à la collection de l'utilisateur.");
            } else {
                console.error("Erreur lors de l'ajout du livre à la collection:", result.message);
            }
        } catch (error) {
            console.error("Erreur réseau lors de l'ajout du livre à la collection:", error);
        }
    } else {
        console.warn("L'utilisateur n'est pas connecté. Le livre ne sera pas ajouté à la collection de l'utilisateur sur le serveur.");
    }
}

// Mettre à jour collection_last_update dans la table users et le localStorage
async function updateCollectionLastUpdate() {
    const now = new Date();
    const currentDateTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    // Mise à jour dans la base de données si l'utilisateur est connecté
    if (userConnectedToServerAccount?.user?.id) {
        const userId = userConnectedToServerAccount.user.id;

        try {
            const response = await fetch('rqt_user_collection_last_update_set.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: userId,
                    collection_last_update: currentDateTime,
                }),
            });

            const data = await response.json();

            if (data.success) {
                console.log("Mise à jour de collection_last_update réussie dans la base de données");
            } else {
                console.error("Échec de la mise à jour de last_update :", data.message);
            }
        } catch (error) {
            console.error("Erreur lors de la mise à jour de last_update :", error);
        }
    }

    // Mise à jour de last_update dans le localStorage
    const userSession = JSON.parse(localStorage.getItem('userSession') || '{}');
    localStorage.setItem('userSession', JSON.stringify({
        ...userSession,
        user: {
            ...userSession.user,
            collection_last_update: currentDateTime,
        },
    }));

    console.log("Mise à jour de collection_last_update dans le localStorage :", currentDateTime);
}

// Ajout d'un écouteur délégué au conteneur des livres
document.getElementById('diplay-book-list-area').addEventListener('click', async (event) => {
    // Vérifie si l'élément cliqué est un bouton de téléchargement
    if (event.target.closest('.bookDownloadButton')) {
        event.preventDefault();

        // Récupère le bouton cliqué
        const button = event.target.closest('.bookDownloadButton');

        // Récupère le groupe et le livre associés au bouton cliqué
        const bookItem = button.closest('.bookItem');
        
        // Récupère les infos du livre
        const bookLink = bookItem.querySelector('a');
        const group = bookLink.getAttribute('data-group-name').trim();
        const book = bookLink.getAttribute('data-book-name').trim(); // Depuis le dataSet
        const arabicName = bookLink.getAttribute('data-book-arabic-name').trim(); // Depuis le dataSet
        const lang = bookLink.getAttribute('data-book-lang').trim(); // Depuis le dataSet
        const author = bookLink.getAttribute('data-book-author').trim(); // Depuis le dataSet
        const translator = bookLink.getAttribute('data-book-translator').trim(); // Depuis le dataSet
        const voice = bookLink.getAttribute('data-book-voice').trim(); // Depuis le dataSet

        try {
            // Installer l'application d'abord 
            await installApp();

            // Vérifier la connexion au serveur (exécution asynchrone)
            const isOnline = appConnectedToWebServer;

            if (isOnline) {
                // Appelle la fonction de téléchargement pour le livre spécifique
                await downloadBookImages(group, book);
            } else {
                showFloatingMessage("Vous êtes hors ligne. Connectez-vous et télécharger ce livre pour pouvoir le lire sans connexion internet.", "info");
            }
        } catch (error) {
            console.error("Erreur lors du téléchargement du livre :", error);
        }
    }

    // Vérifie si l'élément cliqué est un bouton de duplication
    if (event.target.closest('.bookDuplicateButton')) {
        event.preventDefault();

        // Récupère le bouton cliqué
        const button = event.target.closest('.bookDuplicateButton');

        // Récupère le groupe et le livre associés au bouton cliqué
        const bookItem = button.closest('.bookItem');
        
        // Récupère les infos du livre
        const bookLink = bookItem.querySelector('a');
        const group = bookLink.getAttribute('data-group-name').trim();
        const book = bookLink.getAttribute('data-book-name').trim(); // Depuis le dataSet
        const collectionId = bookLink.getAttribute('data-collection-id')?.trim() || null; // ID de la collection
        const collectionTitle = bookLink.getAttribute('data-collection-title')?.trim() || null; // Titre de la collection
        const duplicatedBookPsition = getBookItemPosition(event.target); 
        console.log("Position du livre cliqué :", duplicatedBookPsition);

        try {
            // Installer l'application d'abord 
            await installApp();

            // Vérifier la connexion au serveur (exécution asynchrone)
            const isOnline = appConnectedToWebServer;

            if (isOnline) {
                // Appelle la fonction de téléchargement pour le livre spécifique
                await downloadBookImages(group, book, duplicatedBookPsition, null, collectionId, collectionTitle, true);
            } else {
                showFloatingMessage("Vous êtes hors ligne. Connectez-vous et télécharger ce livre pour pouvoir le lire sans connexion internet.", "info");
            }
        } catch (error) {
            console.error("Erreur lors du téléchargement du livre :", error);
        }
    }

    // Vérifie si l'élément cliqué est un bouton de suppression
    if (event.target.closest('.bookDeleteButton')) {
        event.preventDefault();

        // Récupère le bouton de suppression cliqué
        const deleteButton = event.target.closest('.bookDeleteButton');

        // Récupère le groupe et le livre associés au bouton de suppression
        const bookItem = deleteButton.closest('.bookItem');
        
        // Récupère le nom du livre et de son groupe depuis les attributs
        const bookLink = bookItem.querySelector('a');
        const group = bookLink.getAttribute('data-group-name').trim();
        const book = bookLink.getAttribute('data-book-name').trim(); 
        const collectionContentId = (bookLink.getAttribute('data-content-id') || '').trim() || null; 
        const collectionId = (bookLink.getAttribute('data-collection-id') || '').trim() || null;

        try {
            // Supprimer livre (images) de la BD
            await deleteBookImages(group, book, collectionContentId, collectionId);
        } catch (error) {
            console.error("Erreur lors de la suppression du livre :", error);
        }
    }

    /**
     *   Pour Faire tourner la flêche hide/Show 
     *    ajouter collapsed dynamiquement (bookList-header) Entêtes des listes
     */
    if (event.target.closest('.bookList-header')) {
        event.preventDefault();
        // Récupère l'entête de la liste cliquée
        const header = event.target.closest('.bookList-header');
        if (header) {
            // Basculer la classe 'collapsed' (tournéer flêche)
            header.classList.toggle('collapsed');
        }
    }
});

/**
 * Installe directement la PWA sans demander la confirmation de l'utilisateur si elle n'est pas encore installée.
 */
async function installApp() {
    // Vérifier si l'application est déjà installée
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    if (isInstalled) {
        console.log("L'application est déjà installée.");
        return; // Ne rien faire si l'application est déjà installée
    }

    if (deferredPrompt) {
        try {
            console.log("Installation en cours...");
            // Déclenche l'invite d'installation
            await deferredPrompt.prompt();

            // Résultat de l'utilisateur (accepté ou refusé)
            const choiceResult = await deferredPrompt.userChoice;

            if (choiceResult.outcome === 'accepted') {
                console.log("L'application a été installée avec succès.");
            } else {
                console.warn("L'utilisateur a refusé l'installation.");
            }

            // Réinitialiser deferredPrompt après utilisation
            deferredPrompt = null;
        } catch (error) {
            console.error("Erreur lors de l'installation de l'application :", error);
        }
    } else {
        console.warn("L'installation automatique n'est pas prise en charge ou l'événement beforeinstallprompt n'est pas disponible.");
    }
}

// Fonction pour synchroniser le marque-page entre localStorage et le serveur
async function syncLocalStorageMarkedPageWithServer() {
    const userSession = JSON.parse(localStorage.getItem('userSession') || '{}');

    if (userSession && userSession.loggedIn && userSession.user?.id) {
        const userId = userSession.user.id;

        try {
            // Étape 1 : Récupérer le marque-page depuis le serveur
            const serverResponse = await fetch('rqt_marked_page_get.php', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // Nécessaire pour transmettre les cookies (sessions)
            });

            const serverData = await serverResponse.json();

            if (serverData.error) {
                console.error("Erreur du serveur :", serverData.error);
                return;
            }

            // Vérifiez si `last_update` existe dans les données du serveur
            const serverLastUpdate = serverData.last_update ? new Date(serverData.last_update) : null;

            // Étape 2 : Récupérer les données locales
            const localLastUpdate = userSession.user?.last_update ? new Date(userSession.user.last_update) : null;

            // Étape 3 : Comparer les deux dates de mise à jour
            if (serverLastUpdate && localLastUpdate) {
                if (serverLastUpdate > localLastUpdate) {
                    // Serveur plus récent : Mettre à jour le localStorage
                    console.log("Mise à jour du marque-page local avec les données du serveur.");
                    userSession.user.group_name = serverData.group;
                    userSession.user.book = serverData.book;
                    userSession.user.lang = serverData.lang;
                    userSession.user.page = serverData.page;
                    userSession.user.last_update = serverData.last_update;
                    localStorage.setItem('userSession', JSON.stringify(userSession));
                } else if (serverLastUpdate < localLastUpdate) {
                    // Local plus récent : Mettre à jour le serveur
                    console.log("Mise à jour Marque-page du serveur avec les données locales."); 
                    await updateMarkedPageOnServer(userSession.user);
                } else {
                    console.log("Le marque-page local et le serveur sont déjà synchronisés.");
                }
            } else if (serverLastUpdate && !localLastUpdate) {
                // Aucun marque-page local : Utiliser les données du serveur
                console.log("Aucun marque-page local trouvé. Synchronisation avec le serveur.");
                userSession.user.group_name = serverData.group;
                userSession.user.book = serverData.book;
                userSession.user.lang = serverData.lang;
                userSession.user.page = serverData.page;
                userSession.user.last_update = serverData.last_update;
                localStorage.setItem('userSession', JSON.stringify(userSession));
            } else if (!serverLastUpdate && localLastUpdate) {
                // Aucun marque-page serveur : Mettre à jour le serveur
                console.log("Aucun marque-page serveur trouvé. Synchronisation avec le local.");
                await updateMarkedPageOnServer(userSession.user); 
            } else {
                console.log("Aucune donnée de marque-page disponible ni localement ni sur le serveur.");
            }
        } catch (error) {
            console.error("Erreur lors de la synchronisation du marque-page :", error);
        }
    } else {
        console.warn("Utilisateur non connecté ou session invalide.");
    }
}

// Fonction pour mettre à jour le localStorage avec les données utilisateur du serveur
async function updateLocalStorageWithUserDataFromServer() {
    if (userConnectedToServerAccount?.user?.id) {
    // Récupérer les nouvelles données users depuis Session (avec nouvelles données) 
    fetch('rqt_auth.php?action=session_check', {
        credentials: 'include' // ← Obligatoire pour récupérer la vraie session
    })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.user) {
                // Mettre à jour les infos user vers localStorage
                localStorage.removeItem('userSession');
                localStorage.setItem('userSession', JSON.stringify({ loggedIn: true, user: data.user }));
            } else {
                console.error('Erreur de mise à jour des infos en local: Session non disponible en ligne');
            }
        });        
    }
}

// Fonction pour mettre à jour le marque-page sur le serveur
async function updateMarkedPageOnServer(userData) {
    console.warn("Données local Marque-page:", userData);
    const { group_name: group, book, lang, page, last_update } = userData; // Récupérer les vars Marque Page
    // ajouter au tableau pour la requête
    const userMarkedPageDatas = {
        group: group,
        book: book,
        lang: lang,
        page: page,
        last_update: last_update
    };
    
    try {
        const response = await fetch('rqt_marked_page_set.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userMarkedPageDatas),
        });

        if (response.ok) {
            console.log("Marque-page mis à jour sur le serveur avec succès.");
        } else {
            console.error("Erreur lors de la mise à jour du marque-page sur le serveur.");
        }
    } catch (error) {
        console.error("Erreur lors de la mise à jour du marque-page sur le serveur :", error);
    }
}

// Fonction principale pour comparer les deux last_update et synchroniser les livres
async function syncIndexedDBWithServer(userId) {
    try {
        // Récupérer le last_update du serveur via une requête
        const serverResponse = await fetch(`rqt_user_collection_last_update_get.php`);
        const serverData = await serverResponse.json();

        const serverLastUpdate = serverData?.last_update ? new Date(serverData.last_update) : null; // Format serveur
        console.log("Dernière mise à jour du serveur :", serverLastUpdate); 

        // Récupérer le last_update local depuis localStorage
        const localUserSession = JSON.parse(localStorage.getItem('userSession') || '{}');
        const localLastUpdate = localUserSession?.user?.last_update 
            ? new Date(localUserSession.user.collection_last_update) 
            : null;

        console.log("Dernière mise à jour locale :", localLastUpdate);

        // Comparaison des deux dates
        if ((serverLastUpdate > localLastUpdate) || !localLastUpdate) {
            console.log("Le serveur est plus récent. Synchronisation depuis le serveur.");
            await syncBooksFromServer(userId); // Télchargement des livres du serveur (assez pour synchroniser) 
            
        } else if ((serverLastUpdate < localLastUpdate) || !serverLastUpdate) {
            console.log("Le local est plus récent. Synchronisation vers le serveur.");
            await syncBooksToServer(userId);
        
            console.log("Vérification des images des livres locaux depuis le serveur...");
            await updateBookImagesInIndexedDb(); // Pour s'assurer que les images sont complètes
        }

    } catch (error) {
        console.error("Erreur lors de la synchronisation des livres :", error);
    }
}

// Fonction pour vérifier et synchroniser les livres entre le serveur et le stockage local
async function checkAndSyncUserInfosAndBooks() {
    // Gestion de la synchronisation des infos et livres de l'utilisateur en ligne
    if (userConnectedToServerAccount?.user?.id) {
        const userId = userConnectedToServerAccount.user.id || null;
        const localUserData = JSON.parse(localStorage.getItem('userSession') || '{}');
        const localUserId = localUserData?.user?.id || null;

        // Si l'utilisateur local est le même que l'utilisateur connecté en ligne
        if (userId && localUserData && localUserId === userId) {     
            // Synchroniser infos utilisateur vers
            console.log("Synchronisation des infos utilisateurs.");
            await syncLocalStorageMarkedPageWithServer(); 

            // Synchroniser les livres
            console.log("Synchronisation des livres.");
            await syncIndexedDBWithServer(userId);
        } else if (!localUserData || !localUserId || localUserId !== userId) {
                console.log("L'utilisateur local et connecté différents ou u-local inexistant . Création nouvel utilisateur sur Loclstorage et synchronisation");
                // Enregistrer les informations de l'utilisateur dans le localStorage
                localStorage.setItem('userSession', JSON.stringify({ loggedIn: true, user: userConnectedToServerAccount.user }));            

                console.log("Ajout des livres sur indexDB");
                // Suppression de l'IndexedDB s'il existe
                await deleteIndexedDB();
                await syncBooksFromServer(userId); // Livres depuis BD vers indexDB
        }
    } else {
        console.warn("Utilisateur non connecté ou hors ligne. Aucune synchronisation effectuée.");
    }    
}
// Lancer la synchronisation initiale au démarrage
setInterval(checkAndSyncUserInfosAndBooks, 60000); // Vérifie toutes les (60000 ms)

// Fonction pour récupérer les livres du serveur
async function getServerBooksFromDb() {
    try {
        const response = await fetch(`rqt_user_downloaded_books_get.php`);
        const serverBooks = await response.json();

        if (!serverBooks || !Array.isArray(serverBooks)) {
            console.error("Réponse invalide reçue du serveur :", serverBooks);
            return [];
        }

        return serverBooks;
    } catch (error) {
        console.error("Erreur lors de la récupération des livres du serveur :", error);
        return [];
    }
}

// Fonction pour synchroniser les livres du serveur vers IndexedDB
async function syncBooksFromServer(userId) {
    try {
        // Obtenez les livres du serveur
        const serverBooks = await getServerBooksFromDb();

        // Tableau pour récupérer les collections mises à jour (contenant leur ID)
        const updatedCollections = new Set();

        if (serverBooks.length > 0) {
            // Obtenir les groupes et livres déjà stockés dans IndexedDB
            const localBooks = await getLocalBooksFromIndexedDB();

            // Télécharger les livres du serveur qui ne sont pas en local
            console.log("Synchronisation des livres depuis le serveur vers IndexedDB...");
            for (const { collection_id, collection_title, id, group, book, position } of serverBooks) {
                const bookExistsLocally = localBooks.some(
                    localBook => localBook.id === id && localBook.group === group && localBook.book === book
                );
                if (!bookExistsLocally) {
                    updatedCollections.add(collection_id); // Ajouter l'ID de la collection mise à jour

                    console.log(`Téléchargement du livre depuis le serveur : ${id}/${group}/${book}`);
                    // Enregistrer le livre dans IndexedDB
                    const result = await storeBookImagesInIndexedDB(group, book, id, collection_id, collection_title, position);
                    if (result) {
                        console.log(`Livre ${group}/${book} ajouté avec succès à IndexedDB.`);
                    } else {
                        console.error(`Erreur lors de l'ajout du livre ${group}/${book} à IndexedDB.`);
                    }
                }
            }

            // Supprimer les livres locaux qui ne sont pas sur le serveur
            for (const localBook of localBooks) {
                const bookExistsOnServer = serverBooks.some(
                    serverBook =>
                        serverBook.id === localBook.id && serverBook.group === localBook.group && serverBook.book === localBook.book
                );
                if (!bookExistsOnServer) {
                    updatedCollections.add(localBook.collection_id); // Ajouter l'ID de la collection mise à jour
                
                    console.log(`Suppression du livre local qui n'existe pas sur le serveur : ${localBook.group}/${localBook.book}`);
                    await deleteBookImagesFromIndexedDB(localBook.group, localBook.book, localBook.id, localBook.collection_id);
                }
            }
        }

        // Mettre à jour les collections et positions des livres, s'il y a eu des mise à jour
        if (updatedCollections.size > 0) {
            console.log("Mise à jour des collections et positions des livres...");
            for (const updatedCollectionId of updatedCollections) {
                // Mise à jour de l'affichage des livres téléchargés 
                await refreshDownloadedBooks(updatedCollectionId);

                // Récupération des livres affichés et leurs positions calculés
                const order = await getDownloadedBookItemsOrder(updatedCollectionId);
                // Mettre à jour les positions en Serveur et local après la suppression
                await updateBookPositions(order);
            }

            // Mise à jour des l'opacité des livres téléchargés
            await refreshDownloadedBookOpacity();
            await refreshSearchedElementOpacity();
        }

        // Mettre à jour la date dernière MAJ de collection
        await updateCollectionLastUpdate();

    } catch (error) {
        console.error("Erreur lors de la synchronisation des livres depuis le serveur :", error);
    }
}

// Fonction pour récupérer tous les livres locaux depuis IndexedDB
async function getLocalBooksFromIndexedDB() { 
    const allMetadata = await getAllMetadata();
    
    const enrichedBooks = allMetadata.map(meta => ({
        collection_id: meta.collection_id || 1, // Fallback si ID absent
        collection_title: meta.collection_title || "Dìwàn 1", // Fallback si titre absent
        id: meta.id,
        group: meta.group,
        book: meta.book,
        position: meta.position ?? Infinity,
        arabicName: meta.arabicName || '',
        author: meta.author || '',
        translator: meta.translator || '',
        voice: meta.voice || '',
        lang: meta.lang || 'ar',
        trans: meta.trans || '',
        type: meta.type || ''
    })).sort((a, b) => a.position - b.position);

    return enrichedBooks;
}

// Récupère uniquement les livres locaux appartenant à une collection spécifique depuis IndexedDB
async function getCollectionBooksFromIndexedDB(collectionId) {
    const allMetadata = await getAllMetadata();

    // 🧠 Filtrer d'abord ceux qui appartiennent à la collection demandée
    const filtered = allMetadata.filter(meta => String(meta.collection_id) === String(collectionId));

    // 🛠 Enrichir + trier les livres filtrés
    const enrichedBooks = filtered.map(meta => ({
        collection_id: meta.collection_id || 1,
        collection_title: meta.collection_title || "Dìwàn 1",
        id: meta.id,
        group: meta.group,
        book: meta.book,
        position: meta.position ?? Infinity,
        arabicName: meta.arabicName || '',
        author: meta.author || '',
        translator: meta.translator || '',
        voice: meta.voice || '',
        lang: meta.lang || 'ar',
        trans: meta.trans || '',
        type: meta.type || ''
    })).sort((a, b) => a.position - b.position);

    return enrichedBooks;
}

// Récupérer les livres d'une collection spécifique depuis le serveur
async function getCollectionFromServer(collectionId) {
    try {
        const response = await fetch(`rqt_user_collection_books_get.php?collection_id=${collectionId}`);
        const serverBooks = await response.json();

        if (!Array.isArray(serverBooks)) return [];

        return serverBooks.map(meta => ({
            collection_id: meta.collection_id ?? 1,
            collection_title: meta.collection_title ?? "Dìwàn 1",
            id: meta.id,
            group: meta.group,
            book: meta.book,
            position: meta.position ?? Infinity,
            arabicName: meta.arabicName || '',
            author: meta.author || '',
            translator: meta.translator || '',
            voice: meta.voice || '',
            lang: meta.lang || 'ar',
            trans: meta.trans || '',
            type: meta.type || ''
        }));
    } catch (err) {
        console.error("Erreur lors de la récupération des livres depuis le serveur :", err);
        return [];
    }
}

// Fonction pour synchroniser les livres locaux vers le serveur
async function syncBooksToServer(userId) {
    console.log("Synchronisation des livres locaux vers le serveur...");
    try {
        const localBooks = await getLocalBooksFromIndexedDB(); // await getAllMetadata(); 
        console.log("Livres locaux récupérés :", localBooks);
        
        // Étape 1 : Ajouter les livres locaux au serveur
        if (localBooks.length > 0) {
            const serverBooks = await getServerBooksFromDb(); // Récupérer les livres du serveur

            console.log("Livres du serveur récupérés :", serverBooks);
            for (const localBook of localBooks) {
                const bookExistsOnServer = serverBooks.some(serverBook => 
                    serverBook.id === localBook.id && serverBook.group === localBook.group && serverBook.book === localBook.book
                );

                if (!bookExistsOnServer) {
                    console.log(`Ajout du livre local manquant au serveur : ${localBook.group}/${localBook.book}`);
                    await addBookToUserCollection(localBook.group, localBook.book, localBook.collection_id, localBook.collection_title, localBook.id, localBook.position);
                }
            }

            // Étape 2 : Supprimer les livres du serveur qui ne sont pas en local
            console.log("Suppression des livres serveur non présents en local après synchronisation...");
            for (const serverBook of serverBooks) {
                const bookExistsLocally = localBooks.some(localBook => 
                    localBook.id === serverBook.id && localBook.group === serverBook.group && localBook.book === serverBook.book
                );

                if (!bookExistsLocally) {
                    console.log(`Suppression du livre serveur non présent en local : ${serverBook.group}/${serverBook.book}`);
                    await deleteBookFromCollections(userId, serverBook.group, serverBook.book, serverBook.id);
                }
            }
        } else {
            console.log("Aucun livre local trouvé. Les livres serveur ne seront pas modifiés.");
        }
    } catch (error) {
        console.error("Erreur lors de la synchronisation des livres locaux vers le serveur :", error);
    }
}

// Fonction principale : met en évidence les mots exacts Allah, Muhammad, Khadim
async function highlightSacredNames() {
    $('.bookName:not(#found-books .bookName)').each(function () {
        const element = $(this);
        const text = element.text();

        // Divise le texte en mots en gardant la ponctuation séparée
        const words = text.split(/(\s+|[.,;!?()])/); // garde les séparateurs

        // Reconstruit le texte avec mise en évidence
        const highlightedText = words.map(word => {
            const normalized = normalizeText(word);

            if (["الله", "allah", "allahu", "بالله", "والله", "تالله", "لله"].includes(normalized)) {
                return `<span style="color:red; font-weight:bold">${word}</span>`;
            }

            if ([
                "محمد", "mouhammad", "mouhammadun", "mouhammadoun", "mouhammadan", "mouhammadin",
                "muhammadu", "muhammadan", "muhammadin", "muhammadun", "mouhamad", "mahomet", "mohammed", 
                "mohamed", "mohammad", "muhammad", "muhamad",
            ].includes(normalized)) {
                return `<span style="color:blue; font-weight:bold">${word}</span>`;
            }

            if (["خديم", "khadim", "khadimi", "khadimu", "khadimou", "xadim", "xadimu", "xadimou", "xadimi", "الخديم"].includes(normalized)) {
                return `<span style="color:green; font-weight:bold">${word}</span>`;
            }

            return word;
        }).join('');

        element.html(highlightedText);
    });
}

// Créatrice des éléments de liste lors d'affichage de livre
async function createBookItem(group, book, lang, collectionId = null, collectionTitle = null, contentId = null, displayDownloadedBooks = null, downloadBookPosition = null) {
    const bookItem = document.createElement("span");
    bookItem.className = "list-group-item list-group-item-action bookItem";

    // Conteneur Boutons de téléchargement, suppression et tri
    const DownDelBtnGroup = document.createElement("span");
    DownDelBtnGroup.className = "DownDelBtnGroup";
    // Bouton de téléchargement
    const downloadButton = document.createElement("span");
    downloadButton.className = "bookDownloadButton";
    downloadButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="green" class="bi bi-arrow-down-circle" viewBox="0 0 16 16">
        <path fill-rule="evenodd" d="M1 8a7 7 0 1 0 14 0A7 7 0 0 0 1 8m15 0A8 8 0 1 1 0 8a8 8 0 0 1 16 0M8.5 4.5a.5.5 0 0 0-1 0v5.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293z"/>
        </svg>
        `;
    // Bouton de suppression
    const deleteButton = document.createElement("span");
    deleteButton.className = "bookDeleteButton";
    deleteButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="red" class="bi bi-x-circle" viewBox="0 0 16 16">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/>
        </svg>
        `;
    // Ajouter les boutons svg groupés sur leur conteneur
    DownDelBtnGroup.appendChild(downloadButton);
    DownDelBtnGroup.appendChild(deleteButton);

    // Ajout d'une première poignée de tri (Vers bas)
    const dragHandleDown = document.createElement("span");
    dragHandleDown.className = "dragHandle";
    dragHandleDown.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="blue" class="bi bi-arrow-down" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1"/>
        </svg>
    `;
    // Ajout d'une poignée de tri (milieu)
    const dragHandle = document.createElement("span");
    dragHandle.className = "dragHandle";
    dragHandle.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="blue" class="bi bi-arrow-down-up" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M11.5 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L11 2.707V14.5a.5.5 0 0 0 .5.5m-7-14a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L4 13.293V1.5a.5.5 0 0 1 .5-.5"/>
        </svg>
    `;
    // Ajout d'une dernière poignée de tri (Vers haut)
    const dragHandleUp = document.createElement("span");
    dragHandleUp.className = "dragHandle";
    dragHandleUp.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="blue" class="bi bi-arrow-up" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M8 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L7.5 2.707V14.5a.5.5 0 0 0 .5.5"/>
        </svg>
    `;

    // Boutons duplication
    const duplicateButton = document.createElement("span");
    duplicateButton.className = "bookDuplicateButton";
    duplicateButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-copy" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1z"/>
        </svg>
    `;

    // Récupérer les infos complètes du livre
    const bookInfos = await getBookInfos(group, book); 
    
    // Lien vers le livre
    const bookLink = document.createElement("a");
    bookLink.href = "#";
    bookLink.className = "flex-grow-1 bookLink";
    bookLink.style = "color: black; text-decoration: none;";
    bookLink.style.direction = isArabic(book) ? "rtl" : "ltr"; // Direction du texte 
    bookLink.setAttribute('data-group-name', group);
    bookLink.setAttribute('data-book-name', book);
    bookLink.setAttribute('data-book-lang', lang);
    bookLink.setAttribute('data-book-arabic-name', bookInfos.arabicName);
    bookLink.setAttribute('data-book-author', bookInfos.author);
    bookLink.setAttribute('data-book-translator', bookInfos.translator);
    bookLink.setAttribute('data-book-voice', bookInfos.voice);
    bookLink.setAttribute('data-book-trans', bookInfos.trans);
    bookLink.setAttribute('data-book-type', bookInfos.type);
    if (contentId) {
        bookLink.setAttribute('data-content-id', contentId);
    }
    if (collectionId) {
        bookLink.setAttribute('data-collection-id', collectionId);          
    }
    if (collectionTitle) {
        bookLink.setAttribute('data-collection-title', collectionTitle);
    }
    bookLink.onclick = () => loadImages(group, book, lang); // Chargeur d'images

    // Span du Nom Latin
    const bookNameLatinSpan = document.createElement("span");
    bookNameLatinSpan.className = "bookName bookNameLatin";
    bookNameLatinSpan.innerHTML = book;
    // Span du Nom Arabe
    const bookNameArabicSpan = document.createElement("span");
    bookNameArabicSpan.className = "bookName bookNameArabic";
    bookNameArabicSpan.innerHTML = bookInfos?.arabicName || '';

    // Ajout au lien
    bookLink.appendChild(bookNameLatinSpan);
    bookLink.appendChild(bookNameArabicSpan);
    
    if (displayDownloadedBooks) {
        // Si on crée l'élément pour les livres téléchargés
        downloadButton.style.display = 'none';   
        deleteButton.style.display = "inline-block";

        // Ajout du bouton de duplication
        bookItem.appendChild(duplicateButton);

        // Handler (tri) enfants au bookItem
        bookItem.classList.add("downloadedBookItem");
        // Ajout des poignées de tri
        if (downloadBookPosition === 'first') {
            // Si c'est le premier - mettre le svg arrow-down
            DownDelBtnGroup.appendChild(dragHandleDown);
        } else if (downloadBookPosition === 'last') {
            // Si c'est le dernier - mettre le svg arrow-Up
            DownDelBtnGroup.appendChild(dragHandleUp);
        } else if (downloadBookPosition === 'middle') {
            // Sinon si c'est un élément du milieu - mettre le svg arrow-down-up
            DownDelBtnGroup.appendChild(dragHandle);   
        } 
            // Sinon pas de bouton de tri

    } else {
        // Si on crée l'élément dans les livres téléchargés
        downloadButton.style.display = 'none';   
        deleteButton.style.display = "none";
    }   
    
    // Ajouter les éléments enfants au bookItem
    bookItem.appendChild(DownDelBtnGroup);
    //bookItem.appendChild(deleteButton);
    bookItem.appendChild(bookLink);  

    return bookItem;
}

// Fonction pour rafraîchir la liste des livres téléchargés d'une collection spécifique ou de toutes les collections
async function refreshDownloadedBooks(collectionGroupId = null) {
    const downloadsGroup = document.getElementById("downloadedBooksGroup");

    const allGroupLists = downloadsGroup.querySelectorAll(".groupListForUser");

    // Si aucune collection spécifique n'est ciblée, on vide toute la liste
    if (!collectionGroupId || allGroupLists.length === 0) {
        downloadsGroup.innerHTML = "";
    }

    // Récupération des livres depuis IndexedDB
    let books = await getLocalBooksFromIndexedDB();

    // Si aucun livre trouvé localement et que l'utilisateur est connecté, on essaie de récupérer depuis le serveur
    if ((!books || books.length === 0) && userConnectedToServerAccount?.user?.id) {
        try {
            let books = await getServerBooksFromDb();

            if (!Array.isArray(books) || books.length === 0) {
                books = []; // Gestion propre : tableau vide
            } else {
                console.log(`Livres récupérés depuis le serveur : ${books.length} trouvés.`);
            }
        } catch (err) {
            console.error("Erreur lors de la récupération des livres depuis le serveur :", err);
            books = [];
        }
    }

    // Si toujours aucun livre, afficher un message d'information
    if (!books || books.length === 0) {
        const noBookDiv = document.createElement('div');
        noBookDiv.classList.add('noBookDiv', 'bg-white', 'text-black', 'text-center', 'p-3', 'fw-bold');
        noBookDiv.style = "user-select: none;"; // Style pour le message
        noBookDiv.textContent = "Téléchargez vos livres préférés pour les lire sans connexion internet";
        const noBookchildDiv = document.createElement('div');
        noBookchildDiv.classList.add('noBookchildDiv', 'text-muted', 'mt-2', 'fst-italic');
        noBookchildDiv.style = "user-select: none;"; // Style pour le message enfant
        noBookchildDiv.textContent = "Aucun livre téléchargé pour le moment";
        // Ajouter un message d'information
        noBookDiv.appendChild(noBookchildDiv);
        // Ajouter un message d'information pour les livres téléchargés
        noBookDiv.style.marginTop = "20px"; // Ajouter un peu d'espace en haut
        noBookDiv.style.marginBottom = "20px"; // Ajouter un peu d'espace en bas

        // Vidage du groupe de téléchargements
        downloadsGroup.innerHTML = ""; // Vider le groupe de téléchargements
        // Ajouter le message d'information
        downloadsGroup.appendChild(noBookDiv);
        return;
    }

    // Grouper les livres par collection_id
    const grouped = {};
    for (const book of books) {
        const cid = book.collection_id ?? 1;
        const title = book.collection_title ?? "Dìwàn 1";
        if (!grouped[cid]) grouped[cid] = { title, books: [] };
        grouped[cid].books.push(book);
    }

    // Parcourir les groupes de collections
    for (const [collection_id, { title: collection_title, books }] of Object.entries(grouped)) {
        // Si une collection spécifique est demandée, ignorer les autres
        if (collectionGroupId && parseInt(collection_id) !== parseInt(collectionGroupId)) continue;

        // Vérifier si le groupe existe déjà dans le DOM
        let groupContainer = downloadsGroup.querySelector(`.groupListForUser[data-collection-id="${collection_id}"]`);
        let bookList;

        // Ne pas afficher les collections sans livre
        if (!books || books.length === 0) {
            if (groupContainer && downloadsGroup.contains(groupContainer)) {
                downloadsGroup.removeChild(groupContainer);
            }
            continue;
        }

        // Si le groupe existe déjà, on le met à jour
        if (groupContainer) {
            // 🔁 Groupe déjà présent : on met à jour uniquement la liste de livres
            bookList = groupContainer.querySelector(".downloadedBookList");
            if (bookList) bookList.innerHTML = ""; // Vider l’ancienne liste
        } else {
            // ➕ Nouveau groupe à créer (cas général ou ajout dynamique)
            groupContainer = document.createElement("div");
            groupContainer.className = "list-group-item list-group-item-action groupList groupListForUser p-0 mb-3";
            groupContainer.style = "background-color: #130a4d; color: white; border: 2px;";
            groupContainer.setAttribute("data-collection-id", collection_id);
            groupContainer.setAttribute("data-collection-title", collection_title);

            const header = document.createElement("h6");
            header.className = "downloadedBookList-header mb-1 d-flex align-items-center justify-content-between";
            header.innerHTML = `
                <span class="flex-grow-1" onclick="toggleBookList(this)">
                    📚 ${collection_title}
                </span>
                <span class="loadCollectionButton pb-1" title="Lire tout" onclick="loadCollection(${collection_id});">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="green" class="bi bi-skip-start-circle" viewBox="0 0 16 16">
                        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
                        <path d="M10.229 5.055a.5.5 0 0 0-.52.038L7 7.028V5.5a.5.5 0 0 0-1 0v5a.5.5 0 0 0 1 0V8.972l2.71 1.935a.5.5 0 0 0 .79-.407v-5a.5.5 0 0 0-.271-.445"/>
                    </svg>
                </span>
            `;

            bookList = document.createElement("div");
            bookList.className = "list-group bookList downloadedBookList open";
            bookList.style = "background-color: #d9ffd9; opacity: 0.9;";
            bookList.id = `downloadedBookList-${collection_id}`;

            groupContainer.appendChild(header);
            groupContainer.appendChild(bookList);
            downloadsGroup.appendChild(groupContainer);
        }

        // Ajouter chaque livre au bookList
        const totalBooks = books.length;

        // Si on a des livres, on vide la liste avant de les ajouter
        if (bookList) bookList.innerHTML = ""; // Vider l’ancienne liste
        
        // Ajouter les livres à la liste 
        for (let i = 0; i < totalBooks; i++) {
            const book = books[i];
            let position = false;
            if (totalBooks > 1) {
                position = (i === 0) ? "first" : (i === totalBooks - 1) ? "last" : "middle";
            }

            const item = await createBookItem(
                book.group, book.book, book.lang,
                book.collection_id, book.collection_title, book.id,
                true, position
            );
            bookList.appendChild(item);
        }
    }

    // Activer tri ou effets visuels si disponibles
    enableSorting();
    highlightSacredNames?.();
}
refreshDownloadedBooks();
// Raffraîchissement de la liste des livres téléchargés toutes les 3 secondes
//setInterval(refreshDownloadedBooks, 3000);


// Activez le tri des livres téléchargés
async function enableSorting() {
    const listContainers = document.querySelectorAll(".downloadedBookList");
    document.querySelectorAll(".placeholder")?.forEach(p => p.remove());

    listContainers.forEach((listContainer) => {
        const collectionId = listContainer.closest(".groupListForUser")?.getAttribute("data-collection-id")?.trim() || null;
        if (!collectionId) return;

        setupDragForCollection(listContainer, collectionId);
    });

    function setupDragForCollection(listContainer, collectionId) {
        let draggingItem = null;
        let placeholder = null;
        let grabOffsetY = 0;

        const bookItems = listContainer.querySelectorAll(".downloadedBookItem");

        bookItems.forEach((item) => {
            const dragHandle = item.querySelector(".dragHandle");
            if (!dragHandle || dragHandle.dataset.dragInitialized === "true") return;
            dragHandle.dataset.dragInitialized = "true";

            const hammer = new Hammer(dragHandle);
            hammer.get("pan").set({ direction: Hammer.DIRECTION_VERTICAL });

            hammer.on("panstart", (ev) => {
                try {
                    listContainer.querySelectorAll(".placeholder")?.forEach(el => el.remove());

                    draggingItem = item;
                    placeholder = document.createElement("div");
                    placeholder.className = "placeholder";
                    placeholder.style.height = `${item.offsetHeight}px`;
                    placeholder.style.border = "2px dashed #ccc";

                    listContainer.insertBefore(placeholder, item.nextSibling);

                    const itemRect = item.getBoundingClientRect();
                    grabOffsetY = (ev.center.y - itemRect.top) - (itemRect.height / 8); // Ajustement de la largeur de décalage

                    item.style.position = "absolute";
                    item.style.zIndex = "1000";

                    // ❌ Ne pas bloquer le scroll (important)
                    // document.body.style.touchAction = "none";
                } catch (error) {
                    console.error("Erreur panstart:", error);
                    refreshDownloadedBooks(collectionId);
                }
            });

            hammer.on("panmove", (ev) => {
                try {
                    const rect = listContainer.getBoundingClientRect();
                    const itemHeight = item.offsetHeight;
                    const newTop = (ev.center.y - rect.top) - (grabOffsetY / 8); // Ajustement de la position pour décalage
                    const topLimit = 0;
                    const bottomLimit = rect.height - itemHeight;

                    item.style.top = `${Math.min(Math.max(newTop, topLimit), bottomLimit)}px`;

                    const children = Array.from(listContainer.children).filter(
                        (child) => child !== placeholder && child !== draggingItem
                    );

                    children.forEach((child) => {
                        const childRect = child.getBoundingClientRect();
                        const placeholderRect = placeholder.getBoundingClientRect();

                        if (
                            ev.center.y > childRect.top &&
                            ev.center.y < childRect.bottom &&
                            placeholderRect.top !== childRect.top
                        ) {
                            if (ev.center.y < childRect.top + child.offsetHeight / 2) {
                                listContainer.insertBefore(placeholder, child);
                            } else {
                                listContainer.insertBefore(placeholder, child.nextSibling);
                            }
                        }
                    });

                    // 🌟 Scroll automatique du parent scrollable 
                    const scrollableContainer = listContainer.closest("#downloadedBooksGroup") || document.documentElement;
                    const scrollThreshold = 40;
                    const scrollSpeed = 10;
                    const containerRect = scrollableContainer.getBoundingClientRect();

                    if (ev.center.y - containerRect.top < scrollThreshold) {
                        scrollableContainer.scrollTop -= scrollSpeed;
                    } else if (containerRect.bottom - ev.center.y < scrollThreshold) {
                        scrollableContainer.scrollTop += scrollSpeed;
                    }

                } catch (error) {
                    console.error("Erreur panmove:", error);
                    refreshDownloadedBooks(collectionId);
                }
            });

            hammer.on("panend", async () => {
                try {
                    if (placeholder) {
                        listContainer.insertBefore(draggingItem, placeholder);
                        placeholder.remove();
                        placeholder = null;
                    }

                    draggingItem.style.position = "";
                    draggingItem.style.zIndex = "";
                    draggingItem.style.top = "";
                    draggingItem = null;

                    const currentOrder = Array.from(listContainer.children)
                        .filter((child) => child.querySelector("a"))
                        .map((child, index) => {
                            const link = child.querySelector("a");
                            return {
                                group: link?.getAttribute("data-group-name")?.trim(),
                                book: link?.getAttribute("data-book-name")?.trim(),
                                id: link?.getAttribute("data-content-id")?.trim(),
                                collection_id: link?.getAttribute("data-collection-id")?.trim(),
                                collection_title: link?.getAttribute("data-collection-title")?.trim(),
                                position: index + 1,
                            };
                        }).filter(Boolean);

                    await updateBookPositions(currentOrder, true);
                    await refreshDownloadedBooks(collectionId);
                } catch (error) {
                    console.error("Erreur panend:", error);
                    refreshDownloadedBooks(collectionId);
                }
            });
        });

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") {
                draggingItem = null;
            }
        });
    }
}

// Fonction asynchrone pour récupérer l'ordre des éléments dans une collection ou toutes les collections
async function getDownloadedBookItemsOrder(collectionId = null) {
    const result = [];

    // Sélectionner toutes les listes de livres téléchargés par collection
    const allLists = document.querySelectorAll(".downloadedBookList");

    allLists.forEach((listContainer) => {
        const groupElement = listContainer.closest(".groupListForUser");
        if (!groupElement) return;

        const currentCollectionId = groupElement.getAttribute("data-collection-id")?.trim();
        if (!currentCollectionId) return;

        // Si un ID spécifique est demandé et ne correspond pas, on ignore
        if (collectionId !== null && currentCollectionId !== String(collectionId)) return;

        const bookItems = listContainer.querySelectorAll(".downloadedBookItem");

        const order = Array.from(bookItems).map((item, index) => {
            const bookLink = item.querySelector("a");
            if (!bookLink) return null;

            return {
                book: bookLink.getAttribute("data-book-name")?.trim() || '',
                group: bookLink.getAttribute("data-group-name")?.trim() || '',
                id: bookLink.getAttribute("data-content-id")?.trim() || '',
                collection_id: bookLink.getAttribute("data-collection-id")?.trim() || currentCollectionId,
                collection_title: bookLink.getAttribute("data-collection-title")?.trim() || '',
                // Position 1-indexée
                position: index + 1,
                collection_id: currentCollectionId
            };
        }).filter(entry => entry !== null);

        result.push(...order); // Ajoute au tableau global
    });

    if (result.length === 0) {
        console.warn("Aucun livre trouvé ou l'ordre est vide.");
        return null;
    }

    return result; // Tableau simple [{id, position, ...}, ...]
}

// Récupérer position exacte du livre à dupliquer
function getBookItemPosition(clickedButton) {
    // Trouver l'élément parent .downloadedBookItem
    const bookItem = clickedButton.closest('.downloadedBookItem');
    if (!bookItem) {
        console.warn("Élément parent .downloadedBookItem introuvable.");
        return null;
    }

    // Trouver tous les items dans l'ordre actuel
    const listContainer = bookItem.closest(".downloadedBookList");
    const allItems = Array.from(listContainer.querySelectorAll(".downloadedBookItem"));

    // Calculer la position (1-indexée)
    const position = allItems.indexOf(bookItem) + 1; // position 1-indéxée

    return position;
}

// Désactiver ou réactiver le(s) bouton(s) de lecture de collection
async function toggleLoadCollectionButton(disable, collectionId = null) {
    let buttons;

    if (collectionId !== null) {
        // Cibler un seul bouton
        buttons = document.querySelectorAll(
            `.groupListForUser[data-collection-id="${collectionId}"] .loadCollectionButton`
        );
    } else {
        // Cibler tous les boutons
        buttons = document.querySelectorAll(".loadCollectionButton");
    }

    buttons.forEach(btn => {
        if (btn) btn.disabled = disable;
    });
}

// Mettre à jour les positions des livres téléchargés (local et serveur)
async function updateBookPositions(orderedBooks, booksSorted = false) {
    if (!Array.isArray(orderedBooks) || orderedBooks.length === 0) {
        console.warn("orderedBooks est vide ou invalide:", orderedBooks);
        return;
    }

    await toggleLoadCollectionButton(true); 
    const db = await openIndexedDB();

    try {
        if (db) {
            const transaction = db.transaction(["metadata"], "readwrite");
            const store = transaction.objectStore("metadata");

            for (const book of orderedBooks) {
                const id = Number(book.id);
                const position = Number(book.position);

                await new Promise((resolve, reject) => {
                    const request = store.get(id);

                    request.onsuccess = (event) => {
                        const data = event.target.result;
                        if (data) {
                            data.position = position;
                            const updateRequest = store.put(data);
                            updateRequest.onsuccess = resolve;
                            updateRequest.onerror = reject;
                        } else {
                            console.warn(`Aucune donnée trouvée avec id=${id}`);
                            resolve(); // Continue la boucle même si aucun résultat
                        }
                    };

                    request.onerror = (event) => {
                        console.error(`Erreur lors de la récupération de l'élément id=${id}`);
                        reject(event.target.error);
                    };
                });
            }

            console.log("✅ Positions mises à jour dans IndexedDB (via id uniquement).");
        }

        // Mise à jour côté serveur
        if (userConnectedToServerAccount?.user?.id) {
            const userId = userConnectedToServerAccount.user.id;

            await fetch("rqt_user_collection_books_positions_update.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, books: orderedBooks }), // contient déjà id, position, etc.
            });

            console.log("✅ Positions mises à jour sur le serveur.");
        }

        if (booksSorted) {
            await updateCollectionLastUpdate();
        }

    } catch (error) {
        console.error("❌ Erreur lors de la mise à jour des positions :", error);
    }

    await toggleLoadCollectionButton(false);
}

document.addEventListener('DOMContentLoaded', () => {
    const isFirstVisit = !localStorage.getItem('visited');
    const showGuideBtn = document.querySelector('#showDemoBtn');

    function startTour() {
        const tour = new Shepherd.Tour({
            defaultStepOptions: {
                scrollTo: false,
                cancelIcon: { enabled: true },
                classes: 'shepherd-theme-arrows',
                modalOverlayOpeningPadding: 5,
                modalOverlayOpeningRadius: 5
            },
            useModalOverlay: true
        });

        const steps = [
            {
                title: '1. Ouvrir/Fermer le menu latéral',
                gif: '1-open-menu.gif',
                text: 'Ouvrir/fermer le menu latéral.'
            },
            {
                title: '2. Ouvrir un livre',
                gif: '2-open-book.gif',
                text: 'Cliquez sur un livre pour commencer la lecture.'
            },
            {
                title: '3. Navigation entre les pages',
                gif: '3-page-navigation.gif',
                text: 'Utilisez les flèches ou <strong>swipe</strong> pour naviguer entre les pages.'
            },
            {
                title: '4. Marquer une page',
                gif: '4-mark-page.gif',
                text: 'Marquez une page pour y revenir facilement.'
            },
            {
                title: '5. Retour vers la page marquée',
                gif: '5-show-marked-page.gif',
                text: 'Affichez la dernière page que vous avez marquée.'
            },
            {
                title: '6. Télécharger un livre',
                gif: '6-download-book.gif',
                text: 'Téléchargez un livre pour lecture hors ligne.'
            },
            {
                title: '7. Afficher livres téléchargés',
                gif: '7-show-downloaded-books.gif',
                text: 'Accédez à vos livres téléchargés.'
            },
            {
                title: '8. Trier et réorganiser votre collection',
                gif: '8-tree-downloaded-books.gif',
                text: 'Trier et réorganiser votre collection de livres téléchargés.'
            },
            {
                title: '9. Lire tous les livres téléchargés',
                gif: '9-read-all-dowloaded-books.gif',
                text: 'Lire toute la collection en même temps.'
            },
            {
                title: '10. Duppliquer un livre',
                gif: '10-duplicate-downloaded-book.gif',
                text: 'Dupliquez un livre téléchargé pour le lire plusieurs fois sans interruption.'
            },
            {
                title: '11. Supprimer un livre',
                gif: '11-delete-book.gif',
                text: 'Supprimez un livre téléchargé.'
            },
            {
                title: '12. Rechercher un livre',
                gif: '12-search.gif',
                text: 'Recherchez un livre par mot-clé.'
            },
            {
                title: '13. Revoir cette introduction',
                gif: '13-show-demo.gif',
                text: 'Cliquez ici pour relancer cette visite guidée.'
            },
            {
                title: '14. Connexion',
                gif: '14-login.gif',
                text: 'Connectez-vous pour synchroniser vos lectures.'
            },
            {
                title: '15. Installer l’application',
                gif: '15-install-app.gif',
                text: 'Installez cette app pour l’utiliser sans internet.'
            },
            {
                title: '16. Contact',
                gif: '16-contacts.gif',
                text: 'Contactez nous pour toute suggestion ou contribution.'
            }
        ];

        steps.forEach((step, index) => {
            tour.addStep({
                title: step.title,
                text: `
                    <div style="max-height: 400px; width:auto; overflow: auto;">
                        ${step.text}
                        <img src="assets/images/demo/${step.gif}" alt="${step.title}" style="width: 100%; max-height: 300px; margin-top: 5px; object-fit: contain;">
                    </div>
                `,
                buttons: [
                    {
                        text: 'Fermer',
                        action: tour.complete
                    },
                    ...(index > 0 ? [{
                        text: 'Précédent',
                        action: tour.back
                    }] : []),
                    ...(index < steps.length - 1 ? [{
                        text: 'Suivant',
                        action: tour.next
                    }] : [])
                ]
            });
        });

        tour.start();
    }

    if (isFirstVisit) {
        localStorage.setItem('visited', 'true');
        startTour();
    }

    showGuideBtn?.addEventListener('click', startTour);
});
