import { expect, test, type Page, type Route } from '@playwright/test';
import { mockAuthenticatedApi } from './support/authenticated-api';

test('API mock fails on an undeclared endpoint instead of returning empty success', async () => {
  let handler!: Parameters<Page['route']>[1];
  const page: Pick<Page, 'route'> = {
    route: async (_pattern, callback) => {
      handler = callback;
      return { dispose: async () => {}, [Symbol.asyncDispose]: async () => {} };
    },
  };
  await mockAuthenticatedApi(page);

  for (const [method, path] of [
    ['GET', '/api/undeclared-endpoint'],
    ['POST', '/api/saved-queries'],
    ['POST', '/api/connections/not-the-fixture/health-check'],
    ['GET', '/api/connections/connection-e2e/health-check'],
  ]) {
    const route = {
      request: () => ({ method: () => method, url: () => `http://localhost:3001${path}` }),
      fulfill: async () => {},
    } as unknown as Route;
    await expect(handler(route, route.request())).rejects.toThrow(`Unexpected API request: ${method} ${path}`);
  }
});
