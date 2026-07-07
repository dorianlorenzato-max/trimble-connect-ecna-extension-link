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

  let triconnectAPI,
    globalAccessToken,
    currentProjectId,
    configFolderId,
    apiBaseUrl;

  let appState = {
    isConfigModeActive: false,
    editMode: "view",
    links: [],
  };

  function rerenderUI() {
    renderHomePage(mainContentDiv, appState.links, appState);
    attachEventListeners();
  }

  function attachEventListeners() {
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

    const finishBtn = document.getElementById("finish-editing-btn");
    if (finishBtn) {
      finishBtn.addEventListener("click", () => {
        appState.editMode = "view";
        rerenderUI();
      });
    }

    document.querySelectorAll(".link-button").forEach((button) => {
      button.addEventListener("click", () => {
        const index = parseInt(button.dataset.index, 10);
        const link = appState.links[index];
        if (!link) return;

        if (appState.editMode === "view") {
          window.open(link.url, "_blank");
        } else if (appState.editMode === "delete") {
          handleDeleteLink(index);
        } else if (appState.editMode === "edit") {
          handleEditLink(index);
        }
      });
    });
  }

  async function saveAndRerender() {
    try {
      await saveLinksConfiguration(
        apiBaseUrl,
        globalAccessToken,
        configFolderId,
        appState.links,
      );
    } catch (error) {
      console.error("Échec de la sauvegarde :", error);
      alert("Erreur : Impossible de sauvegarder la configuration.");
      return loadInitialDataAndRender();
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
    currentProjectId = (await triconnectAPI.project.getCurrentProject()).id;

    // ----- DÉTECTION ET CONSTRUCTION DE L'URL DYNAMIQUE -----
    const parentOrigin = window.location.ancestorOrigins[0];
    const apiHostname = new URL(parentOrigin).hostname.replace(
      /^web\./,
      "app.",
    );
    apiBaseUrl = `https://${apiHostname}`;
    console.log("URL de base de l'API détectée et utilisée :", apiBaseUrl);
    // --------------------------------------------------------

    triconnectAPI.ui.setMenu({
      title: "ECNA Liens URLs",
      icon: "https://dorianlorenzato-max.github.io/trimble-connect-ecna-extension/logoEiffage.png",
      command: "open_extension",
    });

    loadInitialDataAndRender();

    configBtn.addEventListener("click", () => {
      appState.isConfigModeActive = !appState.isConfigModeActive;
      if (!appState.isConfigModeActive) appState.editMode = "view";
      rerenderUI();
    });

    async function loadInitialDataAndRender() {
      try {
        mainContentDiv.innerHTML = "<p>Chargement...</p>";

        const userRole = await fetchUserProjectRole(
          apiBaseUrl,
          currentProjectId,
          globalAccessToken,
        );
        if (userRole === "ADMIN") configBtn.style.display = "block";

        const projectRootId = await getProjectRootId(
          apiBaseUrl,
          triconnectAPI,
          globalAccessToken,
        );
        configFolderId = await findOrCreateFolder(
          apiBaseUrl,
          projectRootId,
          CONFIG_FOLDER_NAME,
          globalAccessToken,
        );
        appState.links = await fetchLinksConfiguration(
          apiBaseUrl,
          globalAccessToken,
          configFolderId,
        );

        rerenderUI();
      } catch (error) {
        console.error("Erreur lors du chargement des données :", error);
        mainContentDiv.innerHTML = `<p style="color:red;">Erreur lors du chargement des données : ${error.message}</p>`;
      }
    }
  } catch (error) {
    console.error("Erreur critique au démarrage :", error);
    mainContentDiv.innerHTML = `<p style="color:red;">Erreur critique au démarrage : ${error.message}</p>`;
  }
})();
