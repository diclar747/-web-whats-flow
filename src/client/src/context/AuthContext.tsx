import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { storageManager } from '../utils/storageManager';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'agent' | 'supervisor';
  permissions: string[];
  plan?: {
    type: string;
    channels: number;
    agents: number;
    expiresAt: string;
  };
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verificar token guardado al inicializar
    const checkAuthStatus = async () => {
      try {
        // 🔒 LIMPIAR localStorage siempre al inicio (forzar sesiones únicas)
        const localStorageKeys = ['token', 'whatsflow_token', 'userRole', 'userName', 'userId', 'whatsflow_session', 'sessionToken'];
        localStorageKeys.forEach(key => localStorage.removeItem(key));
        console.log('🧹 localStorage limpiado - forzando sesiones únicas por pestaña');

        // SOLO buscar en sessionStorage (nunca en localStorage)
        const token = sessionStorage.getItem('whatsflow_token') || sessionStorage.getItem('token');

        if (token) {
          console.log('🔍 Token encontrado en sessionStorage, verificando...');
          const deviceId = sessionStorage.getItem('device_id');
          const sessionToken = sessionStorage.getItem('sessionToken');
          
          const response = await fetch('/api/auth/verify', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Session-Token': sessionToken || '',
              'X-Device-Id': deviceId || ''
            }
          });

          if (response.ok) {
            const userData = await response.json();
            setUser(userData.user);
            console.log('✅ Sesión restaurada correctamente');
          } else {
            // No limpiar sesión inmediatamente, puede ser problema temporal
            console.log('⚠️ Token no verificado, pero manteniendo para re-login');
            // Solo limpiar si el error es 401 (no autorizado), no 403 (forbidden/dispositivo diferente)
            if (response.status === 401) {
              console.log('❌ Token expirado/inválido (401), limpiando sesión');
              sessionStorage.clear();
            } else {
              console.log('⚠️ Error ' + response.status + ', manteniendo sesión para re-autenticación');
            }
          }
        } else {
          console.log('ℹ️ No se encontró token - nueva sesión requerida (debe autenticarse)');
        }
      } catch (error) {
        console.error('Error verificando autenticación:', error);
        sessionStorage.clear();
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUser(data.user);
        // El token ya fue guardado por el componente Login usando storageManager
        // Solo verificamos que esté presente
        if (!storageManager.getItem('whatsflow_token')) {
          storageManager.setItem('whatsflow_token', data.token);
        }
        return true;
      } else {
        console.error('Error de login:', data.error);
        return false;
      }
    } catch (error) {
      console.error('Error de conexión:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    const sessionToken = sessionStorage.getItem('sessionToken');
    
    // Notificar al servidor para destruir la sesión
    if (sessionToken) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken
        }
      }).catch(err => console.error('Error en logout:', err));
    }
    
    setUser(null);
    // Limpiar SOLO sessionStorage (sesiones únicas)
    sessionStorage.clear();
    console.log('👋 Sesión cerrada correctamente');
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 