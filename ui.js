/**
 * Module pour la manipulation du DOM et la mise à jour de l'interface utilisateur.
 */

/**
 * Affiche la page d'accueil avec une liste dynamique de boutons et des contrôles de configuration.
 * @param {HTMLElement} container - L'élément DOM où injecter le contenu.
 * @param {Array} links - Un tableau d'objets lien.
 * @param {object} appState - L'état actuel de l'application (pour savoir si on est en mode config).
 */
function renderHomePage(container, links, appState) {
  const configControlsHtml = appState.isConfigModeActive
    ? `
      <div class="config-controls">
        <button id="add-link-btn" class="button-secondary">Ajouter</button>
        <button id="edit-link-btn" class="button-secondary">Modifier</button>
        <button id="delete-link-btn" class="button-danger">Supprimer</button>
      </div>
    `
    : "";
  const editModeClass = appState.editMode === "edit" ? "edit-mode-active" : "";
  const deleteModeClass =
    appState.editMode === "delete" ? "delete-mode-active" : "";
  const buttonsHtml =
    links.length > 0
      ? links
          .map((link, index) => {
            const escapedName = link.name.replace(/"/g, "&quot;");
            return `<button class="link-button" data-index="${index}" data-url="${link.url}" data-name="${escapedName}">${link.name}</button>`;
          })
          .join("")
      : "<p>Aucun lien n'est configuré.</p>";
  const finishButtonHtml =
    appState.editMode === "edit" || appState.editMode === "delete"
      ? `<button id="finish-editing-btn" class="button-primary finish-editing-btn">Terminer</button>`
      : "";
  container.innerHTML = `
    <div class="home-container ${editModeClass} ${deleteModeClass}">
        ${configControlsHtml}
        <h1>Portail de Liens</h1>
        <p>Accédez rapidement à vos ressources externes.</p>
        <div class="home-button-list">
            ${buttonsHtml}
        </div>
    </div>
    ${finishButtonHtml} 
  `;
}
/**
 * Affiche une modale pour ajouter ou modifier un lien.
 * @param {function} onConfirm - La fonction de callback.
 * @param {object} [defaultValues] - Optionnel: Les valeurs pour pré-remplir les champs.
 * @param {string} [defaultValues.name] - Le nom par défaut.
 * @param {string} [defaultValues.url] - L'URL par défaut.
 */
function renderLinkModal(onConfirm, defaultValues = {}) {
  // Crée l'overlay et la modale
  const initialName = defaultValues.name || "";
  const initialUrl = defaultValues.url || "";
  const title = initialName ? "Modifier le lien" : "Ajouter un lien";

  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `
    <div class="modal-content">
      <h2>${title}</h2>
      <div class="modal-form">
        <div class="form-group">
          <label for="link-name-input">Nom du lien</label>
          <input type="text" id="link-name-input" value="${initialName}" placeholder="Ex: Site Eiffage">
        </div>
        <div class="form-group">
          <label for="link-url-input">URL du lien</label>
          <input type="text" id="link-url-input" value="${initialUrl}" placeholder="Ex: https://www.eiffage.com/">
        </div>
      </div>
      <div class="modal-actions">
        <button id="cancel-modal-btn" class="button-secondary">Annuler</button>
        <button id="confirm-modal-btn" class="button-primary">Valider</button>
      </div>
    </div>
  `;
  document.body.appendChild(modalOverlay);

  // Logique interne de la modale
  const closeModal = () => document.body.removeChild(modalOverlay);

  document
    .getElementById("cancel-modal-btn")
    .addEventListener("click", closeModal);

  document.getElementById("confirm-modal-btn").addEventListener("click", () => {
    const name = document.getElementById("link-name-input").value.trim();
    const url = document.getElementById("link-url-input").value.trim();

    if (!name || !url) {
      alert("Veuillez remplir le nom et l'URL du lien.");
      return;
    }

    // Appelle la fonction de callback avec les données saisies
    onConfirm(name, url);
    closeModal();
  });
}
// On exporte toujours la fonction
export { renderHomePage, renderLinkModal };
