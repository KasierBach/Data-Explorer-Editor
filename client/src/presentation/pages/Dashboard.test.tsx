import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '@/core/services/store';
import { getWorkspaceText } from '@/core/utils/workspaceText';
import { Dashboard } from './Dashboard';

vi.mock('@tanstack/react-query', () => ({
    useQuery: () => ({ data: [] }),
}));
vi.mock('@/presentation/components/shared/LanguageSwitcher', () => ({
    LanguageSwitcher: () => null,
}));
vi.mock('../modules/Connection/ShareConnectionDialog', () => ({
    ShareConnectionDialog: () => null,
}));
vi.mock('../modules/Dashboard/InsightsDashboard', () => ({
    InsightsDashboard: () => <div>Insights fixture</div>,
}));

const initialState = useAppStore.getInitialState();

function insightsButton(lang: string) {
    const title = getWorkspaceText(lang).dashboardPage.insightsTitle;
    return screen.getByRole('heading', { name: title }).closest('button')!;
}

describe('Dashboard quick action alignment', () => {
    beforeEach(() => {
        useAppStore.setState({ ...initialState, connections: [], queryHistory: [], expandedNodes: [] }, true);
    });
    afterEach(() => {
        cleanup();
        useAppStore.setState(initialState, true);
    });

    it.each([
        ['vi', 'connection-1'],
        ['vi', null],
        ['en', 'connection-1'],
        ['en', null],
    ] as const)('keeps all four cards left-aligned with language=%s and connection=%s', (lang, activeConnectionId) => {
        useAppStore.setState({ lang, activeConnectionId });
        render(<Dashboard />);
        const text = getWorkspaceText(lang).dashboardPage;

        for (const title of [text.newQueryTitle, text.newConnectionTitle, text.browseDataTitle, text.insightsTitle]) {
            expect(screen.getByRole('heading', { name: title }).closest('button')).toHaveClass('text-left');
        }
        if (!activeConnectionId) {
            expect(insightsButton(lang)).toBeDisabled();
            expect(screen.getByText(text.selectConnectionFirst)).toHaveClass('text-center');
        }
    });

    it('preserves the active connection action when opening Insights', () => {
        useAppStore.setState({ lang: 'vi', activeConnectionId: 'connection-1' });
        render(<Dashboard />);

        fireEvent.click(insightsButton('vi'));

        expect(screen.getByText('Insights fixture')).toBeInTheDocument();
        expect(useAppStore.getState().activeConnectionId).toBe('connection-1');
    });
});
