import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
    // Todos os arquivos de teste compartilham o mesmo banco Postgres de teste
    // (não há isolamento por worker) — rodar em sequência evita testes
    // pisando nos dados uns dos outros.
    fileParallelism: false,
  },
});
