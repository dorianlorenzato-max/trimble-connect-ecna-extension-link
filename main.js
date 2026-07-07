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

  /**
   * Détecte dynamiquement l'URL du serveur API correct en se basant sur la localisation du projet.
   * C'est la méthode la plus robuste.
   */
  async function getApiBaseUrlForProject(projectInfo) {
    try {
      console.log(
        "Informations du projet reçues pour la détection du serveur :",
        projectInfo,
      );
      if (!projectInfo.location) {
        throw new Error(
          "La propriété 'location' est manquante dans les informations du projet.",
        );
      }

      const projectLocation = projectInfo.location; // Ex: "europe" ou "northAmerica"

      // On appelle l'API publique /regions sur un serveur de référence
      const regions = await (
        await fetch("https://app.connect.trimble.com/tc/api/2.0/regions")
      ).json();

      // On cherche la région qui correspond à la localisation du projet
      const currentRegion = regions.find(
        (region) =>
          region.location.toLowerCase() === projectLocation.toLowerCase(),
      );

      if (currentRegion && currentRegion["tc-api"]) {
        // On retourne l'URL de l'API de cette région
        return currentRegion["tc-api"].replace(/\/$/, ""); // Enlève le / à la fin
      } else {
        throw new Error(
          `Aucun serveur API trouvé pour la localisation du projet : '${projectLocation}'`,
        );
      }
    } catch (error) {
      console.error(
        "Échec de la détection dynamique du serveur API, utilisation d'une URL par défaut.",
        error,
      );
      // En cas d'échec total, on se rabat sur l'ancienne méthode (moins fiable)
      return "https://app21.connect.trimble.com";
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

    // ----- DÉTECTION FINALE DE L'URL -----
    apiBaseUrl = await getApiBaseUrlForProject(projectInfo);
    console.log(
      "URL de l'API DÉFINITIVE (basée sur la localisation du projet) :",
      apiBaseUrl,
    );
    // ------------------------------------

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
          "Configuration_Links",
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
