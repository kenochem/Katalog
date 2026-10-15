import { defineConfig } from 'vitest/config';

// Testy jednostkowe czystej logiki (parser nazw, wyszukiwarka, poziomy, zamówienia WAPRO…).
// Uruchamianie: npm test
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
