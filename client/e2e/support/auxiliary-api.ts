import type { Route } from '@playwright/test';

// These workspace bootstrap responses are incidental to the UI scenarios.
export async function fulfillAuxiliaryApi(route: Route): Promise<void> {
  const request = route.request();
  const { pathname } = new URL(request.url());
  let body: unknown;
  let status = 200;
  if (request.method() === 'POST' && pathname === '/api/ai/chats') {
    const payload = request.postDataJSON() as { title?: string };
    status = 201;
    body = { id: 'chat-e2e', title: payload.title || 'New conversation', createdAt: '2026-10-22T00:00:00.000Z', updatedAt: '2026-10-22T00:00:00.000Z' };
  } else if (request.method() === 'POST' && pathname === '/api/ai/autocomplete') {
    body = { completion: '' };
  } else if (request.method() === 'GET' && pathname === '/api/ai/providers/status') {
    body = { providers: { gemini: true } };
  } else if (request.method() === 'GET' && ['/api/saved-queries', '/api/connections', '/api/dashboards', '/api/organizations/me', '/api/organizations/invitations/me', '/api/ai/chats'].includes(pathname)) {
    body = [];
  } else {
    throw new Error(`Unexpected API request: ${request.method()} ${pathname}`);
  }
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: {
      'access-control-allow-credentials': 'true',
      'access-control-allow-origin': 'http://127.0.0.1:4173',
    },
    body: JSON.stringify(body),
  });
}
