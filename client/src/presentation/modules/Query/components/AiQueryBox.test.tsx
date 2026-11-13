import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiService } from '@/core/services/api.service';
import { AiQueryBox } from './AiQueryBox';

const accountPolicy = vi.hoisted(() => ({ enabled: true }));

vi.mock('@/core/services/api.service', () => ({ apiService: { post: vi.fn() } }));
vi.mock('@/core/services/aiAccountPolicy', () => ({
    isAiEnabled: () => accountPolicy.enabled,
    assertAiEnabled: () => {
        if (!accountPolicy.enabled) throw new Error('AI is disabled for this account.');
    },
}));
vi.mock('@/core/services/store', () => ({
    useAppStore: () => ({ lang: 'en', aiModel: 'auto', aiRoutingMode: 'auto' }),
}));
vi.mock('@/core/services/aiPreferences', () => ({
    useAiPreferences: () => ({ enabled: accountPolicy.enabled, assistantModel: 'auto', sqlModel: 'auto', customProviders: [], disabledProviders: ['groq'], fallbackProvider: 'none' }),
    resolveAiSelection: () => ({ model: 'auto' }),
}));
vi.mock('sonner', () => ({
    toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

describe('AiQueryBox', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        accountPolicy.enabled = true;
    });

    it.each(['button', 'shortcut'])('blocks %s dispatch after the account is disabled without clearing a preview', async (entrypoint) => {
        vi.mocked(apiService.post).mockResolvedValue({ sql: 'DELETE FROM users', explanation: 'Deletes rows.' });
        const onGenerate = vi.fn();
        render(<AiQueryBox onGenerate={onGenerate} currentConnectionId="connection-1" />);
        fireEvent.click(screen.getByText('Type natural language to generate SQL...'));
        const prompt = screen.getByPlaceholderText('Describe what you want to query in natural language...');
        fireEvent.change(prompt, { target: { value: 'Remove inactive users' } });
        fireEvent.click(screen.getByRole('button', { name: 'Generate SQL' }));
        expect(await screen.findByText('DELETE FROM users')).toBeVisible();

        vi.mocked(apiService.post).mockClear();
        accountPolicy.enabled = false;
        if (entrypoint === 'button') {
            fireEvent.click(screen.getByRole('button', { name: 'Generate SQL' }));
        } else {
            fireEvent.keyDown(prompt, { key: 'Enter', ctrlKey: true });
        }
        await waitFor(() => expect(apiService.post).not.toHaveBeenCalled());
        expect(onGenerate).not.toHaveBeenCalled();
        expect(screen.getByText('DELETE FROM users')).toBeVisible();
    });

    it('disables generation for an AI-off account while leaving the draft visible', () => {
        accountPolicy.enabled = false;
        render(<AiQueryBox onGenerate={vi.fn()} currentConnectionId="connection-1" />);
        fireEvent.click(screen.getByText('Type natural language to generate SQL...'));
        fireEvent.change(screen.getByPlaceholderText('Describe what you want to query in natural language...'), {
            target: { value: 'List users' },
        });
        expect(screen.getByRole('button', { name: 'Generate SQL' })).toBeDisabled();
        expect(apiService.post).not.toHaveBeenCalled();
    });

    it('forwards disabled providers and strict fallback on enabled SQL dispatch', async () => {
        vi.mocked(apiService.post).mockResolvedValue({ sql: 'SELECT 1', explanation: 'One row.' });
        render(<AiQueryBox onGenerate={vi.fn()} currentConnectionId="connection-1" />);
        fireEvent.click(screen.getByText('Type natural language to generate SQL...'));
        fireEvent.change(screen.getByPlaceholderText('Describe what you want to query in natural language...'), {
            target: { value: 'Return one row' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Generate SQL' }));
        await waitFor(() => expect(apiService.post).toHaveBeenCalledWith('/ai/nlp-to-sql', expect.objectContaining({
            disabledProviders: ['groq'], fallbackProvider: 'none',
        })));
    });

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
