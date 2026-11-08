import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { KnowledgeHub } from './KnowledgeHub';
import { PublicExperienceContext } from './PublicExperienceContext';
import { PublicNavigationContext } from './PublicNavigationContext';
import { resolvePublicRoute } from '@/core/seo/publicRoutes';

vi.mock('framer-motion', () => ({
    useReducedMotion: () => true,
    useSpring: () => ({ set: vi.fn(), jump: vi.fn() }),
    motion: { div: ({ children, className }: { children: React.ReactNode; className: string }) => <div className={className}>{children}</div> },
}));

describe('KnowledgeHub', () => {
    it('keeps deterministic decorative pages separate from useful links', () => {
        const route = resolvePublicRoute('/en/docs/introduction')!;
        const { container } = render(<PublicNavigationContext.Provider value={route}><PublicExperienceContext.Provider value={{ lang: 'en', paused: false, onToggleMotion: vi.fn() }}><KnowledgeHub /></PublicExperienceContext.Provider></PublicNavigationContext.Provider>);
        const scene = container.querySelector('.pe-scene')!;
        expect(scene).toHaveAttribute('aria-hidden', 'true');
        expect(scene.querySelectorAll('.kd-page')).toHaveLength(3);
        expect(scene.querySelector('a,button')).toBeNull();
        expect(screen.getAllByRole('link')).toHaveLength(4);
        expect(screen.getByRole('link', { name: 'SQL' })).toHaveAttribute('href', '/en/docs/editor');
        expect(screen.getByRole('link', { name: 'NoSQL' })).toHaveAttribute('href', '/en/docs/nosql-studio');
        expect(screen.getByRole('button', { name: 'Pause motion' }).closest('.pe-scene')).toBeNull();
    });

    it('renders the same decorative markup before browser enhancements', () => {
        const render = () => renderToString(<KnowledgeHub />);
        expect(render()).toBe(render());
        expect(render()).toContain('workspace.sql');
    });
});
