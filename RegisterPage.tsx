import { create } from 'zustand';
import { User } from '../types';
import { authService } from '../services/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isAuthenticated: !!localStorage.getItem('bana_access_token'),

  login: async (email, password) => {
    set({ isLoading: true });
    const { data } = await authService.login(email, password);
    localStorage.setItem('bana_access_token', data.accessToken);
    localStorage.setItem('bana_refresh_token', data.refreshToken);
    set({ user: data.member, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    try { await authService.logout(); } catch { /* */ }
    localStorage.removeItem('bana_access_token');
    localStorage.removeItem('bana_refresh_token');
    set({ user: null, isAuthenticated: false });
  },

  fetchMe: async () => {
    set({ isLoading: true });
    try {
      const { data } = await authService.me();
      set({ user: data.member, isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));
