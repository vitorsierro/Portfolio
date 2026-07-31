describe('Site publico', () => {
  it('carrega a home com as secoes do portfolio', () => {
    cy.visit('/');
    cy.get('header').should('be.visible');
    cy.contains('a', 'Blog', { matchCase: false }).should(
      'have.attr',
      'href',
      '/blog',
    );
    cy.get('footer').should('exist');
  });

  it('navega da home ate o blog pelo header', () => {
    cy.visit('/');
    cy.contains('a', 'Blog', { matchCase: false }).click();
    cy.location('pathname').should('eq', '/blog');
  });

  it('devolve 404 para um post inexistente', () => {
    cy.request({
      url: '/blog/post/este-slug-nao-existe-com-certeza',
      failOnStatusCode: false,
    }).its('status').should('eq', 404);
  });
});
