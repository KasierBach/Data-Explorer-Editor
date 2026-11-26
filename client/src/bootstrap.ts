import { showStartupFallback } from './startupRecovery';

// Keep the document entry free of application singletons so recovery uses one fresh module graph.
void import('./main').catch(() => {
    const root = document.getElementById('root');
    if (root) showStartupFallback(root, document.documentElement.lang);
});
