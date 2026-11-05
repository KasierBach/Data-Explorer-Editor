import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LandingHeaderView } from './LandingHeaderView';

for (const appearance of ['default', 'landing'] as const) {
    describe(`${appearance} header logout`, () => {
        it('lets the logout callback finish before any document navigation', async () => {
            let finish!: () => void;
            const logout = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
            const navigate = vi.fn();
            render(<LandingHeaderView lang="en" isAuthenticated logout={logout} isMobileNavOpen={appearance === 'landing'} setIsMobileNavOpen={vi.fn()} language={null} navigate={navigate} appearance={appearance} />);
            fireEvent.click(screen.getByRole('button', { name: /^Logout$/ }));
            expect(logout).toHaveBeenCalledOnce();
            expect(navigate).not.toHaveBeenCalled();
            finish();
            await Promise.resolve();
            expect(navigate).not.toHaveBeenCalled();
        });
    });
}
