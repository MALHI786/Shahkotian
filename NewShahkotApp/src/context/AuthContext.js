import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [storedToken, storedUser] = await Promise.all([
        AsyncStorage.getItem('token'),
        AsyncStorage.getItem('user'),
      ]);

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Auth load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (loginData) => {
    const response = await authAPI.login(loginData);
    const { token: newToken, user: newUser } = response.data;

    await Promise.all([
      AsyncStorage.setItem('token', newToken),
      AsyncStorage.setItem('user', JSON.stringify(newUser)),
    ]);

    setToken(newToken);
    setUser(newUser);
    return newUser;
  };

  const register = async (userData) => {
    const response = await authAPI.register(userData);
    const { token: newToken, user: newUser } = response.data;

    await Promise.all([
      AsyncStorage.setItem('token', newToken),
      AsyncStorage.setItem('user', JSON.stringify(newUser)),
    ]);

    setToken(newToken);
    setUser(newUser);
    return newUser;
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['token', 'user']);
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    AsyncStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const isAdmin = user?.role === 'ADMIN';
  const isVerified = user?.role === 'VERIFIED_USER' || user?.role === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        updateUser,
        isAdmin,
        isVerified,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
