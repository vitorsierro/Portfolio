// A row do gerenciador de posts usa nomes de classe de CSS Modules (hash em
// build de producao), entao os seletores aqui navegam pela estrutura do DOM
// a partir de texto visivel em vez de depender de className.
function rowFor(title) {
  return cy.contains('span', title).parents().eq(1);
}

describe('CRUD de posts no admin', () => {
  const stamp = `${Date.now()}`;
  const title = `Post de teste Cypress ${stamp}`;
  const slug = `post-de-teste-cypress-${stamp}`;
  const updatedTitle = `${title} (editado)`;

  beforeEach(() => {
    cy.loginAsAdmin();
  });

  afterEach(() => {
    cy.deletePostBySlug(slug);
  });

  it('cria, publica, edita e exclui um post (ciclo completo)', () => {
    // --- criar como rascunho -------------------------------------------
    cy.visit('/admin/posts/new');
    cy.get('#title').type(title);
    cy.get('#slug').should('have.value', slug);
    cy.get('#body').type('Conteudo de teste gerado pelo Cypress.');
    cy.contains('button', 'Salvar').click();
    cy.location('pathname', { timeout: 10000 }).should('eq', '/admin');

    // --- aparece na listagem como rascunho -------------------------------
    cy.visit('/admin/posts');
    cy.get('input[aria-label="Buscar posts"]').type(slug);
    rowFor(title).should('contain.text', 'Rascunho');

    // --- publicar ---------------------------------------------------------
    rowFor(title).contains('button', 'Publicar').click();
    rowFor(title).should('contain.text', 'Publicado');

    // O post publicado deve ficar visivel no blog publico.
    cy.request(`/blog/post/${slug}`).its('status').should('eq', 200);

    // --- editar o titulo ----------------------------------------------
    rowFor(title).contains('a', 'Editar').click();
    cy.location('pathname').should('match', /^\/admin\/posts\/[^/]+$/);
    cy.get('#title').clear().type(updatedTitle);
    cy.contains('button', 'Salvar').click();
    cy.location('pathname', { timeout: 10000 }).should('eq', '/admin');

    cy.visit('/admin/posts');
    cy.get('input[aria-label="Buscar posts"]').type(slug);
    cy.contains('span', updatedTitle).should('be.visible');
    // Match exato: `title` e substring de `updatedTitle`, entao
    // cy.contains('span', title) tambem acharia o span ja editado.
    cy.contains('span', new RegExp(`^${title}$`)).should('not.exist');

    // --- excluir ------------------------------------------------------
    rowFor(updatedTitle).contains('button', 'Excluir').click();
    cy.contains('span', updatedTitle).should('not.exist');
    cy.contains(`Nenhum post encontrado para “${slug}”.`);
  });

  it('recusa criar um post com slug duplicado', () => {
    cy.visit('/admin/posts/new');
    cy.get('#title').type(title);
    cy.get('#body').type('Primeiro post com este slug.');
    cy.contains('button', 'Salvar').click();
    cy.location('pathname', { timeout: 10000 }).should('eq', '/admin');

    cy.visit('/admin/posts/new');
    cy.get('#title').type(`${title} duplicado`);
    cy.get('#slug').clear().type(slug);
    cy.get('#body').type('Segundo post tentando reusar o mesmo slug.');
    cy.contains('button', 'Salvar').click();

    cy.contains('Ja existe um post com esse slug.').should('be.visible');
    cy.location('pathname').should('match', /\/admin\/posts\/new$/);
  });

  it('a busca filtra a listagem por titulo', () => {
    cy.visit('/admin/posts');
    cy.get('input[aria-label="Buscar posts"]').type('post de exemplo 1');
    cy.get('[role="status"]').should('contain.text', 'resultado');
    cy.contains('span', 'Post de exemplo 1').should('be.visible');
    cy.contains('span', 'Post de exemplo 2').should('not.exist');
  });
});
