import { apiService } from './api.service';

export interface AuthResponse {
    access_token?: string;
    accessTokenExpiresAt?: number;
    user?: any;
    unverified?: boolean;
    email?: string;
    message?: string;
}

export class AuthService {
    static async login(email: string, password: string): Promise<AuthResponse> {
        return await apiService.post<AuthResponse>('/auth/login', { email, password }, {}, false);
    }

    static async exchangeOauthCode(code: string): Promise<AuthResponse> {
        return await apiService.post<AuthResponse>('/auth/exchange-oauth-code', { code }, {}, false);
    }

    static async refreshSession(): Promise<AuthResponse> {
        return await apiService.post<AuthResponse>('/auth/refresh', {}, {}, false);
    }

    static async logout(): Promise<{ message: string }> {
        return await apiService.post<{ message: string }>('/auth/logout', {}, {}, false);
    }

    static async register(name: string, email: string, password: string): Promise<AuthResponse> {
        return await apiService.post<AuthResponse>('/auth/register', { name, email, password }, {}, false);
    }

    static async verifyEmail(email: string, otp: string): Promise<AuthResponse> {
        return await apiService.post<AuthResponse>('/auth/verify-email', { email, otp }, {}, false);
    }

    static async resendVerification(email: string): Promise<{ message: string }> {
        return await apiService.post<{ message: string }>('/auth/resend-verification', { email }, {}, false);
    }

    static async forgotPassword(email: string): Promise<{ message: string }> {
        return await apiService.post<{ message: string }>('/auth/forgot-password', { email }, {}, false);
    }

    static async resetPassword(params: { email: string; otp: string; newPassword: string }): Promise<{ message: string }> {
        return await apiService.post<{ message: string }>('/auth/reset-password', params, {}, false);
    }

    static async getMe(token?: string): Promise<any> {
        return await apiService.get<any>('/users/me', token ? { Authorization: `Bearer ${token}` } : {});
    }

    static async onboard(formData: any, token?: string): Promise<any> {
        return await apiService.patch<any>('/users/profile/onboarding', formData, token ? { Authorization: `Bearer ${token}` } : {});
    }
}
