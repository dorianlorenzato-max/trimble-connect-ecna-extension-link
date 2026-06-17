// On importe les fonctions depuis nos modules
import { renderHomePage } from "./ui.js";
import {
  fetchUserProjectRole,
  fetchLinksConfiguration,
  getProjectRootId,
  findOrCreateFolder,
} from "./api.js";

// Exécution dans une fonction auto-appelée pour ne pas polluer l'espace global
(async function () {
  const mainContentDiv = document.getElementById("mainContent");
  const configBtn = document.getElementById("config-btn");
  let triconnectAPI;
  let globalAccessToken;
  let currentProjectId;
  let configFolderId; // On aura besoin de cet ID bientôt

  try {
    // 1. Connexion à l'API Trimble Connect
    const triconnectAPI = await TrimbleConnectWorkspace.connect(
      window.parent,
      () => {
        console.log("Session expirée, veuillez rafraîchir.");
      },
      30000,
    );

    globalAccessToken =
      await triconnectAPI.extension.requestPermission("accesstoken");
    const projectInfo = await triconnectAPI.project.getCurrentProject();
    currentProjectId = projectInfo.id;

    triconnectAPI.ui.setMenu({
      title: "ECNA 'Titre Thibaut'", // Le nom qui apparaîtra dans le menu Trimble
      icon: "https://dorianlorenzato-max.github.io/trimble-connect-ecna-extension/logoEiffage.png",
      command: "open_extension", // La commande envoyée lors du clic
    });
    async function loadInitialDataAndRender() {
      try {
        mainContentDiv.innerHTML = "<p>Chargement...</p>";

        // A. Vérifier le rôle de l'utilisateur
        const userRole = await fetchUserProjectRole(
          currentProjectId,
          globalAccessToken,
        );
        if (userRole === "ADMIN") {
          configBtn.style.display = "block";
        }

        // B. Récupérer l'ID du dossier racine
        const projectRootId = await getProjectRootId(
          triconnectAPI,
          globalAccessToken,
        );

        // C. Trouver ou créer notre dossier de configuration (plus besoin de le faire manuellement !)
        configFolderId = await findOrCreateFolder(
          projectRootId,
          "Configuration_Links",
          globalAccessToken,
        );

        // D. Charger la configuration des liens
        const links = await fetchLinksConfiguration(
          globalAccessToken,
          configFolderId,
        );

        // E. Afficher la page d'accueil avec les données chargées
        renderHomePage(mainContentDiv, links);
      } catch (error) {
        console.error("Erreur lors du chargement des données :", error);
        mainContentDiv.innerHTML = `<p style="color:red;">Erreur lors du chargement des données : ${error.message}</p>`;
      }
    }

    // 2. Affichage de la page d'accueil au chargement initial
    loadInitialDataAndRender();

    // 3. Attacher l'événement au bouton de configuration
    configBtn.addEventListener("click", () => {
      alert("La page de configuration sera implémentée ici !");
    });
  } catch (error) {
    console.error("Erreur lors de l'initialisation de l'extension :", error);
    mainContentDiv.innerHTML = `<p style="color:red;">Erreur critique au démarrage : ${error.message}</p>`;
  }
})();
