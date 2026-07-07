/**
 * Module pour la communication avec les APIs Trimble Connect.
 * Les URLs sont construites dynamiquement à partir d'une URL de base.
 */

const CONFIG_FOLDER_NAME = "Configuration_Links";
const LINKS_CONFIG_FILENAME = "links-config.json";

/**
 * Récupère le rôle de l'utilisateur pour le projet actuel.
 * @param {string} apiBaseUrl - L'URL de base de l'API REST de la région.
 * @param {string} projectId - L'ID du projet.
 * @param {string} accessToken - Le jeton d'accès.
 * @returns {Promise<string>} Le rôle de l'utilisateur ('ADMIN' ou 'USER').
 */
async function fetchUserProjectRole(apiBaseUrl, projectId, accessToken) {
  const url = `${apiBaseUrl}/projects/${projectId}/users/me`;
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
 * @param {string} apiBaseUrl - L'URL de base de l'API REST de la région.
 * @param {object} triconnectAPI - L'instance de l'API Trimble Connect.
 * @param {string} accessToken - Le jeton d'accès.
 * @returns {Promise<string>} L'ID du dossier racine.
 */
async function getProjectRootId(apiBaseUrl, triconnectAPI, accessToken) {
  const projectInfo = await triconnectAPI.project.getCurrentProject();
  const url = `${apiBaseUrl}/projects/${projectInfo.id}`;
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
 * @param {string} apiBaseUrl - L'URL de base de l'API REST de la région.
 * @param {string} parentFolderId - L'ID du dossier parent.
 * @param {string} folderName - Le nom du dossier à trouver ou créer.
 * @param {string} accessToken - Le jeton d'accès.
 * @returns {Promise<string>} L'ID du dossier trouvé ou créé.
 */
async function findOrCreateFolder(
  apiBaseUrl,
  parentFolderId,
  folderName,
  accessToken,
) {
  const itemsUrl = `${apiBaseUrl}/folders/${parentFolderId}/items`;
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
    return existingFolder.id;
  }

  const createUrl = `${apiBaseUrl}/folders`;
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
  return newFolder.id;
}

/**
 * Lit le fichier de configuration des liens depuis Trimble Connect.
 * @param {string} apiBaseUrl - L'URL de base de l'API REST de la région.
 * @param {string} accessToken - Le jeton d'accès.
 * @param {string} configFolderId - L'ID du dossier de configuration.
 * @returns {Promise<Array>} Une liste des liens configurés.
 */
async function fetchLinksConfiguration(
  apiBaseUrl,
  accessToken,
  configFolderId,
) {
  const url = `${apiBaseUrl}/folders/${configFolderId}/items`;
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
    return [];
  }

  const downloadUrlResponse = await fetch(
    `${apiBaseUrl}/files/fs/${configFile.id}/downloadurl`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  const downloadInfo = await downloadUrlResponse.json();
  const contentResponse = await fetch(downloadInfo.url);
  return await contentResponse.json();
}

/**
 * Sauvegarde la configuration des liens dans un fichier JSON sur Trimble Connect.
 * @param {string} apiBaseUrl - L'URL de base de l'API REST de la région.
 * @param {string} accessToken - Le jeton d'accès.
 * @param {string} configFolderId - L'ID du dossier de configuration.
 * @param {Array} linksData - Le tableau des liens à sauvegarder.
 * @returns {Promise<object>} Les détails du fichier sauvegardé.
 */
async function saveLinksConfiguration(
  apiBaseUrl,
  accessToken,
  configFolderId,
  linksData,
) {
  const fileName = LINKS_CONFIG_FILENAME;
  const jsonString = JSON.stringify(linksData, null, 2);
  const fileBlob = new Blob([jsonString], { type: "application/json" });

  const initiateUrl = `${apiBaseUrl}/files/fs/upload?parentId=${configFolderId}&parentType=FOLDER`;
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

  const uploadResponse = await fetch(finalUploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: fileBlob,
  });
  if (!uploadResponse.ok) throw new Error("L'upload du fichier a échoué.");

  const verifyUrl = `${apiBaseUrl}/files/fs/upload?uploadId=${uploadId}&wait=true`;
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
