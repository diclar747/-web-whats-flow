import { getAPIBaseURL } from './socketConfig';

export interface Permission {
  module: string;
  permission_name: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface PermissionsByModule {
  [module: string]: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
  };
}

// Módulos del sistema
export enum Module {
  CHAT = 'chat',
  CAMPAIGN = 'campaign',
  CALENDAR = 'calendar',
  KANBAN = 'kanban',
  CONTACTS = 'contacts',
  ANALYTICS = 'analytics',
  SETTINGS = 'settings',
  USERS = 'users'
}

// Acciones disponibles
export enum Action {
  VIEW = 'view',
  CREATE = 'create',
  EDIT = 'edit',
  DELETE = 'delete'
}

/**
 * Clase para gestionar permisos del usuario/agente actual
 */
export class PermissionsManager {
  private static permissions: Permission[] = [];
  private static permissionsByModule: PermissionsByModule = {};
  private static isAdmin: boolean = false;
  private static isSuperAdmin: boolean = false;
  private static loaded: boolean = false;

  /**
   * Cargar permisos del usuario actual
   */
  static async loadPermissions(): Promise<void> {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const agent = JSON.parse(localStorage.getItem('agent') || '{}');

      // Verificar si es super admin
      this.isSuperAdmin =
        (user.email && user.email.includes('595994854167')) ||
        (user.phone && user.phone.includes('595994854167')) ||
        (user.admin_phone && user.admin_phone.includes('595994854167'));

      // Verificar si es admin normal
      this.isAdmin = user.is_admin === 1 || user.is_admin === true;

      // Si es super admin o admin normal, tiene todos los permisos
      if (this.isSuperAdmin || this.isAdmin) {
        this.permissions = [];
        this.permissionsByModule = this.getAllPermissions();
        this.loaded = true;
        return;
      }

      // Si es agente, cargar sus permisos desde el localStorage o servidor
      if (agent.id) {
        const storedPermissions = localStorage.getItem('agentPermissions');
        if (storedPermissions) {
          this.permissions = JSON.parse(storedPermissions);
          this.buildPermissionsByModule();
        } else {
          await this.fetchPermissionsFromServer(agent.id);
        }
      }

      this.loaded = true;
    } catch (error) {
      console.error('Error cargando permisos:', error);
      this.permissions = [];
      this.permissionsByModule = {};
      this.loaded = true;
    }
  }

  /**
   * Obtener permisos del servidor
   */
  private static async fetchPermissionsFromServer(agentId: string): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getAPIBaseURL()}/api/agents/${agentId}/permissions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        this.permissions = data.permissions;
        localStorage.setItem('agentPermissions', JSON.stringify(this.permissions));
        this.buildPermissionsByModule();
      }
    } catch (error) {
      console.error('Error obteniendo permisos del servidor:', error);
    }
  }

  /**
   * Construir estructura de permisos por módulo
   */
  private static buildPermissionsByModule(): void {
    this.permissionsByModule = {};
    this.permissions.forEach(perm => {
      if (!this.permissionsByModule[perm.module]) {
        this.permissionsByModule[perm.module] = {
          view: false,
          create: false,
          edit: false,
          delete: false
        };
      }
      if (perm.can_view) this.permissionsByModule[perm.module].view = true;
      if (perm.can_create) this.permissionsByModule[perm.module].create = true;
      if (perm.can_edit) this.permissionsByModule[perm.module].edit = true;
      if (perm.can_delete) this.permissionsByModule[perm.module].delete = true;
    });
  }

  /**
   * Obtener todos los permisos (para admins)
   */
  private static getAllPermissions(): PermissionsByModule {
    const modules = Object.values(Module);
    const permissions: PermissionsByModule = {};
    modules.forEach(module => {
      permissions[module] = {
        view: true,
        create: true,
        edit: true,
        delete: true
      };
    });
    return permissions;
  }

  /**
   * Verificar si tiene permiso para una acción en un módulo
   */
  static can(module: Module | string, action: Action | string): boolean {
    if (!this.loaded) {
      console.warn('Permisos no cargados aún');
      return false;
    }

    // Super admin y admin tienen todos los permisos
    if (this.isSuperAdmin || this.isAdmin) {
      return true;
    }

    // Verificar permisos específicos
    const modulePerms = this.permissionsByModule[module];
    if (!modulePerms) {
      return false;
    }

    return modulePerms[action as keyof typeof modulePerms] || false;
  }

  /**
   * Verificar si puede ver un módulo
   */
  static canView(module: Module | string): boolean {
    return this.can(module, Action.VIEW);
  }

  /**
   * Verificar si puede crear en un módulo
   */
  static canCreate(module: Module | string): boolean {
    return this.can(module, Action.CREATE);
  }

  /**
   * Verificar si puede editar en un módulo
   */
  static canEdit(module: Module | string): boolean {
    return this.can(module, Action.EDIT);
  }

  /**
   * Verificar si puede eliminar en un módulo
   */
  static canDelete(module: Module | string): boolean {
    return this.can(module, Action.DELETE);
  }

  /**
   * Verificar si es administrador
   */
  static isAdministrator(): boolean {
    return this.isSuperAdmin || this.isAdmin;
  }

  /**
   * Verificar si es super administrador
   */
  static isSuperAdministrator(): boolean {
    return this.isSuperAdmin;
  }

  /**
   * Obtener todos los módulos a los que tiene acceso
   */
  static getAccessibleModules(): string[] {
    if (this.isSuperAdmin || this.isAdmin) {
      return Object.values(Module);
    }

    return Object.keys(this.permissionsByModule).filter(
      module => this.permissionsByModule[module].view
    );
  }

  /**
   * Limpiar permisos (al hacer logout)
   */
  static clear(): void {
    this.permissions = [];
    this.permissionsByModule = {};
    this.isAdmin = false;
    this.isSuperAdmin = false;
    this.loaded = false;
    localStorage.removeItem('agentPermissions');
  }

  /**
   * Obtener permisos para un módulo específico
   */
  static getModulePermissions(module: Module | string): {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
  } {
    if (this.isSuperAdmin || this.isAdmin) {
      return { view: true, create: true, edit: true, delete: true };
    }

    return this.permissionsByModule[module] || {
      view: false,
      create: false,
      edit: false,
      delete: false
    };
  }
}

/**
 * Hook personalizado para usar permisos en componentes React
 */
export const usePermissions = () => {
  const [loaded, setLoaded] = React.useState(PermissionsManager['loaded']);

  React.useEffect(() => {
    const loadPerms = async () => {
      if (!PermissionsManager['loaded']) {
        await PermissionsManager.loadPermissions();
        setLoaded(true);
      }
    };
    loadPerms();
  }, []);

  return {
    loaded,
    can: (module: Module | string, action: Action | string) => PermissionsManager.can(module, action),
    canView: (module: Module | string) => PermissionsManager.canView(module),
    canCreate: (module: Module | string) => PermissionsManager.canCreate(module),
    canEdit: (module: Module | string) => PermissionsManager.canEdit(module),
    canDelete: (module: Module | string) => PermissionsManager.canDelete(module),
    isAdmin: () => PermissionsManager.isAdministrator(),
    isSuperAdmin: () => PermissionsManager.isSuperAdministrator(),
    getAccessibleModules: () => PermissionsManager.getAccessibleModules(),
    getModulePermissions: (module: Module | string) => PermissionsManager.getModulePermissions(module)
  };
};

// Importar React para el hook
import React from 'react';

export default PermissionsManager;
