/**
 * Module pour la manipulation du DOM et la mise à jour de l'interface utilisateur.
 */

function renderHomePage(container, links) {
  // Génère le HTML pour chaque bouton
  const buttonsHtml =
    links.length > 0
      ? links
          .map(
            (link) =>
              // On ajoute des 'data-attributes' pour stocker l'URL et le nom, ce sera utile plus tard
              `<button class="link-button" data-url="${link.url}" data-name="${link.name}">
          ${link.name}
        </button>`,
          )
          .join("")
      : "<p>Aucun lien n'est configuré. Cliquez sur 'Configuration' pour en ajouter.</p>";

  container.innerHTML = `
    <div class="home-container">
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
