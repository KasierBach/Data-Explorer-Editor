import type { StateCreator } from 'zustand';

export interface AuthSlice {
    isAuthenticated: boolean;
    accessToken: string | null;
    user: { name: string; email: string } | null;
    login: (token: string, user: { name: string; email: string }) => void;
    logout: () => void;
    updateUser: (user: { name: string; email: string }) => void;
}

export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
    isAuthenticated: false,
    accessToken: null,
    user: null,
    login: (token, user) => set({
        isAuthenticated: true,
        accessToken: token,
        user,
        isConnectionDialogOpen: false,
    } as any),
    logout: () => set({ isAuthenticated: false, accessToken: null, user: null }),
    updateUser: (user) => set({ user }),
});
