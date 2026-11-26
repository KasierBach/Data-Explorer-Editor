// @vitest-environment happy-dom
// jsdom 29 makes `window.location` unforgeable, so this file runs under
// happy-dom where the location object can be stubbed for the reload test.
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

const originalLocation = window.location;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
});

describe('ErrorBoundary', () => {
  it('offers an in-place retry before a full page reload', () => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, href: 'https://example.test/private?mode=sql#saved', replace: reload },
    });

    function BrokenView(): ReactElement {
      throw new Error('broken view');
    }

    render(
      <ErrorBoundary>
        <BrokenView />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reload page' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('retries an ordinary render failure in place without clearing saved drafts', () => {
    let broken = true;
    function RecoverableView() {
      if (broken) throw new Error('SYNTHETIC_RENDER_SECRET');
      return <p>Recovered view</p>;
    }
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, href: 'https://example.test/private?mode=sql#saved', replace: reload } });
    localStorage.setItem('boundary-test-draft', 'SELECT preserved_draft');
    sessionStorage.setItem('boundary-test-session', 'preserved session');
    render(<ErrorBoundary><RecoverableView /></ErrorBoundary>);
    expect(document.body.textContent).not.toContain('SYNTHETIC_RENDER_SECRET');

    broken = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Recovered view')).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
    expect(localStorage.getItem('boundary-test-draft')).toBe('SELECT preserved_draft');
    expect(sessionStorage.getItem('boundary-test-session')).toBe('preserved session');
    localStorage.removeItem('boundary-test-draft');
    sessionStorage.removeItem('boundary-test-session');
  });

  it.each([
    ['en', 'Failed to fetch dynamically imported module: https://example.test/chunk.js?token=SYNTHETIC_CHUNK_SECRET', 'Reload page'],
    ['vi', 'Loading chunk 42 failed: SYNTHETIC_CHUNK_SECRET', 'Tải lại trang'],
  ] as const)('offers only a user-requested reload for a %s chunk failure', (lang, message, reloadLabel) => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, href: 'https://example.test/private?mode=sql#saved', replace: reload } });
    function BrokenChunk(): ReactElement { throw new Error(message); }
    render(<ErrorBoundary lang={lang}><BrokenChunk /></ErrorBoundary>);

    expect(screen.queryByRole('button', { name: /Try again|Thử lại/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: reloadLabel })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SYNTHETIC_CHUNK_SECRET');
    expect(document.body.textContent).not.toContain('https://example.test');
    expect(reload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: reloadLabel }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
