import React, { useState, useEffect } from 'react';
import { getAPIBaseURL } from '../utils/socketConfig';

interface Permission {
  permission_name: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface UsePermissionsReturn {
  permissions: Permission[];
  loading: boolean;
  error: string | null;
  hasPermission: (permissionName: string, action?: 'view' | 'create' | 'edit' | 'delete') => boolean;
  checkPermission: (permissionName: string, action: 'view' | 'create' | 'edit' | 'delete') => Promise<boolean>;
  reload: () => Promise<void>;
}

export const usePermissions = (): UsePermissionsReturn => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = getAPIBaseURL();
  const token = localStorage.getItem('token');

  const loadPermissions = async () => {
    if (!token) {
      setError('No token found');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/api/user/permissions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load permissions');
      }

      const data = await response.json();
      if (data.success) {
        setPermissions(data.permissions || []);
        setError(null);
      } else {
        throw new Error(data.error || 'Failed to load permissions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading permissions');
      console.error('Error loading permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPermissions();
  }, [token]);

  const hasPermission = (
    permissionName: string,
    action: 'view' | 'create' | 'edit' | 'delete' = 'view'
  ): boolean => {
    const permission = permissions.find(p => p.permission_name === permissionName);
    if (!permission) return false;

    switch (action) {
      case 'view':
        return permission.can_view;
      case 'create':
        return permission.can_create;
      case 'edit':
        return permission.can_edit;
      case 'delete':
        return permission.can_delete;
      default:
        return false;
    }
  };

  const checkPermission = async (
    permissionName: string,
    action: 'view' | 'create' | 'edit' | 'delete'
  ): Promise<boolean> => {
    if (!token) return false;

    try {
      const response = await fetch(`${apiUrl}/api/user/check-permission`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          permission: permissionName,
          action
        })
      });

      const data = await response.json();
      return data.success && data.has_permission;
    } catch (err) {
      console.error('Error checking permission:', err);
      return false;
    }
  };

  return {
    permissions,
    loading,
    error,
    hasPermission,
    checkPermission,
    reload: loadPermissions
  };
};

// Hook para verificar un permiso específico
export const useHasPermission = (
  permissionName: string,
  action: 'view' | 'create' | 'edit' | 'delete' = 'view'
): boolean => {
  const { hasPermission } = usePermissions();
  return hasPermission(permissionName, action);
};

// Componente HOC para proteger rutas con permisos
export const withPermission = (
  Component: React.ComponentType<any>,
  requiredPermission: string,
  action: 'view' | 'create' | 'edit' | 'delete' = 'view',
  fallback?: React.ReactNode
) => {
  return (props: any) => {
    const hasPermission = useHasPermission(requiredPermission, action);
    const { loading } = usePermissions();

    if (loading) {
      return <div>Loading...</div>;
    }

    if (!hasPermission) {
      return fallback || <div>Access Denied</div>;
    }

    return <Component {...props} />;
  };
};

export default usePermissions;
