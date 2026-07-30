describe('Autenticacao do admin', () => {
  beforeEach(() => {
    Cypress.session.clearAllSavedSessions();
  });

  it('redireciona para o login ao acessar uma rota protegida sem sessao', () => {
    cy.visit('/admin/posts');
    cy.location('pathname').should('eq', '/admin/login');
  });

  it('rejeita credenciais invalidas com uma mensagem de erro', () => {
    cy.visit('/admin/login');
    cy.get('#email').type('nao-existe@example.com');
    cy.get('#password').type('senha-errada-123');
    cy.contains('button', 'Entrar').click();

    cy.get('[role="alert"]').should('be.visible');
    cy.location('pathname').should('eq', '/admin/login');
  });

  it('loga com credenciais validas e chega no painel', () => {
    cy.loginAsAdmin();
    cy.visit('/admin');
    cy.location('pathname').should('eq', '/admin');
    cy.contains('h1', 'Painel').should('be.visible');
  });

  it('preserva o redirecionamento ?next= apos o login', () => {
    cy.visit('/admin/login?next=%2Fadmin%2Fposts');
    const email = Cypress.env('adminEmail');
    const password = Cypress.env('adminPassword');
    cy.get('#email').type(email);
    cy.get('#password').type(password);
    cy.contains('button', 'Entrar').click();
    cy.location('pathname', { timeout: 10000 }).should('eq', '/admin/posts');
  });

  it('faz logout e volta a exigir login nas rotas protegidas', () => {
    cy.loginAsAdmin();
    cy.visit('/admin');
    cy.contains('button', 'Menu').then(($btn) => {
      // No desktop o painel de navegacao ja fica visivel; no mobile precisa
      // abrir o menu antes de clicar em "Sair".
      if ($btn.is(':visible')) {
        cy.wrap($btn).click();
      }
    });
    cy.contains('button', 'Sair').click();
    cy.location('pathname', { timeout: 10000 }).should('eq', '/admin/login');

    cy.visit('/admin/posts');
    cy.location('pathname').should('eq', '/admin/login');
  });
});
