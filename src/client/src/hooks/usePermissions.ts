import { useState, useEffect } from 'react';

interface Permission {
  permission_id: number;
  permission_name: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface ModulePermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

interface PermissionsByModule {
  [module: string]: ModulePermissions;
}

export const usePermissions = () => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permissionsByModule, setPermissionsByModule] = useState<PermissionsByModule>({});
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = () => {
    try {
      const permsStr = sessionStorage.getItem('userPermissions');
      const permsModuleStr = sessionStorage.getItem('permissionsByModule');
      const role = sessionStorage.getItem('userRole');

      if (permsStr) {
        setPermissions(JSON.parse(permsStr));
      }
      if (permsModuleStr) {
        setPermissionsByModule(JSON.parse(permsModuleStr));
      }
      if (role) {
        setUserRole(role);
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
  };

  // Verificar si tiene permiso para un módulo y acción específica
  const hasPermission = (module: string, action: 'view' | 'create' | 'edit' | 'delete'): boolean => {
    // Si no hay userRole cargado, es usuario con QR - acceso completo
    if (!userRole) {
      return true;
    }

    // Admin siempre tiene todos los permisos
    if (userRole === 'admin') {
      return true;
    }

    const modulePerms = permissionsByModule[module];
    if (!modulePerms) {
      return false;
    }

    return modulePerms[action] === true;
  };

  // Verificar si tiene al menos un permiso en un módulo
  const hasModuleAccess = (module: string): boolean => {
    // Si no hay userRole cargado, es usuario con QR - acceso completo
    if (!userRole) {
      return true;
    }

    // Admin siempre tiene acceso
    if (userRole === 'admin') {
      return true;
    }

    const modulePerms = permissionsByModule[module];
    if (!modulePerms) {
      return false;
    }

    return modulePerms.view || modulePerms.create || modulePerms.edit || modulePerms.delete;
  };

  // Verificar si tiene permiso específico por nombre
  const hasPermissionByName = (permissionName: string, action: 'view' | 'create' | 'edit' | 'delete'): boolean => {
    if (userRole === 'admin') {
      return true;
    }

    const perm = permissions.find(p => p.permission_name === permissionName);
    if (!perm) {
      return false;
    }

    switch (action) {
      case 'view':
        return perm.can_view;
      case 'create':
        return perm.can_create;
      case 'edit':
        return perm.can_edit;
      case 'delete':
        return perm.can_delete;
      default:
        return false;
    }
  };

  // Obtener todos los módulos a los que tiene acceso
  const getAccessibleModules = (): string[] => {
    if (userRole === 'admin') {
      return ['chat', 'campaign', 'calendar', 'kanban', 'contacts', 'analytics', 'settings', 'users'];
    }

    return Object.keys(permissionsByModule).filter(module => hasModuleAccess(module));
  };

  return {
    permissions,
    permissionsByModule,
    userRole,
    hasPermission,
    hasModuleAccess,
    hasPermissionByName,
    getAccessibleModules,
    reloadPermissions: loadPermissions
  };
};
