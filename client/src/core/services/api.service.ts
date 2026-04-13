import { API_BASE_URL } from '../config/env';
import { useAppStore } from './store';

export class ApiError extends Error {
  statusCode?: number;
  reason?: string;
  action?: string;
  details?: any;
}

class ApiService {
  private baseUrl = API_BASE_URL;
  private refreshPromise: Promise<boolean> | null = null;
  private isLoggingOut = false;

  beginLogout() {
    this.isLoggingOut = true;
    this.refreshPromise = null;
  }

  endLogout() {
    this.isLoggingOut = false;
  }

  public getHeaders(customHeaders: Record<string, string> = {}) {
    const token = useAppStore.getState().accessToken;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...customHeaders,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const json = await response.json();
      if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
        return json.data as T;
      }
      return json as T;
    }
    return (await response.text()) as T;
  }

  private async buildApiError(response: Response) {
    const errorData = await response.json().catch(() => ({}));
    const error = new ApiError(
      errorData.message || `API Error: ${response.status} ${response.statusText}`,
    );
    error.statusCode = errorData.statusCode ?? response.status;
    error.reason = errorData.reason;
    error.action = errorData.action;
    error.details = errorData.details;
    return error;
  }

  private async tryRefreshSession() {
    if (this.isLoggingOut) {
      return false;
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        if (this.isLoggingOut) {
          return false;
        }

        const response = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'include',
          body: JSON.stringify({}),
        });

        if (!response.ok) {
          useAppStore.getState().logout();
          return false;
        }

        const data = await this.parseResponse<{
          access_token?: string;
          accessTokenExpiresAt?: number;
          user?: any;
        }>(response);

        if (!data?.access_token || !data.user) {
          useAppStore.getState().logout();
          return false;
        }

        useAppStore.getState().restoreSession(data.access_token, data.user, data.accessTokenExpiresAt ?? null);
        return true;
      } catch {
        useAppStore.getState().logout();
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async requestInternal<T>(
    endpoint: string,
    options: RequestInit,
    allowRefresh: boolean,
  ): Promise<T> {
    if (this.isLoggingOut && endpoint !== '/auth/logout') {
      throw new ApiError('Logout in progress');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      credentials: 'include',
      ...options,
    });

    if (response.status === 401 && allowRefresh && endpoint !== '/auth/refresh' && endpoint !== '/auth/login') {
      const refreshed = await this.tryRefreshSession();
      if (refreshed) {
        return this.requestInternal<T>(endpoint, options, false);
      }
    }

    if (!response.ok) {
      if (response.status === 401) {
        useAppStore.getState().logout();
      }
      throw await this.buildApiError(response);
    }

    return this.parseResponse<T>(response);
  }

  async get<T>(endpoint: string, headers: Record<string, string> = {}, allowRefresh = true): Promise<T> {
    return this.requestInternal<T>(
      endpoint,
      {
        method: 'GET',
        headers: this.getHeaders(headers),
      },
      allowRefresh,
    );
  }

  async post<T>(
    endpoint: string,
    body: any,
    headers: Record<string, string> = {},
    allowRefresh = true,
  ): Promise<T> {
    return this.requestInternal<T>(
      endpoint,
      {
        method: 'POST',
        headers: this.getHeaders(headers),
        body: JSON.stringify(body),
      },
      allowRefresh,
    );
  }

  async patch<T>(
    endpoint: string,
    body: any,
    headers: Record<string, string> = {},
    allowRefresh = true,
  ): Promise<T> {
    return this.requestInternal<T>(
      endpoint,
      {
        method: 'PATCH',
        headers: this.getHeaders(headers),
        body: JSON.stringify(body),
      },
      allowRefresh,
    );
  }

  async delete<T>(endpoint: string, headers: Record<string, string> = {}, allowRefresh = true): Promise<T> {
    return this.requestInternal<T>(
      endpoint,
      {
        method: 'DELETE',
        headers: this.getHeaders(headers),
      },
      allowRefresh,
    );
  }

  async request<T>(endpoint: string, options: RequestInit, allowRefresh = true): Promise<T> {
    return this.requestInternal<T>(
      endpoint,
      {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...(options.headers as Record<string, string>),
        },
      },
      allowRefresh,
    );
  }
}

export const apiService = new ApiService();
