// Loga como admin pela UI de verdade (nao via cy.request): o token de acesso
// vive só em memória no cliente (ver lib/auth.js), entao pular o formulario
// deixaria o app sem accessToken e todo authFetch subsequente devolveria 401.
Cypress.Commands.add('loginAsAdmin', () => {
  const email = Cypress.env('adminEmail');
  const password = Cypress.env('adminPassword');
  if (!email || !password) {
    throw new Error(
      'Defina CYPRESS_ADMIN_EMAIL e CYPRESS_ADMIN_PASSWORD (credenciais do admin ' +
        'seedado localmente) antes de rodar specs que precisam de login. Ver cypress/README.md.',
    );
  }

  cy.session(
    [email, password],
    () => {
      cy.visit('/admin/login');
      cy.get('#email').type(email);
      cy.get('#password').type(password);
      cy.contains('button', 'Entrar').click();
      cy.location('pathname', { timeout: 10000 }).should('not.eq', '/admin/login');
    },
    {
      validate() {
        // Nao usar cy.visit numa rota protegida aqui: sem accessToken em
        // memoria (pagina recem-carregada), o AdminLayout dispara
        // ensureSession() -> refresh(), que ROTACIONA o refresh_token
        // (armadilha #7 do CLAUDE.md). O snapshot que o cy.session guardou é
        // de ANTES dessa rotacao, entao ele volta a ser restaurado (e
        // invalido) logo depois — todo cy.visit subsequente no teste cairia
        // em 401. /auth/verify confirma a sessao pelo admin_session (cookie
        // opaco, nao rotaciona nada) sem esse efeito colateral.
        cy.request({
          url: `${Cypress.env('apiUrl')}/auth/verify`,
          failOnStatusCode: false,
        })
          .its('status')
          .should('eq', 204);
      },
    },
  );
});

// Remove um post pelo slug direto na API, usando o mesmo admin de teste —
// usado no cleanup dos specs de CRUD para nao deixar lixo entre execucoes.
Cypress.Commands.add('deletePostBySlug', (slug) => {
  const apiUrl = Cypress.env('apiUrl');
  const email = Cypress.env('adminEmail');
  const password = Cypress.env('adminPassword');

  cy.request('POST', `${apiUrl}/auth/login`, { email, password }).then(
    ({ body }) => {
      cy.request({
        method: 'GET',
        url: `${apiUrl}/admin/posts?q=${encodeURIComponent(slug)}&limit=50`,
        headers: { Authorization: `Bearer ${body.accessToken}` },
        failOnStatusCode: false,
      }).then((res) => {
        const match = res.body?.items?.find((item) => item.slug === slug);
        if (!match) return;
        cy.request({
          method: 'DELETE',
          url: `${apiUrl}/posts/${match.id}`,
          headers: { Authorization: `Bearer ${body.accessToken}` },
          failOnStatusCode: false,
        });
      });
    },
  );
});
