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

  let triconnectAPI, globalAccessToken, currentProjectId, configFolderId;

  let appState = {
    isConfigModeActive: false,
    editMode: "view",
    links: [],
  };

  // Met à jour l'interface et ré-attache les écouteurs nécessaires.
  function rerenderUI() {
    renderHomePage(mainContentDiv, appState.links, appState);
  }

  // --- LOGIQUE DES ÉVÉNEMENTS ---

  function handleAddLink() {
    const onAddConfirm = async (name, url) => {
      appState.links.push({ name, url });
      await saveAndRerender();
    };
    renderLinkModal(onAddConfirm);
  }

  function handleEditLink(index) {
    const linkToEdit = appState.links[index];
    const onEditConfirm = async (newName, newUrl) => {
      appState.links[index] = { name: newName, url: newUrl };
      appState.editMode = "view";
      await saveAndRerender();
    };
    renderLinkModal(onEditConfirm, linkToEdit);
  }

  async function handleDeleteLink(index) {
    const linkToDelete = appState.links[index];
    if (
      confirm(
        `Êtes-vous sûr de vouloir supprimer le lien "${linkToDelete.name}" ?`,
      )
    ) {
      appState.links.splice(index, 1);
      appState.editMode = "view";
      await saveAndRerender();
    }
  }

  // Fonction utilitaire pour sauvegarder et redessiner l'UI
  async function saveAndRerender() {
    try {
      await saveLinksConfiguration(
        globalAccessToken,
        configFolderId,
        appState.links,
      );
    } catch (error) {
      console.error("Échec de la sauvegarde :", error);
      alert("Erreur : Impossible de sauvegarder la configuration.");
      // On recharge les données depuis le serveur pour annuler les changements locaux
      loadInitialDataAndRender();
    }
    rerenderUI();
  }

  // --- INITIALISATION ET GESTIONNAIRE D'ÉVÉNEMENTS PRINCIPAL ---

  try {
    // Connexion à l'API et récupération des infos
    triconnectAPI = await TrimbleConnectWorkspace.connect(
      window.parent,
      () => console.log("Connexion réalisée"),
      30000,
    );
    globalAccessToken =
      await triconnectAPI.extension.requestPermission("accesstoken");
    const projectInfo = await triconnectAPI.project.getCurrentProject();
    currentProjectId = projectInfo.id;

    triconnectAPI.ui.setMenu({
      title: "Portail de Liens",
      icon: "https://dorianlorenzato-max.github.io/trimble-connect-ecna-extension/logoEiffage.png",
      command: "open_extension",
    });
    triconnectAPI.onCommand.subscribe(
      (command) => command === "open_extension" && loadInitialDataAndRender(),
    );

    //  GESTIONNAIRE D'ÉVÉNEMENTS UNIQUE (EVENT DELEGATION)
    // Ce gestionnaire est attaché au corps du document et ne sera jamais supprimé.
    document.body.addEventListener("click", (event) => {
      const target = event.target;

      // Clic sur le bouton "Configuration" du bandeau
      if (target.id === "config-btn") {
        appState.isConfigModeActive = !appState.isConfigModeActive;
        if (!appState.isConfigModeActive) appState.editMode = "view";
        rerenderUI();
      }
      // Clic sur "Ajouter"
      else if (target.id === "add-link-btn") handleAddLink();
      // Clic sur "Modifier" (agit comme un interrupteur)
      else if (target.id === "edit-link-btn") {
        appState.editMode = appState.editMode === "edit" ? "view" : "edit";
        rerenderUI();
      }
      // Clic sur "Supprimer" (agit comme un interrupteur)
      else if (target.id === "delete-link-btn") {
        appState.editMode = appState.editMode === "delete" ? "view" : "delete";
        rerenderUI();
      }
      // Clic sur "Terminer"
      else if (target.id === "finish-editing-btn") {
        appState.editMode = "view";
        rerenderUI();
      }
      // Clic sur un "bouton lien"
      else if (target.classList.contains("link-button")) {
        const index = parseInt(target.dataset.index, 10);
        if (isNaN(index) || !appState.links[index]) return; // Sécurité

        switch (appState.editMode) {
          case "view":
            window.open(appState.links[index].url, "_blank");
            break;
          case "edit":
            handleEditLink(index);
            break;
          case "delete":
            handleDeleteLink(index);
            break;
        }
      }
    });

    // Chargement initial des données
    async function loadInitialDataAndRender() {
      try {
        mainContentDiv.innerHTML = "<p>Chargement...</p>";
        const userRole = await fetchUserProjectRole(
          currentProjectId,
          globalAccessToken,
        );
        if (userRole === "ADMIN") configBtn.style.display = "block";

        const projectRootId = await getProjectRootId(
          triconnectAPI,
          globalAccessToken,
        );
        configFolderId = await findOrCreateFolder(
          projectRootId,
          "Configuration_Links",
          globalAccessToken,
        );
        appState.links = await fetchLinksConfiguration(
          globalAccessToken,
          configFolderId,
        );

        rerenderUI();
      } catch (error) {
        console.error("Erreur lors du chargement des données :", error);
        mainContentDiv.innerHTML = `<p style="color:red;">Erreur lors du chargement des données : ${error.message}</p>`;
      }
    }

    loadInitialDataAndRender();
  } catch (error) {
    console.error("Erreur critique au démarrage :", error);
    mainContentDiv.innerHTML = `<p style="color:red;">Erreur critique au démarrage : ${error.message}</p>`;
  }
})();
