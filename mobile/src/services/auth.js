/**
 * Kalulu Auth Service
 * Handles user authentication, registration, and token management
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

const TOKEN_KEY = '@kalulu_token';
const USER_KEY = '@kalulu_user';

class AuthService {
  token = null;
  user = null;

  /**
   * Initialize auth state from storage
   */
  async init() {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      const userJson = await AsyncStorage.getItem(USER_KEY);
      
      if (token && userJson) {
        this.token = token;
        this.user = JSON.parse(userJson);
        return { token: this.token, user: this.user };
      }
    } catch (error) {
      console.error('Auth init error:', error);
    }
    return null;
  }

  /**
   * Register a new user
   */
  async register({ username, email, password, displayName }) {
    const response = await fetch(`${api.baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        email,
        password,
        display_name: displayName,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Registration failed');
    }

    const data = await response.json();
    await this.setSession(data.access_token, data.user);
    return data;
  }

  /**
   * Login with username/email and password
   */
  async login({ username, password }) {
    const response = await fetch(`${api.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    const data = await response.json();
    await this.setSession(data.access_token, data.user);
    return data;
  }

  /**
   * Logout and clear session
   */
  async logout() {
    try {
      if (this.token) {
        await fetch(`${api.baseUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    }

    await this.clearSession();
  }

  /**
   * Get current user profile
   */
  async getMe() {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${api.baseUrl}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        await this.clearSession();
        throw new Error('Session expired');
      }
      throw new Error('Failed to get user');
    }

    const user = await response.json();
    this.user = user;
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile({ displayName, avatarUrl }) {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${api.baseUrl}/auth/me`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        display_name: displayName,
        avatar_url: avatarUrl,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update profile');
    }

    const user = await response.json();
    this.user = user;
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  }

  /**
   * Store session data
   */
  async setSession(token, user) {
    this.token = token;
    this.user = user;
    
    await AsyncStorage.setItem(TOKEN_KEY, token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  /**
   * Clear session data
   */
  async clearSession() {
    this.token = null;
    this.user = null;
    
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
  }

  /**
   * Get authorization header
   */
  getAuthHeader() {
    if (!this.token) return {};
    return { 'Authorization': `Bearer ${this.token}` };
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.token;
  }
}

// Export singleton instance
export const auth = new AuthService();

export default AuthService;
