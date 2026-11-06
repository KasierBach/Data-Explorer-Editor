import { createContext, useContext, useEffect, useState } from 'react';
import { useTheme } from '@/presentation/components/theme-provider';

type LandingTheme = 'light' | 'dark';

const storageKey = 'data-explorer-landing-theme';

export const LandingAppearanceContext = createContext<{ theme: LandingTheme; setTheme: (theme: LandingTheme) => void }>({
    theme: 'dark',
    setTheme: () => {},
});

export function useLandingTheme(initialTheme?: LandingTheme) {
    const { theme: appTheme } = useTheme();
    const [selection, setSelection] = useState<LandingTheme | null>(() => {
        if (initialTheme) return initialTheme;
        try {
            const saved = localStorage.getItem(storageKey);
            return saved === 'light' || saved === 'dark' ? saved : null;
        } catch {
            return null;
        }
    });
    const [systemDark, setSystemDark] = useState(() => typeof window === 'undefined' || window.matchMedia('(prefers-color-scheme: dark)').matches);

    useEffect(() => {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const frame = window.requestAnimationFrame(() => {
            if (!initialTheme) return;
            try {
                const saved = localStorage.getItem(storageKey);
                const app = localStorage.getItem('vite-ui-theme');
                setSelection(saved === 'light' || saved === 'dark' ? saved : app === 'light' || app === 'dark' ? app : app === 'system' ? (media.matches ? 'dark' : 'light') : initialTheme);
            } catch {
                setSelection(initialTheme);
            }
        });
        const onChange = () => setSystemDark(media.matches);
        media.addEventListener('change', onChange);
        return () => {
            window.cancelAnimationFrame(frame);
            media.removeEventListener('change', onChange);
        };
    }, [initialTheme]);

    const theme = selection ?? (appTheme === 'system' ? (systemDark ? 'dark' : 'light') : appTheme);
    const setTheme = (value: LandingTheme) => {
        setSelection(value);
        try {
            localStorage.setItem(storageKey, value);
        } catch {
            // The appearance control still works when local storage is unavailable.
        }
    };

    return { theme, setTheme };
}

export const useLandingAppearance = () => useContext(LandingAppearanceContext);
