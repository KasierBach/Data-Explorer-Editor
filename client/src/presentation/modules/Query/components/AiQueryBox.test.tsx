import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiService } from '@/core/services/api.service';
import { AiQueryBox } from './AiQueryBox';

vi.mock('@/core/services/api.service', () => ({ apiService: { post: vi.fn() } }));
vi.mock('@/core/services/store', () => ({
    useAppStore: () => ({ lang: 'en', aiModel: 'auto', aiRoutingMode: 'auto' }),
}));
vi.mock('@/core/services/aiPreferences', () => ({
    useAiPreferences: () => ({ assistantModel: 'auto', sqlModel: 'auto', customProviders: [] }),
    resolveAiSelection: () => ({ model: 'auto' }),
}));
vi.mock('sonner', () => ({
    toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

describe('AiQueryBox', () => {
    beforeEach(() => vi.clearAllMocks());

    it('previews risky generated SQL before inserting it into the editor', async () => {
        vi.mocked(apiService.post).mockResolvedValue({
            sql: 'DELETE FROM users',
            explanation: 'Deletes every user row.',
            generationId: '2c1cc849-e91f-4d54-9a40-9ac7c3f5d37f',
        });
        const onGenerate = vi.fn();

        render(<AiQueryBox onGenerate={onGenerate} currentConnectionId="connection-1" />);
        fireEvent.click(screen.getByText('Type natural language to generate SQL...'));
        fireEvent.change(screen.getByPlaceholderText('Describe what you want to query in natural language...'), {
            target: { value: 'Remove inactive users' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Generate SQL' }));

        expect(await screen.findByText('DELETE FROM users')).toBeVisible();
        expect(onGenerate).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Insert into editor' }));

        await waitFor(() => expect(onGenerate).toHaveBeenCalledWith('DELETE FROM users'));
        expect(screen.queryByText('DELETE FROM users')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Useful' }));
        await waitFor(() => expect(apiService.post).toHaveBeenNthCalledWith(2, '/ai/sql-feedback', {
            generationId: '2c1cc849-e91f-4d54-9a40-9ac7c3f5d37f',
            rating: 'up',
        }));
    });
});
