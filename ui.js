/**
 * Module pour la manipulation du DOM et la mise à jour de l'interface utilisateur.
 */

function renderHomePage(container) {
  container.innerHTML = `
    <div class="home-container">
        <h1>Portail de Liens</h1>
        <p>Accédez rapidement à vos ressources externes.</p>
        <div class="home-button-list">
            <button>Lien Fictif 1</button>
            <button>Lien Fictif 2</button>
            <button>Lien Fictif 3</button>
            <button>Lien Fictif 4</button>
        </div>
    </div>
  `;
}

export { renderHomePage };
