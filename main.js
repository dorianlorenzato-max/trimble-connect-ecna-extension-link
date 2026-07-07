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

  //  On revient à une fonction qui attache les écouteurs aux éléments existants.
  function attachEventListeners() {
    console.log("Appel de attachEventListeners...");
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
    const linkButtons = document.querySelectorAll(".link-button");
    console.log(`${linkButtons.length} "boutons liens" trouvés.`);
    linkButtons.forEach((button) => {
      button.addEventListener("click", () => {
        console.log("--- Clic sur un bouton lien détecté ---");
        console.log("Mode d'édition actuel :", appState.editMode);

        const index = parseInt(button.dataset.index, 10);
        console.log("Index du bouton :", index);

        const link = appState.links[index];
        console.log("Lien correspondant dans l'état :", link);

        if (!link) {
          console.error(
            "ERREUR : Impossible de trouver le lien correspondant à cet index. L'état de l'application est peut-être désynchronisé.",
          );
          return;
        }

        // Pour cette étape, on ne gère que le mode 'view'.
        if (appState.editMode === "view") {
          console.log(
            "Mode 'view' actif. Tentative d'ouverture de l'URL :",
            link.url,
          );
          window.open(link.url, "_blank");
        } else if (appState.editMode === "delete") {
          //  Log pour tracer l'appel
          console.log(
            `Mode 'delete' détecté. Appel de handleDeleteLink pour l'index ${index}...`,
          );
          handleDeleteLink(index);
        } else if (appState.editMode === "edit") {
          console.log(
            `Mode 'edit' détecté. Appel de handleEditLink pour l'index ${index}...`,
          );
          handleEditLink(index);
        } else {
          console.log(
            `Clic ignoré car le mode est '${appState.editMode}', pas 'view'.`,
          );
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

    // ====================== DÉTECTION DYNAMIQUE DE L'API SERVER ======================
    /**
     * Tente de trouver la bonne URL de base de l'API REST en se basant sur l'environnement de l'utilisateur.
     */
    async function getDynamicApiBaseUrl() {
      try {
        // 1. On récupère l'URL du site parent qui héberge l'extension.
        const parentOrigin = window.location.ancestorOrigins[0];
        if (!parentOrigin) {
          console.error(
            "Impossible de déterminer l'origine parente (ancestorOrigins).",
          );
          return null;
        }
        const parentHostname = new URL(parentOrigin).hostname; // Ex: "web.connect.trimble.com"

        // 2. On appelle l'API publique /regions sur un serveur de référence (US master region).
        const regionsUrl = "https://app.connect.trimble.com/tc/api/2.0/regions";
        const response = await fetch(regionsUrl);
        if (!response.ok) {
          console.error(
            `Échec de la récupération de la liste des régions depuis ${regionsUrl}`,
          );
          return null;
        }
        const regions = await response.json();

        // 3. On cherche la bonne région dans la liste.
        // On doit normaliser les noms : "web.connect.trimble.com" (front-end) correspond à "app.connect.trimble.com" (back-end).
        const apiHostname = parentHostname.replace(/^web\./, "app."); // Remplace "web." par "app."

        const currentRegion = regions.find((region) => {
          // L'URL de l'API dans la liste peut être extraite de la propriété 'tc-api'
          if (region["tc-api"]) {
            return new URL(region["tc-api"]).hostname === apiHostname;
          }
          return false;
        });

        if (currentRegion && currentRegion["tc-api"]) {
          // 4. On a trouvé ! On retourne l'URL de l'API pour cette région.
          return currentRegion["tc-api"];
        } else {
          console.warn(
            `Aucune correspondance trouvée pour l'hôte API '${apiHostname}' dans la liste des régions.`,
          );
          return null;
        }
      } catch (error) {
        console.error("Erreur dans la fonction getDynamicApiBaseUrl:", error);
        return null;
      }
    }

    // On exécute la fonction de détection et on affiche le résultat.
    const dynamicApiUrl = await getDynamicApiBaseUrl();

    if (dynamicApiUrl) {
      console.log("--- URL DE L'API DYNAMIQUE TROUVÉE ---");
      console.log(
        "L'URL du serveur API à utiliser pour cet utilisateur est :",
        dynamicApiUrl,
      );
      console.log("-----------------------------------------test");
    } else {
      console.error(
        "ÉCHEC : Impossible de déterminer l'URL de l'API dynamique.",
      );
    }
    // ==================== FIN DE LA DÉTECTION ====================

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
