// On importe uniquement les fonctions d'UI dont nous avons besoin
import { renderHomePage, renderLinkModal } from "./ui.js";
import {
  fetchUserProjectRole,
  fetchLinksConfiguration,
  getProjectRootId,
  findOrCreateFolder,
  saveLinksConfiguration,
} from "./api.js";

// Exécution dans une fonction auto-appelée pour un environnement propre
(async function () {
  const mainContentDiv = document.getElementById("mainContent");
  const configBtn = document.getElementById("config-btn");
  let triconnectAPI;
  let globalAccessToken = null;
  let currentProjectId, configFolderId;

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

  // ==================================================================
  // == SÉQUENCE D'INITIALISATION SIMPLIFIÉE                         ==
  // ==================================================================
  try {
    // 2. Se connecter à l'API de l'espace de travail Trimble Connect
    triconnectAPI = await TrimbleConnectWorkspace.connect(
      window.parent,
      () => {},
      30000,
    );

    // 3. Demander la permission pour l'access token
    globalAccessToken =
      await triconnectAPI.extension.requestPermission("accesstoken");
    if (!globalAccessToken) {
      throw new Error(
        "L'Access Token est invalide ou n'a pas pu être récupéré.",
      );
    }

    // 4. AFFICHER L'ACCESS TOKEN DANS LA CONSOLE (Objectif principal)
    console.log("--- Access Token Utilisateur ---");
    console.log(globalAccessToken);
    console.log("---------------------------------");

    // 5. Mettre à jour le menu de l'extension pour correspondre au nouveau nom
    triconnectAPI.ui.setMenu({
      title: "TEST",
      icon: "https://dorianlorenzato-max.github.io/trimble-connect-ecna-extension/logoEiffage.png",
      command: "test_extension_clicked",
    });
    const project = await triconnectAPI.project.getCurrentProject();
    if (!project || !project.id) {
      throw new Error(
        "Impossible de récupérer les informations du projet actuel.",
      );
    }
    currentProjectId = project.id; // On assigne la valeur à la variable globale
    console.log(`Projet actuel ID : ${currentProjectId}`);

    // 6. Afficher la page d'accueil finale
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
