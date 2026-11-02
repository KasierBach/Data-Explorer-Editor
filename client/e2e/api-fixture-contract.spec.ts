import { expect, test, type Page, type Route } from '@playwright/test';
import { mockAuthenticatedApi } from './support/authenticated-api';

test('API mock declares empty AI autocomplete as incidental workspace traffic', async () => {
  let handler!: Parameters<Page['route']>[1];
  let response: { body?: string; status?: number } | undefined;
  const page: Pick<Page, 'route'> = {
    route: async (_pattern, callback) => {
      handler = callback;
      return { dispose: async () => {}, [Symbol.asyncDispose]: async () => {} };
    },
  };
  await mockAuthenticatedApi(page);

  const route = {
    request: () => ({
      method: () => 'POST',
      url: () => 'http://localhost:3001/api/ai/autocomplete',
    }),
    fulfill: async (value: typeof response) => {
      response = value;
    },
  } as unknown as Route;
  await handler(route, route.request());

  expect(response?.status).toBe(200);
  expect(JSON.parse(response?.body ?? 'null')).toEqual({ completion: '' });
});

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
