import { apiService } from './api.service';

export interface AuthResponse {
    access_token?: string;
    user?: any;
    unverified?: boolean;
    email?: string;
    message?: string;
}

export class AuthService {
    static async login(email: string, password: string): Promise<AuthResponse> {
        return await apiService.post<AuthResponse>('/auth/login', { email, password });
    }

    static async register(name: string, email: string, password: string): Promise<AuthResponse> {
        return await apiService.post<AuthResponse>('/auth/register', { name, email, password });
    }

    static async verifyEmail(email: string, otp: string): Promise<AuthResponse> {
        return await apiService.post<AuthResponse>('/auth/verify-email', { email, otp });
    }

    static async resendVerification(email: string): Promise<{ message: string }> {
        return await apiService.post<{ message: string }>('/auth/resend-verification', { email });
    }

    static async forgotPassword(email: string): Promise<{ message: string }> {
        return await apiService.post<{ message: string }>('/auth/forgot-password', { email });
    }

    static async resetPassword(params: { email: string; otp: string; newPassword: string }): Promise<{ message: string }> {
        return await apiService.post<{ message: string }>('/auth/reset-password', params);
    }

    static async getMe(token?: string): Promise<any> {
        return await apiService.get<any>('/users/me', token ? { Authorization: `Bearer ${token}` } : {});
    }

    static async onboard(formData: any, token?: string): Promise<any> {
        return await apiService.patch<any>('/users/profile/onboarding', formData, token ? { Authorization: `Bearer ${token}` } : {});
    }
}
