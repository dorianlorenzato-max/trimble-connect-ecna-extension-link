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
      // 1. Dessine l'interface
      renderHomePage(mainContentDiv, appState.links, appState);

      // 2. Attache les écouteurs d'événements après le dessin
      attachEventListeners();
    }

    // fonction dédiée pour attacher les écouteurs d'événements
    function attachEventListeners() {
      // Boutons de gestion
      const addBtn = document.getElementById("add-link-btn");
      if (addBtn) addBtn.addEventListener("click", handleAddLink);

      const editBtn = document.getElementById("edit-link-btn");
      if (editBtn)
        editBtn.addEventListener("click", () => {
          // Si on est déjà en mode edit, on le quitte. Sinon, on y entre.
          appState.editMode = appState.editMode === "edit" ? "view" : "edit";
          rerenderUI();
        });

      const deleteBtn = document.getElementById("delete-link-btn");
      if (deleteBtn)
        deleteBtn.addEventListener("click", () => {
          appState.editMode =
            appState.editMode === "delete" ? "view" : "delete";
          rerenderUI();
        });

      const finishBtn = document.getElementById("finish-editing-btn");
      if (finishBtn)
        finishBtn.addEventListener("click", () => {
          appState.editMode = "view";
          rerenderUI();
        });

      // Écouteur pour TOUS les "boutons liens"
      document.querySelectorAll(".link-button").forEach((button) => {
        button.addEventListener("click", () => {
          handleLinkClick(button);
        });
      });
    }

    //  La fonction centrale qui gère le clic sur un "bouton lien"
    function handleLinkClick(button) {
      const index = parseInt(button.dataset.index, 10);
      const link = appState.links[index];

      switch (appState.editMode) {
        case "view":
          // Comportement par défaut : ouvrir le lien
          window.open(link.url, "_blank");
          break;
        case "edit":
          handleEditLink(index);
          break;
        case "delete":
          handleDeleteLink(index);
          break;
      }
    }

    //  fonction qui gère la logique du clic sur "Ajouter"
    function handleAddLink() {
      const onAddConfirm = async (name, url) => {
        appState.links.push({ name, url });
        try {
          await saveLinksConfiguration(
            globalAccessToken,
            configFolderId,
            appState.links,
          );
        } catch (error) {
          console.error("Échec de la sauvegarde :", error);
          appState.links.pop();
          alert("Erreur : Impossible de sauvegarder le nouveau lien.");
        }
        rerenderUI();
      };
      // On appelle la modale sans second argument pour l'ajout.
      renderLinkModal(onAddConfirm);
    }

    // La fonction pour gérer la logique de modification
    function handleEditLink(index) {
      const linkToEdit = appState.links[index];

      const onEditConfirm = async (newName, newUrl) => {
        // Met à jour le lien dans notre état local
        appState.links[index] = { name: newName, url: newUrl };

        try {
          await saveLinksConfiguration(
            globalAccessToken,
            configFolderId,
            appState.links,
          );
          console.log("Configuration mise à jour avec succès.");
        } catch (error) {
          console.error("Échec de la mise à jour :", error);
          // Annuler la modification locale en cas d'échec
          appState.links[index] = linkToEdit;
          alert("Erreur : Impossible de sauvegarder la modification.");
        }

        appState.editMode = "view"; // On quitte le mode édition
        rerenderUI();
      };

      // Affiche la modale en lui passant les valeurs actuelles du lien
      renderLinkModal(onEditConfirm, linkToEdit);
    }
    // La fonction pour gérer la logique de suppression
    async function handleDeleteLink(index) {
      const linkToDelete = appState.links[index];

      if (
        confirm(
          `Êtes-vous sûr de vouloir supprimer le lien "${linkToDelete.name}" ?`,
        )
      ) {
        // Supprime le lien de notre état local
        appState.links.splice(index, 1);

        try {
          await saveLinksConfiguration(
            globalAccessToken,
            configFolderId,
            appState.links,
          );
          console.log("Lien supprimé et configuration sauvegardée.");
        } catch (error) {
          console.error("Échec de la suppression :", error);
          // Annuler la suppression locale en cas d'échec
          appState.links.splice(index, 0, linkToDelete);
          alert("Erreur : Impossible de sauvegarder la suppression.");
        }

        appState.editMode = "view"; // On quitte le mode suppression
        rerenderUI();
      }
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
