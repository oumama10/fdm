import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../api/axios';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshTokenValue: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      login: async (email, password) => {
        const res = await apiClient.post('/auth/login/', {
          email: String(email || '').trim(),
          password: String(password || '').trim(),
        });

        const accessToken = res.data.accessToken || res.data.access_token;
        const refreshToken = res.data.refreshToken || res.data.refresh_token;
        if (!accessToken || !refreshToken) {
          throw new Error('Login response missing tokens');
        }

        set({
          user: res.data.user,
          accessToken,
          refreshTokenValue: refreshToken,
          isAuthenticated: true,
        });
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
      },
      logout: () => {
        set({ user: null, accessToken: null, refreshTokenValue: null, isAuthenticated: false });
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      },
      refreshAccessToken: async () => {
        const refreshToken = get().refreshTokenValue || localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const res = await apiClient.post('/auth/refresh/', { refresh: refreshToken });
        set({ accessToken: res.data.access });
        localStorage.setItem('accessToken', res.data.access);
        return res.data.access;
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshTokenValue: state.refreshTokenValue,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
