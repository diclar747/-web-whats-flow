/**
 * Device Fingerprint Generator
 * Genera un ID único del dispositivo/navegador basado en características del sistema
 * Este ID se usa para validar que solo el dispositivo que escaneó el QR pueda acceder
 */

import { v4 as uuidv4 } from 'uuid';

class DeviceFingerprint {
  private deviceId: string | null = null;
  private readonly STORAGE_KEY = 'whatsflow_device_id';

  /**
   * Genera o recupera el device ID del navegador
   */
  async getDeviceId(): Promise<string> {
    // Intentar recuperar deviceId guardado
    const savedDeviceId = this.getStoredDeviceId();
    if (savedDeviceId) {
      this.deviceId = savedDeviceId;
      return savedDeviceId;
    }

    // Generar nuevo deviceId basado en características del navegador
    const fingerprint = await this.generateFingerprint();

    // Guardar en localStorage Y sessionStorage para persistencia
    this.storeDeviceId(fingerprint);
    this.deviceId = fingerprint;

    console.log('🔑 Nuevo Device ID generado:', fingerprint);
    return fingerprint;
  }

  /**
   * Genera un fingerprint único basado en características del navegador
   */
  private async generateFingerprint(): Promise<string> {
    const components: string[] = [];

    // 1. User Agent
    components.push(navigator.userAgent);

    // 2. Idioma
    components.push(navigator.language || 'unknown');

    // 3. Zona horaria
    components.push(Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown');

    // 4. Resolución de pantalla
    components.push(`${window.screen.width}x${window.screen.height}`);

    // 5. Profundidad de color
    components.push(`${window.screen.colorDepth}`);

    // 6. Platform
    components.push(navigator.platform || 'unknown');

    // 7. Hardware concurrency (núcleos de CPU)
    components.push(`${navigator.hardwareConcurrency || 'unknown'}`);

    // 8. Device Memory (si está disponible)
    const nav: any = navigator;
    if (nav.deviceMemory) {
      components.push(`${nav.deviceMemory}GB`);
    }

    // 9. Canvas fingerprint (más avanzado)
    const canvasFingerprint = this.getCanvasFingerprint();
    components.push(canvasFingerprint);

    // 10. WebGL fingerprint
    const webglFingerprint = this.getWebGLFingerprint();
    components.push(webglFingerprint);

    // Combinar todos los componentes y generar hash
    const fingerprintString = components.join('|');
    const hash = await this.simpleHash(fingerprintString);

    // Agregar un UUID adicional para mayor unicidad
    const uniqueId = `${hash}-${uuidv4().substring(0, 8)}`;

    return uniqueId;
  }

  /**
   * Genera fingerprint del canvas (técnica avanzada)
   */
  private getCanvasFingerprint(): string {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) return 'no-canvas';

      canvas.width = 200;
      canvas.height = 50;

      // Dibujar texto
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('WhatsFlow 🔐', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('Device ID', 4, 17);

      // Obtener data del canvas
      const dataURL = canvas.toDataURL();

      // Hash simple del dataURL
      let hash = 0;
      for (let i = 0; i < dataURL.length; i++) {
        const char = dataURL.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }

      return hash.toString(36);
    } catch (e) {
      return 'canvas-error';
    }
  }

  /**
   * Genera fingerprint de WebGL
   */
  private getWebGLFingerprint(): string {
    try {
      const canvas = document.createElement('canvas');
      const gl: any = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

      if (!gl) return 'no-webgl';

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        return `${vendor}|${renderer}`.substring(0, 50);
      }

      return 'webgl-basic';
    } catch (e) {
      return 'webgl-error';
    }
  }

  /**
   * Hash simple usando Web Crypto API
   */
  private async simpleHash(text: string): Promise<string> {
    try {
      const msgBuffer = new TextEncoder().encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex.substring(0, 16); // Primeros 16 caracteres
    } catch (e) {
      // Fallback si Web Crypto no está disponible
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(36);
    }
  }

  /**
   * Recupera deviceId guardado
   */
  private getStoredDeviceId(): string | null {
    // Buscar en sessionStorage primero (más temporal)
    const sessionId = sessionStorage.getItem(this.STORAGE_KEY);
    if (sessionId) return sessionId;

    // Luego en localStorage (más permanente)
    const localId = localStorage.getItem(this.STORAGE_KEY);
    if (localId) {
      // Migrar a sessionStorage también
      sessionStorage.setItem(this.STORAGE_KEY, localId);
      return localId;
    }

    return null;
  }

  /**
   * Guarda deviceId en ambos storages
   */
  private storeDeviceId(deviceId: string): void {
    localStorage.setItem(this.STORAGE_KEY, deviceId);
    sessionStorage.setItem(this.STORAGE_KEY, deviceId);
  }

  /**
   * Limpia deviceId (usado al hacer logout)
   */
  clearDeviceId(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    sessionStorage.removeItem(this.STORAGE_KEY);
    this.deviceId = null;
    console.log('🗑️ Device ID eliminado');
  }

  /**
   * Obtiene información de debug del dispositivo
   */
  getDeviceInfo(): object {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      colorDepth: window.screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as any).deviceMemory || 'N/A'
    };
  }
}

// Exportar instancia singleton
export const deviceFingerprint = new DeviceFingerprint();

// Exportar también la clase para testing
export { DeviceFingerprint };
