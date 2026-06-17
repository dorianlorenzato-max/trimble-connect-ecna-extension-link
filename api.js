/**
 * Module pour la communication avec les APIs Trimble Connect.
 */

const CONFIG_FOLDER_NAME = "Configuration_Links";
const LINKS_CONFIG_FILENAME = "links-config.json";

// Récupère le rôle de l'utilisateur pour le projet actuel.

async function fetchUserProjectRole(projectId, accessToken) {
  const url = `https://app21.connect.trimble.com/tc/api/2.0/projects/${projectId}/users/me`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error("Impossible de récupérer le rôle de l'utilisateur.");
  }
  const userDetails = await response.json();
  return userDetails.role;
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

// Exporte les fonctions pour les rendre utilisables dans main.js
export {
  fetchUserProjectRole,
  fetchLinksConfiguration,
  getProjectRootId,
  findOrCreateFolder,
};
