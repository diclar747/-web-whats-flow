/**
 * Cliente de Logging para Frontend
 * Envía eventos al backend para debugging de sesiones
 */

import { getAPIBaseURL } from './socketConfig';

class FrontendLogger {
    private sessionId: string | null = null;
    private buffer: Array<any> = [];
    private maxBufferSize: number = 50;

    setSessionId(sessionId: string) {
        this.sessionId = sessionId;
        console.log(`[LOGGER] SessionId configurado: ${sessionId}`);
    }

    /**
     * Registrar un evento
     */
    log(eventType: string, data: any = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            eventType,
            sessionId: this.sessionId || 'UNKNOWN',
            data: {
                ...data,
                userAgent: navigator.userAgent,
                url: window.location.href,
                sessionStorageKeys: Object.keys(sessionStorage),
                localStorageKeys: Object.keys(localStorage)
            },
            stackTrace: this.getStackTrace()
        };

        // Guardar en buffer
        this.buffer.push(logEntry);
        
        // Limitar tamaño del buffer
        if (this.buffer.length > this.maxBufferSize) {
            this.buffer.shift();
        }

        // Log en consola con formato destacado
        console.log(
            `%c🔍 [SESSION-LOG] ${eventType}`,
            'background: #4CAF50; color: white; padding: 4px 8px; border-radius: 3px; font-weight: bold;',
            {
                sessionId: this.sessionId,
                timestamp,
                data
            }
        );

        // Enviar al backend de forma asíncrona (no bloqueante)
        this.sendToBackend(logEntry).catch(err => 
            console.warn('[LOGGER] No se pudo enviar log al backend:', err.message)
        );
    }

    /**
     * Obtener stack trace simplificado
     */
    private getStackTrace(): string {
        try {
            const stack = new Error().stack || '';
            const lines = stack.split('\n').slice(3, 5);
            return lines.map(line => line.trim()).join(' | ');
        } catch {
            return 'N/A';
        }
    }

    /**
     * Enviar log al backend
     */
    private async sendToBackend(logEntry: any): Promise<void> {
        try {
            const API_BASE = getAPIBaseURL();
            
            await fetch(`${API_BASE}/api/debug/frontend-log`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(logEntry)
            });
        } catch (error) {
            // Silencioso - no queremos que el logging cause errores
        }
    }

    /**
     * Obtener todos los logs del buffer
     */
    getBuffer(): Array<any> {
        return [...this.buffer];
    }

    /**
     * Limpiar buffer
     */
    clearBuffer(): void {
        this.buffer = [];
    }

    /**
     * Generar reporte de debug
     */
    generateReport(): string {
        const report = {
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            logs: this.buffer,
            storage: {
                sessionStorage: this.getStorageSnapshot(sessionStorage),
                localStorage: this.getStorageSnapshot(localStorage)
            },
            navigator: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                online: navigator.onLine,
                cookieEnabled: navigator.cookieEnabled
            },
            window: {
                url: window.location.href,
                referrer: document.referrer,
                width: window.innerWidth,
                height: window.innerHeight
            }
        };

        return JSON.stringify(report, null, 2);
    }

    /**
     * Obtener snapshot del storage
     */
    private getStorageSnapshot(storage: Storage): Record<string, string> {
        const snapshot: Record<string, string> = {};
        
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key) {
                const value = storage.getItem(key);
                // Ocultar tokens sensibles
                if (key.toLowerCase().includes('token') || key.toLowerCase().includes('password')) {
                    snapshot[key] = '[HIDDEN]';
                } else {
                    snapshot[key] = value || '';
                }
            }
        }
        
        return snapshot;
    }
}

// Exportar instancia única
export const frontendLogger = new FrontendLogger();

// Hacer disponible globalmente para debugging manual
(window as any).__sessionLogger = frontendLogger;
