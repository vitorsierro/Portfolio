const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.js',
    // Desktop fixo: o header vira menu hamburguer abaixo de 768px
    // (Menu.module.css), e os specs assumem a nav sempre visivel.
    viewportWidth: 1280,
    viewportHeight: 800,
    // Servidor local via `yarn dev` costuma levar mais de 4s para responder
    // em cold start; sem isto o primeiro comando de cada spec falha por timeout.
    defaultCommandTimeout: 8000,
    setupNodeEvents() {},
  },
  env: {
    apiUrl: process.env.CYPRESS_API_URL || 'http://localhost:3001',
    // Credenciais do admin seedado localmente (apps/api/.env, ADMIN_EMAIL /
    // ADMIN_PASSWORD). Nunca commitar valores reais aqui — configure via
    // cypress.env.json (gitignored) ou variaveis CYPRESS_ADMIN_EMAIL /
    // CYPRESS_ADMIN_PASSWORD. Ver cypress/README.md.
    adminEmail: process.env.CYPRESS_ADMIN_EMAIL || '',
    adminPassword: process.env.CYPRESS_ADMIN_PASSWORD || '',
  },
});
