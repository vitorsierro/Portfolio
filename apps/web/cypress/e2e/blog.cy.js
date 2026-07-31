describe('Blog publico', () => {
  it('lista posts publicados e abre o detalhe de um deles', () => {
    cy.visit('/blog');

    // O seed local cria 15 posts de exemplo publicados — se o banco estiver
    // vazio, a asserção abaixo falha com uma mensagem clara em vez de um
    // clique silencioso em nada.
    cy.get('article').should('have.length.greaterThan', 0);

    cy.get('article').first().within(() => {
      cy.get('h2').invoke('text').as('postTitle');
      cy.get('a').first().click();
    });

    cy.location('pathname').should('match', /^\/blog\/post\//);
    cy.get('article h1').should('be.visible');
    cy.get('@postTitle').then((title) => {
      cy.get('article h1').should('contain.text', title.trim());
    });

    cy.contains('a', 'Voltar ao blog').click();
    cy.location('pathname').should('eq', '/blog');
  });

  it('carrega mais posts ao rolar ate o fim (infinite scroll)', () => {
    cy.visit('/blog');
    cy.get('article').its('length').then((initialCount) => {
      if (initialCount < 9) {
        cy.log('Menos de uma pagina de posts — nao ha o que paginar, pulando.');
        return;
      }
      cy.scrollTo('bottom');
      cy.get('article').its('length').should('be.gt', initialCount);
    });
  });
});
