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

  const buttonsHtml =
    links.length > 0
      ? links
          .map(
            (link) =>
              `<button class="link-button" data-url="${link.url}" data-name="${link.name}">
          ${link.name}
        </button>`,
          )
          .join("")
      : "<p>Aucun lien n'est configuré.</p>";

  container.innerHTML = `
    <div class="home-container">
        ${configControlsHtml} {/* Les boutons de gestion s'affichent ici */}
        <h1>Portail de Liens</h1>
        <p>Accédez rapidement à vos ressources externes.</p>
        <div class="home-button-list">
            ${buttonsHtml}
        </div>
    </div>
  `;
}

// On exporte toujours la fonction
export { renderHomePage };
