import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LandingHeader } from './LandingHeader';

function CurrentRoute() {
    return <output data-testid="route">{useLocation().pathname}</output>;
}

describe('LandingHeader router adapter', () => {
    it('waits for async logout before routing to login', async () => {
        let finish!: () => void;
        const logout = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
        render(<MemoryRouter initialEntries={['/changelog']}><LandingHeader lang="en" isAuthenticated logout={logout} isMobileNavOpen={false} setIsMobileNavOpen={vi.fn()} /><CurrentRoute /></MemoryRouter>);
        fireEvent.click(screen.getByRole('button', { name: /^Logout$/ }));
        expect(logout).toHaveBeenCalledOnce();
        expect(screen.getByTestId('route')).toHaveTextContent('/changelog');
        finish();
        expect(await screen.findByText('/login')).toBeInTheDocument();
    });
});
