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
      "eyJhbGciOiJSUzI1NiIsImtpZCI6IjIiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2lkLnRyaW1ibGUuY29tIiwiZXhwIjoxNzgzNDMzOTgyLCJuYmYiOjE3ODM0MzAzODIsImlhdCI6MTc4MzQzMDM4MiwianRpIjoiZWQwNTBkMGVjNjA0NDBiYzllYzA2NmUwMTlhNDk0NjEiLCJqd3RfdmVyIjoyLCJzdWIiOiI1NDQ5NjRmZS0zZjVjLTQ5YTQtYWM4Yy05YTMzYzkyNDEwMzQiLCJpZGVudGl0eV90eXBlIjoidXNlciIsImFtciI6WyJwYXNzd29yZCIsIm1mYSIsInNvZnR3YXJlX3Rva2VuX21mYSJdLCJhdXRoX3RpbWUiOjE3ODMwODE0MzcsImF6cCI6ImU2NDI0ZWJmLTU1YTctNDBkNi04Mjg0LWExYzFkNWY0MmRlMCIsImFjY291bnRfaWQiOiJjNTQ5YWFmNS0yZGI1LTVmYWQtYmZlYy01ODQyMTBkZTI4NDMiLCJhdWQiOlsiZTY0MjRlYmYtNTVhNy00MGQ2LTgyODQtYTFjMWQ1ZjQyZGUwIiwiYzU1MjcxZGQtMmM1MC00NTQ2LWI5NDYtYmZlODFmYTEyMWM5IiwiMWM1Y2Y1NGItOTI4YS00ZDc4LWE5ZjQtZmQ0NGE3Y2I4ZGRjIiwiNmJlNTU0NTItZGM1My00ZWJjLTliMTQtYzE5ZmQ5NmIzOWQ3IiwiNzNiYmRiNjItZGFkMy00ZDg3LWFiMjMtMmFhOWExMzA0NjM1Il0sInNjb3BlIjoiVENXRUJOZXh0Z2VuIGFnZW50cyBtb2RlbHMga2IgaWFtIiwiZGF0YV9yZWdpb24iOiJldSIsInN1Yl90cm4iOiJ0cm46MjppYW06ZXU6dXNlcjo1NDQ5NjRmZS0zZjVjLTQ5YTQtYWM4Yy05YTMzYzkyNDEwMzQiLCJhenBfdHJuIjoidHJuOjI6aWFtOnVzOmFwcGxpY2F0aW9uOmU2NDI0ZWJmLTU1YTctNDBkNi04Mjg0LWExYzFkNWY0MmRlMCJ9.tFvmBW2fFlaVpdhfk8uux-KQBOF2Kj0xct7vdqsACbXXHPuAFiXVjpWcqQruWd_CEK_oeY7MB9Wg028veLJZKDvbFf7m8MXa0ss4iYv9amzEpNfeTVtBpVwrwHQXTS7_VFq0MW3zIOy97iaDXbf908yGtZ1CkdzZsUlPx2VNzTtTuOOTkHRokb-VQKfR2RJitPYOkkuqwuzA7gLMeE-bIy6veozHyJ8MiRzcCKdp7G-f73IebqMu_c4zfqwHHH3ulc3DpnVtwkhklCFMdKCUe5bfky6ZbOD01jXQYf9XJ2rshb7u2AZm2swPr-sqZ5fGHbFGbDoaKwitcuQMmGt6AQ";
    //await triconnectAPI.extension.requestPermission("accesstoken");
    const projectInfo = await triconnectAPI.project.getCurrentProject();
    currentProjectId = projectInfo.id;

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
