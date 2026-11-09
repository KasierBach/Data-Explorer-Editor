import { useSyncExternalStore } from 'react';
import { ApiError, apiService } from './api.service';
import { useAppStore } from './store';

const pendingAccounts = new Set<string>();
const listeners = new Set<() => void>();

function authenticatedAccountId(): string | null {
    const state = useAppStore.getState();
    return state.isAuthenticated && state.isAuthBootstrapped && state.user?.id
        ? state.user.id
        : null;
}

export function isAiEnabled(): boolean {
    const accountId = authenticatedAccountId();
    return Boolean(accountId && !pendingAccounts.has(accountId) && useAppStore.getState().user?.aiEnabled === true);
}

export function assertAiEnabled(): void {
    if (isAiEnabled()) return;
    const error = new ApiError('AI is disabled for this account. Enable AI in your settings before contacting a provider.');
    error.statusCode = 403;
    error.reason = 'AI_DISABLED';
    throw error;
}

function isSaving(): boolean {
    const accountId = authenticatedAccountId();
    return Boolean(accountId && pendingAccounts.has(accountId));
}

function notifyPolicyChanged() {
    for (const listener of listeners) listener();
}

export function subscribeAiAccountPolicy(listener: () => void): () => void {
    listeners.add(listener);
    const unsubscribe = useAppStore.subscribe(listener);
    return () => {
        listeners.delete(listener);
        unsubscribe();
    };
}

export async function setAiEnabled(enabled: boolean): Promise<void> {
    const accountId = authenticatedAccountId();
    if (!accountId) throw new ApiError('An authenticated account is required to change AI settings.');
    if (typeof enabled !== 'boolean') throw new TypeError('AI enabled must be a Boolean.');
    if (pendingAccounts.has(accountId)) {
        const error = new ApiError('An AI setting update is already in progress.');
        error.reason = 'AI_SETTING_PENDING';
        throw error;
    }

    pendingAccounts.add(accountId);
    notifyPolicyChanged();
    try {
        const result = await apiService.patch<{ id: string; aiEnabled: boolean }>('/users/settings', { aiEnabled: enabled });
        if (authenticatedAccountId() !== accountId) {
            const error = new ApiError('Account changed while saving AI settings.');
            error.reason = 'SESSION_CHANGED';
            throw error;
        }
        if (result.id !== accountId || typeof result.aiEnabled !== 'boolean' || result.aiEnabled !== enabled) {
            throw new ApiError('The server did not confirm the requested AI setting.');
        }
        useAppStore.getState().updateUser({ aiEnabled: result.aiEnabled });
    } finally {
        pendingAccounts.delete(accountId);
        notifyPolicyChanged();
    }
}

export function useAiAccountPolicy() {
    const enabled = useSyncExternalStore(subscribeAiAccountPolicy, isAiEnabled, () => false);
    const saving = useSyncExternalStore(subscribeAiAccountPolicy, isSaving, () => false);
    return { enabled, isSaving: saving, setEnabled: setAiEnabled };
}
