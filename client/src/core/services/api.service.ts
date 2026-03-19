import { API_BASE_URL } from '../config/env';
import { useAppStore } from './store';

class ApiService {
  private baseUrl = API_BASE_URL;

  private getHeaders(customHeaders: Record<string, string> = {}) {
    const token = useAppStore.getState().accessToken;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private async handleResponse(response: Response) {
    if (!response.ok) {
      if (response.status === 401) {
        // Clear state and redirect on unauthorized
        useAppStore.getState().logout();
        // Option: window.location.href = '/login'; 
        // We'll let the user decide if they want a hard redirect or just state clear
        throw new Error('Phiên làm việc hết hạn. Vui lòng đăng nhập lại.');
      }

      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API Error: ${response.status} ${response.statusText}`);
    }

    // Check if response is empty (e.g. 204 No Content)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    return await response.text();
  }

  async get<T>(endpoint: string, headers: Record<string, string> = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders(headers),
    });
    return this.handleResponse(response) as Promise<T>;
  }

  async post<T>(endpoint: string, body: any, headers: Record<string, string> = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(headers),
      body: JSON.stringify(body),
    });
    return this.handleResponse(response) as Promise<T>;
  }

  async patch<T>(endpoint: string, body: any, headers: Record<string, string> = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PATCH',
      headers: this.getHeaders(headers),
      body: JSON.stringify(body),
    });
    return this.handleResponse(response) as Promise<T>;
  }

  async delete<T>(endpoint: string, headers: Record<string, string> = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(headers),
    });
    return this.handleResponse(response) as Promise<T>;
  }

  // Helper for multi-part/form-data or other cases
  async request<T>(endpoint: string, options: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...(options.headers as Record<string, string>),
      },
    });
    return this.handleResponse(response) as Promise<T>;
  }
}

export const apiService = new ApiService();
