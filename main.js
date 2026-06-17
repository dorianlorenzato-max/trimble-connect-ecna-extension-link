// On importe les fonctions depuis nos modules
import { renderHomePage } from "./ui.js";
import { fetchUserProjectRole, fetchLinksConfiguration } from "./api.js";

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
          configBtn.style.display = "block"; // On affiche le bouton si admin
        }

        // B. Récupérer l'ID du dossier racine et trouver/créer notre dossier de config
        // Note: pour l'instant, on va juste simuler la récupération du configFolderId
        // Nous allons réintégrer la logique complète de findOrCreateFolder à la prochaine étape.
        // Pour ce test, il faut créer manuellement un dossier "Configuration_Links" à la racine.
        const rootFolders = await triconnectAPI.project.getRootFolders();
        const foundFolder = rootFolders.find(
          (f) => f.name === "Configuration_Links",
        );
        if (!foundFolder) {
          mainContentDiv.innerHTML = `<p style="color:orange;">Veuillez créer un dossier nommé "Configuration_Links" à la racine du projet.</p>`;
          return;
        }
        configFolderId = foundFolder.id;

        // C. Charger la configuration des liens
        const links = await fetchLinksConfiguration(
          globalAccessToken,
          configFolderId,
        );

        // D. Afficher la page d'accueil avec les données chargées
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
