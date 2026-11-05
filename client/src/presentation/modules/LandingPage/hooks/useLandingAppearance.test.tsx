import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/presentation/components/theme-provider';
import { LandingAppearanceContext, useLandingAppearance, useLandingTheme } from './useLandingAppearance';

function AppearanceControl() {
    const appearance = useLandingTheme();
    return <LandingAppearanceContext.Provider value={appearance}><Control /></LandingAppearanceContext.Provider>;
}

function Control() {
    const { theme, setTheme } = useLandingAppearance();
    return <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme}</button>;
}

describe('landing-only appearance', () => {
    beforeAll(() => {
        vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })));
    });
    afterAll(() => vi.unstubAllGlobals());

    it('starts from the app theme, saves locally, and never changes the workspace theme', async () => {
        const user = userEvent.setup();
        localStorage.removeItem('data-explorer-landing-theme');
        localStorage.setItem('vite-ui-theme', 'dark');
        const { unmount } = render(<ThemeProvider storageKey="vite-ui-theme"><AppearanceControl /></ThemeProvider>);
        expect(screen.getByRole('button', { name: 'dark' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'dark' }));
        expect(screen.getByRole('button', { name: 'light' })).toBeInTheDocument();
        expect(localStorage.getItem('data-explorer-landing-theme')).toBe('light');
        expect(localStorage.getItem('vite-ui-theme')).toBe('dark');
        expect(document.documentElement).toHaveClass('dark');
        unmount();

        render(<ThemeProvider storageKey="vite-ui-theme"><AppearanceControl /></ThemeProvider>);
        expect(screen.getByRole('button', { name: 'light' })).toBeInTheDocument();
        expect(document.documentElement).toHaveClass('dark');
    });
});
