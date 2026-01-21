/**
 * Sistema Anti-Bloqueo para WhatsApp
 * Previene bloqueos de IP por comportamiento sospechoso
 */

class AntiBlockProtection {
    constructor() {
        // Tracking de intentos de conexión por sessionId
        this.connectionAttempts = new Map(); // sessionId -> { count, lastAttempt, backoffUntil }

        // Tracking global de QRs generados
        this.qrHistory = []; // Array de timestamps

        // Configuración
        this.config = {
            maxQRsPerHour: 3,           // Máximo 3 QRs por hora
            maxRetriesBeforeBlock: 3,    // Máximo 3 reintentos antes de bloquear
            baseBackoffTime: 60000,      // 1 minuto inicial
            maxBackoffTime: 86400000,    // 24 horas máximo
            code515CooldownTime: 3600000 // 1 hora de cooldown si detecta 515
        };

        // Estado de bloqueo global
        this.globalBlock = {
            isBlocked: false,
            blockedUntil: null,
            reason: null
        };
    }

    /**
     * Verifica si se puede generar un QR
     */
    canGenerateQR(sessionId) {
        const now = Date.now();

        // 1. Verificar bloqueo global
        if (this.globalBlock.isBlocked && now < this.globalBlock.blockedUntil) {
            const remainingMinutes = Math.ceil((this.globalBlock.blockedUntil - now) / 60000);
            return {
                allowed: false,
                reason: `Sistema bloqueado temporalmente. ${this.globalBlock.reason}. Espera ${remainingMinutes} minutos.`,
                waitTime: this.globalBlock.blockedUntil - now
            };
        }

        // Limpiar bloqueo global si ya expiró
        if (this.globalBlock.isBlocked && now >= this.globalBlock.blockedUntil) {
            console.log('[ANTI-BLOCK] ✅ Bloqueo global levantado');
            this.globalBlock.isBlocked = false;
            this.globalBlock.blockedUntil = null;
            this.globalBlock.reason = null;
        }

        // 2. Verificar límite de QRs por hora
        this.cleanOldQRHistory();
        if (this.qrHistory.length >= this.config.maxQRsPerHour) {
            const oldestQR = this.qrHistory[0];
            const waitTime = (oldestQR + 3600000) - now; // 1 hora desde el más antiguo
            const waitMinutes = Math.ceil(waitTime / 60000);

            return {
                allowed: false,
                reason: `Límite de ${this.config.maxQRsPerHour} QRs por hora alcanzado. Espera ${waitMinutes} minutos.`,
                waitTime: waitTime
            };
        }

        // 3. Verificar backoff por sesión específica
        const attempt = this.connectionAttempts.get(sessionId);
        if (attempt && attempt.backoffUntil && now < attempt.backoffUntil) {
            const waitTime = attempt.backoffUntil - now;
            const waitMinutes = Math.ceil(waitTime / 60000);

            return {
                allowed: false,
                reason: `Sesión en cooldown después de ${attempt.count} intentos fallidos. Espera ${waitMinutes} minutos.`,
                waitTime: waitTime
            };
        }

        return { allowed: true };
    }

    /**
     * Registra un QR generado
     */
    registerQRGenerated(sessionId) {
        const now = Date.now();

        // Agregar a historial global
        this.qrHistory.push(now);

        // Actualizar intentos de la sesión
        const attempt = this.connectionAttempts.get(sessionId) || { count: 0, lastAttempt: 0, backoffUntil: null };
        attempt.count++;
        attempt.lastAttempt = now;
        this.connectionAttempts.set(sessionId, attempt);

        console.log(`[ANTI-BLOCK] QR registrado para ${sessionId}. Total en última hora: ${this.qrHistory.length}/${this.config.maxQRsPerHour}`);
    }

    /**
     * Registra un error 515 (servidor bloqueado por WhatsApp)
     */
    handle515Error(sessionId) {
        const now = Date.now();
        const attempt = this.connectionAttempts.get(sessionId) || { count: 0, lastAttempt: 0, backoffUntil: null };

        // Incrementar contador de intentos fallidos
        attempt.count++;

        // Calcular backoff exponencial: 1min, 5min, 30min, 1h, 24h
        const backoffTimes = [60000, 300000, 1800000, 3600000, 86400000];
        const backoffIndex = Math.min(attempt.count - 1, backoffTimes.length - 1);
        const backoffTime = backoffTimes[backoffIndex];

        attempt.backoffUntil = now + backoffTime;
        this.connectionAttempts.set(sessionId, attempt);

        const backoffMinutes = Math.ceil(backoffTime / 60000);
        console.log(`[ANTI-BLOCK] ⚠️  ERROR 515 detectado para ${sessionId}. Intento ${attempt.count}. Backoff: ${backoffMinutes} minutos`);

        // Si hay más de 3 errores 515, activar bloqueo global
        if (attempt.count >= 3) {
            this.activateGlobalBlock(
                this.config.code515CooldownTime,
                `Detectados ${attempt.count} errores 515. WhatsApp está bloqueando el servidor.`
            );
        }

        return {
            backoffTime,
            backoffMinutes,
            shouldStop: true
        };
    }

    /**
     * Registra una conexión exitosa
     */
    handleSuccessfulConnection(sessionId) {
        // Limpiar intentos fallidos de esta sesión
        this.connectionAttempts.delete(sessionId);
        console.log(`[ANTI-BLOCK] ✅ Conexión exitosa para ${sessionId}. Contador reseteado.`);
    }

    /**
     * Activa bloqueo global del sistema
     */
    activateGlobalBlock(duration, reason) {
        const now = Date.now();
        this.globalBlock.isBlocked = true;
        this.globalBlock.blockedUntil = now + duration;
        this.globalBlock.reason = reason;

        const durationMinutes = Math.ceil(duration / 60000);
        console.log(`[ANTI-BLOCK] 🚫 BLOQUEO GLOBAL ACTIVADO por ${durationMinutes} minutos. Razón: ${reason}`);
    }

    /**
     * Limpia historial de QRs antiguo (más de 1 hora)
     */
    cleanOldQRHistory() {
        const oneHourAgo = Date.now() - 3600000;
        this.qrHistory = this.qrHistory.filter(timestamp => timestamp > oneHourAgo);
    }

    /**
     * Limpia sesiones antiguas (más de 24 horas sin actividad)
     */
    cleanOldAttempts() {
        const oneDayAgo = Date.now() - 86400000;
        for (const [sessionId, attempt] of this.connectionAttempts.entries()) {
            if (attempt.lastAttempt < oneDayAgo) {
                this.connectionAttempts.delete(sessionId);
                console.log(`[ANTI-BLOCK] 🧹 Limpiado intento antiguo de ${sessionId}`);
            }
        }
    }

    /**
     * Obtiene estadísticas del sistema
     */
    getStats() {
        this.cleanOldQRHistory();

        return {
            globalBlock: this.globalBlock,
            qrsInLastHour: this.qrHistory.length,
            maxQRsPerHour: this.config.maxQRsPerHour,
            activeSessions: this.connectionAttempts.size,
            sessions: Array.from(this.connectionAttempts.entries()).map(([id, data]) => ({
                sessionId: id,
                attempts: data.count,
                lastAttempt: new Date(data.lastAttempt).toISOString(),
                backoffUntil: data.backoffUntil ? new Date(data.backoffUntil).toISOString() : null
            }))
        };
    }
}

// Singleton instance
const antiBlock = new AntiBlockProtection();

// Limpiar intentos antiguos cada hora
setInterval(() => {
    antiBlock.cleanOldAttempts();
}, 3600000);

module.exports = antiBlock;
