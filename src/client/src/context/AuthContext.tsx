import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();

  useEffect(() => {
    // Verificar token guardado al inicializar
    const checkAuthStatus = async () => {
      try {
        // ✅ RELAXED DASHBOARD CHECK: 
        // No desactivar AuthContext completamente en /dashboard, solo si NO tenemos datos.
        const isAdminQRMode = window.location.pathname.startsWith('/dashboard');
        const hasStoredSession = !!(localStorage.getItem('token') || localStorage.getItem('whinsap_token'));

        if (isAdminQRMode && !hasStoredSession) {
          console.log('ℹ️ MODO DASHBOARD (SIN SESIÓN) - Esperando QR/Socket');
          setIsLoading(false);
          return;
        }

        console.log('🔄 AuthContext: Verificando sesión (soporte persistente habilitado)');

        // 🔧 FIX: PRIORIDAD 1 - Restaurar desde localStorage (sesión persistente)
        let token = localStorage.getItem('token') || localStorage.getItem('whinsap_token');

        if (token) {
          console.log('💾 Sesión persistente encontrada en localStorage');

          // Restaurar todos los datos de sesión a sessionStorage
          const userIdLS = localStorage.getItem('userId');
          const userNameLS = localStorage.getItem('userName');
          const userRoleLS = localStorage.getItem('userRole');
          const sessionTokenLS = localStorage.getItem('sessionToken');
          const whinsapSessionLS = localStorage.getItem('whinsap_session');
          const userPermissionsLS = localStorage.getItem('userPermissions');
          const permissionsByModuleLS = localStorage.getItem('permissionsByModule');

          // Copiar a sessionStorage para uso durante esta sesión
          if (userIdLS) sessionStorage.setItem('userId', userIdLS);
          if (userNameLS) sessionStorage.setItem('userName', userNameLS);
          if (userRoleLS) sessionStorage.setItem('userRole', userRoleLS);
          if (sessionTokenLS) sessionStorage.setItem('sessionToken', sessionTokenLS);
          if (whinsapSessionLS) sessionStorage.setItem('whinsap_session', whinsapSessionLS);
          if (userPermissionsLS) sessionStorage.setItem('userPermissions', userPermissionsLS);
          if (permissionsByModuleLS) sessionStorage.setItem('permissionsByModule', permissionsByModuleLS);
          sessionStorage.setItem('token', token);
          sessionStorage.setItem('whinsap_token', token);

          // Regenerar deviceId si no existe
          let deviceId = sessionStorage.getItem('device_id');
          if (!deviceId) {
            deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            sessionStorage.setItem('device_id', deviceId);
          }

          console.log('✅ Sesión restaurada desde localStorage a sessionStorage');
        } else {
          // 🔧 FIX: PRIORIDAD 2 - Intentar sessionStorage (sesión temporal)
          token = sessionStorage.getItem('token') || sessionStorage.getItem('whinsap_token');

          if (!token) {
            // PRIORIDAD 3 - Intentar backup antiguo (compatibilidad)
            const backupToken = localStorage.getItem('agent_token_backup');
            const backupUserId = localStorage.getItem('agent_userId_backup');
            const backupUserName = localStorage.getItem('agent_userName_backup');
            const backupUserRole = localStorage.getItem('agent_userRole_backup');

            if (backupToken && backupUserId) {
              console.log('💾 Restaurando sesión desde backup antiguo...');
              sessionStorage.setItem('token', backupToken);
              sessionStorage.setItem('userId', backupUserId);
              sessionStorage.setItem('userName', backupUserName || '');
              sessionStorage.setItem('userRole', backupUserRole || 'agent');

              // Regenerar deviceId si no existe
              let deviceId = sessionStorage.getItem('device_id');
              if (!deviceId) {
                deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                sessionStorage.setItem('device_id', deviceId);
              }

              token = backupToken;
              console.log('✅ Sesión restaurada desde backup antiguo');
            }
          }
        }

        if (token) {
          console.log('🔍 Token encontrado, verificando...');
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
            console.log('✅ Sesión verificada correctamente:', userData.user.email);
          } else {
            // Solo limpiar si el error es 401 (no autorizado)
            if (response.status === 401) {
              console.log('❌ Token expirado/inválido (401), limpiando sesión');
              sessionStorage.clear();
              // Limpiar también localStorage y backups
              localStorage.removeItem('token');
              localStorage.removeItem('whinsap_token');
              localStorage.removeItem('userRole');
              localStorage.removeItem('userName');
              localStorage.removeItem('userId');
              localStorage.removeItem('sessionToken');
              localStorage.removeItem('whinsap_session');
              localStorage.removeItem('userPermissions');
              localStorage.removeItem('permissionsByModule');
              localStorage.removeItem('agent_token_backup');
              localStorage.removeItem('agent_userId_backup');
              localStorage.removeItem('agent_userName_backup');
              localStorage.removeItem('agent_userRole_backup');
            } else {
              console.log('⚠️ Error ' + response.status + ', manteniendo sesión para re-autenticación');
            }
          }
        } else {
          console.log('ℹ️ No se encontró token - nueva sesión requerida');
        }
      } catch (error) {
        console.error('Error verificando autenticación:', error);
        console.log('⚠️ Error de red, manteniendo sesión');
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
        if (!storageManager.getItem('whinsap_token')) {
          storageManager.setItem('whinsap_token', data.token);
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
    // Obtener el token JWT para enviar al servidor
    const token = sessionStorage.getItem('token') ||
      localStorage.getItem('token') ||
      sessionStorage.getItem('whinsap_token') ||
      localStorage.getItem('whinsap_token');

    // Notificar al servidor para destruir la sesión y marcar users.session = 0
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }).then(() => {
        console.log('✅ Logout exitoso en servidor');
      }).catch(err => console.error('❌ Error en logout:', err));
    } else {
      console.warn('⚠️ No hay token, logout solo local');
    }

    setUser(null);
    // Limpiar sessionStorage completamente
    sessionStorage.clear();
    // Limpiar TODOS los datos de sesión de localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('whinsap_token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    localStorage.removeItem('whinsap_session');
    localStorage.removeItem('whinsap_active_session');
    localStorage.removeItem('whatsappPhone');
    localStorage.removeItem('userPhone');
    localStorage.removeItem('adminPhoneNumber');
    localStorage.removeItem('adminSessionId');
    localStorage.removeItem('activeSessionId');
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('user');
    localStorage.removeItem('userPermissions');
    localStorage.removeItem('permissionsByModule');
    localStorage.removeItem('agent_token_backup');
    localStorage.removeItem('agent_userId_backup');
    localStorage.removeItem('agent_userName_backup');
    localStorage.removeItem('agent_userRole_backup');

    console.log('👋 Sesión cerrada correctamente - storage limpiado completamente');

    // ✅ Redireccionar a la página principal después del logout
    navigate('/');
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