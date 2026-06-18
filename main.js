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

  // --- FONCTIONS DE Rendu et de Gestion des Événements ---

  // La fonction `rerenderUI` se contente d'appeler les deux autres.
  function rerenderUI() {
    renderHomePage(mainContentDiv, appState.links, appState);
    attachEventListeners(); // On attache les écouteurs APRÈS avoir dessiné l'interface.
  }

  // CORRECTION : On revient à une fonction qui attache les écouteurs aux éléments existants.
  function attachEventListeners() {
    // 1. Gérer les boutons de configuration
    if (appState.isConfigModeActive) {
      document
        .getElementById("add-link-btn")
        .addEventListener("click", handleAddLink);
      document.getElementById("edit-link-btn").addEventListener("click", () => {
        appState.editMode = appState.editMode === "edit" ? "view" : "edit";
        rerenderUI();
      });
      document
        .getElementById("delete-link-btn")
        .addEventListener("click", () => {
          appState.editMode =
            appState.editMode === "delete" ? "view" : "delete";
          rerenderUI();
        });
    }

    // 2. Gérer le bouton "Terminer"
    const finishBtn = document.getElementById("finish-editing-btn");
    if (finishBtn) {
      finishBtn.addEventListener("click", () => {
        appState.editMode = "view";
        rerenderUI();
      });
    }

    // 3. Gérer les clics sur chaque "bouton lien" individuellement
    document.querySelectorAll(".link-button").forEach((button) => {
      button.addEventListener("click", () => {
        const index = parseInt(button.dataset.index, 10);
        const link = appState.links[index];

        if (!link) return; // Sécurité

        switch (appState.editMode) {
          case "view":
            window.open(link.url, "_blank");
            break;
          case "edit":
            handleEditLink(index);
            break;
          case "delete":
            handleDeleteLink(index);
            break;
        }
      });
    });
  }

  // --- LOGIQUE MÉTIER (Ajouter, Modifier, Supprimer) ---

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
      return loadInitialDataAndRender(); // En cas d'erreur, on recharge tout.
    }
    rerenderUI();
  }

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

  // --- INITIALISATION ---

  try {
    triconnectAPI = await TrimbleConnectWorkspace.connect(
      window.parent,
      () => console.log("Session expirée"),
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

    // Correction de la coquille
    triconnectAPI.onCommand.subscribe((command) => {
      if (command === "open_extension") {
        loadInitialDataAndRender();
      }
    });

    configBtn.addEventListener("click", () => {
      appState.isConfigModeActive = !appState.isConfigModeActive;
      if (!appState.isConfigModeActive) appState.editMode = "view";
      rerenderUI();
    });

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
