/**
 * Storage Manager - Maneja localStorage y sessionStorage de forma flexible
 *
 * Por defecto usa sessionStorage (se borra al cerrar el navegador) para mayor seguridad.
 * Si el usuario marca "Recordar sesión", usa localStorage (persiste indefinidamente).
 */

type StorageType = 'local' | 'session';

class StorageManager {
  private storageType: StorageType = 'session'; // Por defecto: sessionStorage (más seguro)

  /**
   * Establece el tipo de almacenamiento a usar
   * @param type 'local' para localStorage, 'session' para sessionStorage
   */
  setStorageType(type: StorageType) {
    this.storageType = type;
    console.log(`📦 Tipo de almacenamiento cambiado a: ${type}Storage`);
  }

  /**
   * Obtiene el tipo de almacenamiento actual
   */
  getStorageType(): StorageType {
    return this.storageType;
  }

  /**
   * Obtiene el storage apropiado según la configuración
   */
  private getStorage(): Storage {
    return this.storageType === 'local' ? localStorage : sessionStorage;
  }

  /**
   * Guarda un valor en el storage configurado
   */
  setItem(key: string, value: string): void {
    try {
      const storage = this.getStorage();
      storage.setItem(key, value);
      console.log(`✅ ${key} guardado en ${this.storageType}Storage`);
    } catch (error) {
      console.error(`Error guardando ${key}:`, error);
    }
  }

  /**
   * Obtiene un valor SOLO del storage configurado (sin fallback a localStorage por seguridad)
   */
  getItem(key: string): string | null {
    try {
      // Buscar en ambos storages para asegurar persistencia
      return sessionStorage.getItem(key) || localStorage.getItem(key);
    } catch (error) {
      console.error(`Error obteniendo ${key}:`, error);
      return null;
    }
  }

  /**
   * Elimina un valor de AMBOS storages (para asegurar limpieza completa)
   */
  removeItem(key: string): void {
    try {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
      console.log(`🗑️ ${key} eliminado de todos los storages`);
    } catch (error) {
      console.error(`Error eliminando ${key}:`, error);
    }
  }

  /**
   * Limpia TODOS los datos de autenticación de ambos storages
   */
  clearAuthData(): void {
    const authKeys = [
      'whinsap_token',
      'whinsap_session',
      'whinsap_user_type',
      'token',
      'userId',
      'userName',
      'userRole'
    ];

    authKeys.forEach(key => this.removeItem(key));
    console.log('🧹 Todos los datos de autenticación eliminados');
  }

  /**
   * Verifica si hay una sesión activa SOLO en sessionStorage (sesiones únicas)
   */
  hasActiveSession(): boolean {
    const token = sessionStorage.getItem('whinsap_token') ||
      sessionStorage.getItem('token') ||
      localStorage.getItem('whinsap_token') ||
      localStorage.getItem('token');

    return !!token;
  }

  /**
   * Mueve todos los datos de localStorage a sessionStorage
   * (útil para cuando el usuario NO marca "Recordar sesión")
   */
  migrateToSessionStorage(): void {
    const authKeys = [
      'whinsap_token',
      'whinsap_session',
      'whinsap_user_type',
      'token',
      'userId',
      'userName',
      'userRole'
    ];

    authKeys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key);
      }
    });

    console.log('📦 Datos migrados de localStorage a sessionStorage');
  }

  /**
   * Obtiene información de debug sobre el storage
   */
  getDebugInfo(): object {
    const authKeys = [
      'whinsap_token',
      'whinsap_session',
      'whinsap_user_type',
      'token',
      'userId',
      'userName',
      'userRole'
    ];

    const info: any = {
      currentStorageType: this.storageType,
      sessionStorage: {},
      localStorage: {}
    };

    authKeys.forEach(key => {
      info.sessionStorage[key] = sessionStorage.getItem(key) ? 'present' : 'absent';
      info.localStorage[key] = localStorage.getItem(key) ? 'present' : 'absent';
    });

    return info;
  }
}

// Exportar instancia singleton
export const storageManager = new StorageManager();

// Exportar también el tipo para usar en otros archivos
export type { StorageType };
