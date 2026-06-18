// On importe les fonctions depuis nos modules
import { renderHomePage, renderLinkModal } from "./ui.js";
import {
  fetchUserProjectRole,
  fetchLinksConfiguration,
  getProjectRootId,
  findOrCreateFolder,
  saveLinksConfiguration,
} from "./api.js";

// Exécution dans une fonction auto-appelée pour ne pas polluer l'espace global
(async function () {
  const mainContentDiv = document.getElementById("mainContent");
  const configBtn = document.getElementById("config-btn");
  let triconnectAPI;
  let globalAccessToken;
  let currentProjectId;
  let configFolderId;
  let appState = {
    isConfigModeActive: false, // Les boutons de gestion sont-ils visibles ?
    editMode: "view", // 'view', 'add', 'edit', 'delete'
    links: [], // La liste des liens chargés
  };

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

    function rerenderUI() {
      renderHomePage(mainContentDiv, appState.links, appState);
      attachEventListeners(); // On appelle une nouvelle fonction pour gérer les événements
    }

    // fonction dédiée pour attacher les écouteurs d'événements
    function attachEventListeners() {
      // Écouteur pour le bouton "Ajouter"
      const addBtn = document.getElementById("add-link-btn");
      if (addBtn) {
        addBtn.addEventListener("click", handleAddLink);
      }
    }

    //  fonction qui gère la logique du clic sur "Ajouter"
    function handleAddLink() {
      appState.editMode = "add";

      // La fonction de callback qui sera exécutée après la validation de la modale
      const onAddConfirm = async (name, url) => {
        // Ajoute le nouveau lien à notre état local
        appState.links.push({ name, url });

        try {
          // Sauvegarde la nouvelle liste complète sur Trimble Connect
          await saveLinksConfiguration(
            globalAccessToken,
            configFolderId,
            appState.links,
          );
          console.log("Configuration des liens sauvegardée avec succès.");
        } catch (error) {
          console.error("Échec de la sauvegarde de la configuration :", error);
          // Optionnel : annuler l'ajout local si la sauvegarde échoue
          appState.links.pop();
          alert("Erreur : Impossible de sauvegarder le nouveau lien.");
        }

        // Redessine l'interface pour afficher le nouveau bouton
        rerenderUI();
      };

      // Affiche la modale et lui passe la fonction de callback
      renderLinkModal(onAddConfirm);
    }

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
        appState.links = await fetchLinksConfiguration(
          globalAccessToken,
          configFolderId,
        );

        // E. Afficher la page d'accueil avec les données chargées
        rerenderUI();
      } catch (error) {
        console.error("Erreur lors du chargement des données :", error);
        mainContentDiv.innerHTML = `<p style="color:red;">Erreur lors du chargement des données : ${error.message}</p>`;
      }
    }

    // 2. Affichage de la page d'accueil au chargement initial
    loadInitialDataAndRender();

    // 3. Attacher l'événement au bouton de configuration
    configBtn.addEventListener("click", () => {
      // On inverse l'état du mode configuration
      appState.isConfigModeActive = !appState.isConfigModeActive;
      // Si on quitte le mode config, on repasse en mode 'vue' par sécurité
      if (!appState.isConfigModeActive) {
        appState.editMode = "view";
      }
      // On redessine l'interface pour afficher ou cacher les boutons
      rerenderUI();
    });
  } catch (error) {
    console.error("Erreur lors de l'initialisation de l'extension :", error);
    mainContentDiv.innerHTML = `<p style="color:red;">Erreur critique au démarrage : ${error.message}</p>`;
  }
})();
