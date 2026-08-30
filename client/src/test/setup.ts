import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

// Automatically cleanup after each test to prevent memory leaks and state pollution.
// `afterEach` is provided globally via `globals: true` in vite.config.ts; importing
// it from 'vitest' inside a setup file breaks suite resolution on Vitest 4.
afterEach(() => {
  cleanup();
});
