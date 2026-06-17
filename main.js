// On importe les fonctions depuis nos modules
import { renderHomePage } from "./ui.js";

// Exécution dans une fonction auto-appelée pour ne pas polluer l'espace global
(async function () {
  const mainContentDiv = document.getElementById("mainContent");
  const configBtn = document.getElementById("config-btn");

  try {
    // 1. Connexion à l'API Trimble Connect
    const triconnectAPI = await TrimbleConnectWorkspace.connect(
      window.parent,
      () => {
        console.log("Session expirée, veuillez rafraîchir.");
      },
      30000,
    );

    // 2. Affichage de la page d'accueil
    renderHomePage(mainContentDiv);

    // 3. Attacher l'événement au bouton de configuration
    configBtn.addEventListener("click", () => {
      // Pour l'instant, un simple message.
      // Nous développerons cette partie plus tard.
      alert("La page de configuration sera implémentée ici !");
    });
  } catch (error) {
    console.error("Erreur lors de l'initialisation de l'extension :", error);
    mainContentDiv.innerHTML = `<p style="color:red;">Erreur critique au démarrage : ${error.message}</p>`;
  }
})();
