import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:9002",
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    supportFile: "cypress/support/e2e.ts",
    video: false,
    screenshotOnRunFailure: true,
  },
  env: {
    // Backend do docker-compose local. Sobrescrever via CYPRESS_apiUrl em outros ambientes.
    apiUrl: "http://localhost:8002/api",
  },
});
