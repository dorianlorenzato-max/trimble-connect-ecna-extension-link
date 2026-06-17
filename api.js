/**
 * Module pour la communication avec les APIs Trimble Connect.
 */

const CONFIG_FOLDER_NAME = "Configuration_Links";
const LINKS_CONFIG_FILENAME = "links-config.json";

/**
 * Récupère le rôle de l'utilisateur pour le projet actuel.
 * @param {string} projectId - L'ID du projet.
 * @param {string} accessToken - Le jeton d'accès.
 * @returns {Promise<string>} Le rôle de l'utilisateur (ex: "ADMIN", "USER").
 */
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
export { fetchUserProjectRole, fetchLinksConfiguration };
