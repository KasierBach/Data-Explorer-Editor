import { API_BASE_URL } from '../config/env';
import { useAppStore } from './store';
import type { AuthUser } from './store/slices/authSlice';

export class ApiError extends Error {
  statusCode?: number;
  reason?: string;
  action?: string;
  details?: unknown;
  data?: Record<string, unknown>;
}

class ApiService {
  private baseUrl = API_BASE_URL;
  private refreshPromise: Promise<boolean> | null = null;
  private refreshContext: { version: number; token: string | null; userKey: string | null } | null = null;
  private sessionVersion = 0;
  private isLoggingOut = false;

  private invalidateSession() {
    this.sessionVersion += 1;
    this.refreshPromise = null;
    this.refreshContext = null;
  }

  private logoutInvalidSession() {
    this.invalidateSession();
    useAppStore.getState().logout({ preserveWorkspace: true });
  }

  beginLogout() {
    this.invalidateSession();
    this.isLoggingOut = true;
  }

  endLogout() {
    this.isLoggingOut = false;
  }

  public getHeaders(customHeaders: Record<string, string> = {}) {
    const token = useAppStore.getState().accessToken;
    const lang = useAppStore.getState().lang || 'vi';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Accept-Language': lang,
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
    const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
    const rawMessage = errorData.message;
    const messageText = Array.isArray(rawMessage)
      ? rawMessage.filter((item): item is string => typeof item === 'string').join('; ')
      : typeof rawMessage === 'string'
        ? rawMessage
        : `API Error: ${response.status} ${response.statusText}`;
    const error = new ApiError(messageText);
    error.statusCode = typeof errorData.statusCode === 'number' ? errorData.statusCode : response.status;
    error.reason = typeof errorData.reason === 'string' ? errorData.reason : undefined;
    error.action = typeof errorData.action === 'string' ? errorData.action : undefined;
    error.details = errorData.details;
    error.data = errorData;
    return error;
  }

  private async tryRefreshSession() {
    if (this.isLoggingOut) {
      return false;
    }

    const state = useAppStore.getState();
    const context = {
      version: this.sessionVersion,
      token: state.accessToken,
      userKey: state.user?.id || state.user?.email || null,
    };
    if (
      this.refreshPromise
      && this.refreshContext?.version === context.version
      && this.refreshContext.token === context.token
      && this.refreshContext.userKey === context.userKey
    ) {
      return this.refreshPromise;
    }

    this.refreshContext = context;
    const ownsSession = () => {
      const current = useAppStore.getState();
      return !this.isLoggingOut
        && this.sessionVersion === context.version
        && this.refreshContext === context
        && current.accessToken === context.token
        && (current.user?.id || current.user?.email || null) === context.userKey;
    };
    this.refreshPromise = Promise.resolve().then(async () => {
      try {
        if (!ownsSession()) {
          return false;
        }

        const response = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept-Language': useAppStore.getState().lang || 'vi',
          },
          credentials: 'include',
          body: JSON.stringify({}),
        });

        if (!ownsSession()) {
          return false;
        }
        if (!response.ok) {
          this.logoutInvalidSession();
          return false;
        }

        const data = await this.parseResponse<{
          access_token?: string;
          accessTokenExpiresAt?: number;
          user?: AuthUser;
        }>(response);

        if (!ownsSession()) {
          return false;
        }
        if (!data?.access_token || !data.user) {
          this.logoutInvalidSession();
          return false;
        }

        useAppStore.getState().restoreSession(data.access_token, data.user, data.accessTokenExpiresAt ?? null);
        return true;
      } catch {
        if (ownsSession()) {
          this.logoutInvalidSession();
        }
        return false;
      } finally {
        if (this.refreshContext === context) {
          this.refreshPromise = null;
          this.refreshContext = null;
        }
      }
    });

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

    const sessionVersion = this.sessionVersion;
    const requestState = useAppStore.getState();
    const userKey = requestState.user?.id || requestState.user?.email || null;
    const token = new Headers(options.headers).get('Authorization');
    const ownsSession = () => {
      const current = useAppStore.getState();
      return !this.isLoggingOut
        && this.sessionVersion === sessionVersion
        && (current.user?.id || current.user?.email || null) === userKey;
    };
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      credentials: 'include',
      ...options,
    });

    if (response.status === 401 && allowRefresh && endpoint !== '/auth/refresh' && endpoint !== '/auth/login' && ownsSession()) {
      const currentToken = useAppStore.getState().accessToken;
      const refreshed = currentToken && token !== `Bearer ${currentToken}`
        ? true
        : await this.tryRefreshSession();
      if (refreshed && ownsSession()) {
        return this.requestInternal<T>(
          endpoint,
          {
            ...options,
            headers: {
              ...(options.headers as Record<string, string>),
              ...this.getHeaders(),
            },
          },
          false,
        );
      }
    }

    if (!response.ok) {
      if (response.status === 401 && ownsSession() && token === new Headers(this.getHeaders()).get('Authorization')) {
        useAppStore.getState().logout({ preserveWorkspace: true });
      }
      throw await this.buildApiError(response);
    }

    const data = await this.parseResponse<T>(response);
    if (endpoint !== '/auth/logout' && !ownsSession()) {
      const error = new ApiError('Session changed during request');
      error.reason = 'SESSION_CHANGED';
      throw error;
    }
    return data;
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
    body: unknown,
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
    body: unknown,
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
