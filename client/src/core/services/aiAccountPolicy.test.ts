import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiService } from './api.service';
import { useAppStore } from './store';
import { assertAiEnabled, isAiEnabled, setAiEnabled, useAiAccountPolicy } from './aiAccountPolicy';

const account = { id: 'user-a', email: 'a@example.com', aiEnabled: false };

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

beforeEach(() => {
    useAppStore.setState({ isAuthenticated: true, isAuthBootstrapped: true, user: { ...account } });
});
afterEach(() => {
    vi.restoreAllMocks();
    useAppStore.setState({ isAuthenticated: false, isAuthBootstrapped: false, user: null });
});

describe('AI account policy', () => {
    it('fails closed for missing, disabled or not-yet-hydrated accounts', () => {
        expect(isAiEnabled()).toBe(false);
        expect(assertAiEnabled).toThrow(/disabled/);
        useAppStore.setState({ user: { ...account, aiEnabled: true } });
        expect(isAiEnabled()).toBe(true);
        useAppStore.setState({ isAuthBootstrapped: false });
        expect(isAiEnabled()).toBe(false);
        useAppStore.setState({ isAuthBootstrapped: true, user: { id: 'user-a', email: account.email } });
        expect(isAiEnabled()).toBe(false);
        useAppStore.setState({ isAuthenticated: false, user: { ...account, aiEnabled: true } });
        expect(isAiEnabled()).toBe(false);
    });

    it('does not enable or persist consent locally before the server confirms', async () => {
        const response = deferred<{ id: string; aiEnabled: boolean }>();
        const patch = vi.spyOn(apiService, 'patch').mockReturnValue(response.promise);
        const { result } = renderHook(useAiAccountPolicy);
        let update!: Promise<void>;
        act(() => { update = setAiEnabled(true); });
        expect(patch).toHaveBeenCalledWith('/users/settings', { aiEnabled: true });
        expect(result.current.enabled).toBe(false);
        expect(result.current.isSaving).toBe(true);
        expect(useAppStore.getState().user?.aiEnabled).toBe(false);
        await act(async () => { response.resolve({ id: account.id, aiEnabled: true }); await update; });
        expect(result.current.enabled).toBe(true);
        expect(result.current.isSaving).toBe(false);
    });

    it('restores the confirmed account setting after a failed save and prevents duplicate updates', async () => {
        useAppStore.setState({ user: { ...account, aiEnabled: true } });
        const response = deferred<{ id: string; aiEnabled: boolean }>();
        const patch = vi.spyOn(apiService, 'patch').mockReturnValue(response.promise);
        const { result } = renderHook(useAiAccountPolicy);
        let update!: Promise<void>;
        act(() => { update = setAiEnabled(false); });
        expect(isAiEnabled()).toBe(false);
        await expect(setAiEnabled(true)).rejects.toMatchObject({ reason: 'AI_SETTING_PENDING' });
        const failed = expect(update).rejects.toThrow('fixture save failed');
        await act(async () => { response.reject(new Error('fixture save failed')); await failed; });
        expect(patch).toHaveBeenCalledTimes(1);
        expect(result.current.isSaving).toBe(false);
        expect(result.current.enabled).toBe(true);
        expect(useAppStore.getState().user?.aiEnabled).toBe(true);
    });

    it('does not apply a confirmed save to a replacement account', async () => {
        const response = deferred<{ id: string; aiEnabled: boolean }>();
        vi.spyOn(apiService, 'patch').mockReturnValue(response.promise);
        const update = setAiEnabled(true);
        useAppStore.setState({ user: { id: 'user-b', email: 'b@example.com', aiEnabled: false } });
        response.resolve({ id: account.id, aiEnabled: true });
        await expect(update).rejects.toMatchObject({ reason: 'SESSION_CHANGED' });
        expect(useAppStore.getState().user).toMatchObject({ id: 'user-b', aiEnabled: false });
    });

    it.each([
        { id: 'user-b', aiEnabled: true },
        { id: 'user-a', aiEnabled: false },
        { id: 'user-a' },
    ])('rejects an unconfirmed or wrong-account response %j', async response => {
        vi.spyOn(apiService, 'patch').mockResolvedValue(response);
        await expect(setAiEnabled(true)).rejects.toThrow(/did not confirm/);
        expect(useAppStore.getState().user?.aiEnabled).toBe(false);
    });

    it('refuses settings requests while signed out', async () => {
        const patch = vi.spyOn(apiService, 'patch');
        useAppStore.setState({ isAuthenticated: false, user: null });
        await expect(setAiEnabled(true)).rejects.toThrow(/authenticated account/);
        expect(patch).not.toHaveBeenCalled();
    });
});
