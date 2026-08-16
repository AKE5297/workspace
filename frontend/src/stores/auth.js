import { defineStore } from 'pinia';
import { authApi } from '@/api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('wc_token') || '',
    user: JSON.parse(localStorage.getItem('wc_user') || 'null')
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.token)
  },
  actions: {
    async login(username, password) {
      const { data } = await authApi.login({ username, password });
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('wc_token', data.token);
      localStorage.setItem('wc_user', JSON.stringify(data.user));
    },
    async register(username, password, email) {
      const { data } = await authApi.register({ username, password, email });
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('wc_token', data.token);
      localStorage.setItem('wc_user', JSON.stringify(data.user));
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('wc_token');
      localStorage.removeItem('wc_user');
    }
  }
});
