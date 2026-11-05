try {
    const stored = localStorage.getItem('vite-ui-theme');
    const theme = stored === 'light' || stored === 'dark' ? stored : stored === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : stored === 'system' ? 'light' : 'dark';
    document.documentElement.classList.add(theme);
} catch {
    document.documentElement.classList.add('dark');
}
