import { defineConfig } from 'orval';

export default defineConfig({
  outline: {
    input: './src/outline-api/outline-openapi-spec3.json',
    output: {
      target: './src/outline-api/generated-client/outlineAPI.ts',
      client: 'fetch',
      mode: 'single',
      override: {
        mutator: {
          path: './src/outline-api/custom-instance.ts',
          name: 'customInstance',
        },
      },
    },
  },
});
