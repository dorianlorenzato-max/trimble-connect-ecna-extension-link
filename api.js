/**
 * Module pour la communication avec les APIs Trimble Connect.
 */

const CONFIG_FOLDER_NAME = "Configuration_Links";
const LINKS_CONFIG_FILENAME = "links-config.json";

// Récupère le rôle de l'utilisateur pour le projet actuel.

async function fetchUserProjectRole(currentProjectId, accessToken) {
  console.log("--- Début de la nouvelle méthode pour fetchUserProjectRole ---");
  console.log("ID du projet actuel à rechercher :", currentProjectId);

  // On utilise le nouvel endpoint /projects/me
  const url = `https://app21.connect.trimble.com/tc/api/2.0/projects/me`;
  console.log("Appel de l'endpoint général :", url);

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    console.log(
      "Réponse reçue du serveur. Statut :",
      response.status,
      response.statusText,
    );

    if (!response.ok) {
      // Si l'appel échoue, on essaie de lire le corps de l'erreur pour plus de détails
      const errorBody = await response.text();
      console.error(
        "Échec de l'appel à /projects/me. Corps de l'erreur :",
        errorBody,
      );
      throw new Error(
        `Échec de la récupération de la liste des projets. Statut: ${response.status}`,
      );
    }

    const allUserProjects = await response.json();
    console.log(
      `Données reçues. L'utilisateur a accès à ${allUserProjects.length} projet(s).`,
    );

    // On cherche le projet actuel dans la liste complète
    const currentProjectDetails = allUserProjects.find(
      (project) => project.id === currentProjectId,
    );

    if (currentProjectDetails) {
      console.log(
        "Projet correspondant trouvé dans la liste :",
        currentProjectDetails,
      );
      const userRole = currentProjectDetails.role;
      console.log("Rôle de l'utilisateur pour ce projet :", userRole);
      console.log("--- Fin de la méthode (SUCCÈS) ---");
      return userRole;
    } else {
      console.error(
        "ERREUR CRITIQUE : Le projet actuel n'a pas été trouvé dans la liste des projets retournée par /projects/me. L'utilisateur n'a peut-être pas les permissions de base sur ce projet.",
      );
      throw new Error(
        "Projet actuel non trouvé dans la liste de l'utilisateur.",
      );
    }
  } catch (error) {
    console.error(
      "Une erreur est survenue durant la nouvelle méthode fetchUserProjectRole :",
      error,
    );
    console.log("--- Fin de la méthode (ÉCHEC) ---");
    // On propage l'erreur pour que le bloc catch de main.js puisse l'afficher
    throw error;
  }
}

/**
 * Récupère l'ID du dossier racine du projet.
 * @param {object} triconnectAPI - L'instance de l'API Trimble Connect.
 * @param {string} accessToken - Le jeton d'accès.
 * @returns {Promise<string>} L'ID du dossier racine.
 */
async function getProjectRootId(triconnectAPI, accessToken) {
  const projectInfo = await triconnectAPI.project.getCurrentProject();
  const url = `https://app21.connect.trimble.com/tc/api/2.0/projects/${projectInfo.id}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error("Impossible de récupérer les détails complets du projet.");
  }
  const fullProjectInfo = await response.json();
  if (!fullProjectInfo.rootId) {
    throw new Error("Impossible de trouver l'ID du dossier racine (rootId).");
  }
  return fullProjectInfo.rootId;
}
/**
 * Trouve un dossier par son nom dans un dossier parent, ou le crée s'il n'existe pas.
 * @param {string} parentFolderId - L'ID du dossier parent où chercher/créer.
 * @param {string} folderName - Le nom du dossier à trouver ou créer.
 * @param {string} accessToken - Le jeton d'accès.
 * @returns {Promise<string>} L'ID du dossier trouvé ou nouvellement créé.
 */
async function findOrCreateFolder(parentFolderId, folderName, accessToken) {
  // 1. Chercher si le dossier existe déjà
  const itemsUrl = `https://app21.connect.trimble.com/tc/api/2.0/folders/${parentFolderId}/items`;
  const response = await fetch(itemsUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(
      `Impossible de lister le contenu du dossier parent (ID: ${parentFolderId}).`,
    );
  }
  const items = await response.json();
  const existingFolder = items.find(
    (item) => item.type === "FOLDER" && item.name === folderName,
  );

  if (existingFolder) {
    console.log(`Dossier "${folderName}" trouvé (ID: ${existingFolder.id}).`);
    return existingFolder.id; // Le dossier existe, on retourne son ID
  }

  // 2. S'il n'existe pas, on le crée
  console.log(`Dossier "${folderName}" non trouvé. Création en cours...`);
  const createUrl = `https://app21.connect.trimble.com/tc/api/2.0/folders`;
  const createResponse = await fetch(createUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ name: folderName, parentId: parentFolderId }),
  });

  if (!createResponse.ok) {
    throw new Error(`La création du dossier "${folderName}" a échoué.`);
  }
  const newFolder = await createResponse.json();
  console.log(
    `Dossier "${folderName}" créé avec succès (ID: ${newFolder.id}).`,
  );
  return newFolder.id;
}

/**
 * Lit le fichier de configuration des liens depuis Trimble Connect.
 * @param {string} accessToken - Le jeton d'accès.
 * @param {string} configFolderId - L'ID du dossier de configuration.
 * @returns {Promise<Array>} Une liste des liens configurés.
 */
async function fetchLinksConfiguration(accessToken, configFolderId) {
  const url = `https://app21.connect.trimble.com/tc/api/2.0/folders/${configFolderId}/items`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(
      "Impossible de lister le contenu du dossier de configuration.",
    );
  }
  const items = await response.json();
  const configFile = items.find((item) => item.name === LINKS_CONFIG_FILENAME);

  if (!configFile) {
    console.log(
      "Le fichier de configuration n'existe pas encore. Retourne une liste vide.",
    );
    return []; // Si le fichier n'existe pas, on retourne une liste vide.
  }

  // Si le fichier existe, on le télécharge et on retourne son contenu.
  const downloadUrlResponse = await fetch(
    `https://app21.connect.trimble.com/tc/api/2.0/files/fs/${configFile.id}/downloadurl`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  const downloadInfo = await downloadUrlResponse.json();
  const contentResponse = await fetch(downloadInfo.url);
  const links = await contentResponse.json();
  return links;
}
/**
 * Sauvegarde la configuration des liens dans un fichier JSON sur Trimble Connect.
 * @param {string} accessToken - Le jeton d'accès.
 * @param {string} configFolderId - L'ID du dossier de configuration.
 * @param {Array} linksData - Le tableau des liens à sauvegarder.
 * @returns {Promise<object>} Les détails du fichier sauvegardé.
 */
async function saveLinksConfiguration(accessToken, configFolderId, linksData) {
  const fileName = "links-config.json";
  const jsonString = JSON.stringify(linksData, null, 2);
  const fileBlob = new Blob([jsonString], { type: "application/json" });

  // 1. Initier l'upload
  const initiateUrl = `https://app21.connect.trimble.com/tc/api/2.0/files/fs/upload?parentId=${configFolderId}&parentType=FOLDER`;
  const initiateResponse = await fetch(initiateUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: fileName }),
  });
  if (!initiateResponse.ok)
    throw new Error("L'initiation de l'upload a échoué.");

  const uploadDetails = await initiateResponse.json();
  const finalUploadUrl = uploadDetails.contents[0].url;
  const uploadId = uploadDetails.uploadId;

  // 2. Uploader le contenu
  const uploadResponse = await fetch(finalUploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: fileBlob,
  });
  if (!uploadResponse.ok) throw new Error("L'upload du fichier a échoué.");

  // 3. Vérifier l'upload
  const verifyUrl = `https://app21.connect.trimble.com/tc/api/2.0/files/fs/upload?uploadId=${uploadId}&wait=true`;
  const verifyResponse = await fetch(verifyUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!verifyResponse.ok)
    throw new Error("La vérification de l'upload a échoué.");

  const finalFileDetails = await verifyResponse.json();
  if (finalFileDetails.status !== "DONE")
    throw new Error("Le traitement du fichier sur le serveur a échoué.");

  return finalFileDetails;
}

// Exporte les fonctions pour les rendre utilisables dans main.js
export {
  fetchUserProjectRole,
  fetchLinksConfiguration,
  getProjectRootId,
  findOrCreateFolder,
  saveLinksConfiguration,
};
