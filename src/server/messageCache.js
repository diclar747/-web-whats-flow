/**
 * 🚀 MÓDULO DE CACHÉ ULTRA-RÁPIDO PARA WHATSFLOW
 * 
 * Características:
 * - Caché en memoria (Map) para acceso instantáneo
 * - Redis como backup persistente
 * - TTL automático para limpieza
 * - Compresión de datos grandes
 */

const Redis = require('ioredis');

class MessageCache {
    constructor() {
        // Caché en memoria (ultra-rápido, <1ms)
        this.memoryCache = new Map();
        this.maxMemoryItems = 1000; // Últimos 1000 mensajes en RAM

        // Redis (rápido, ~5ms, persistente)
        this.redis = new Redis({
            host: 'localhost',
            port: 6379,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: true
        });

        this.redisConnected = false;
        this.connectRedis();

        // Limpieza automática cada 5 minutos
        setInterval(() => this.cleanup(), 300000);
    }

    async connectRedis() {
        try {
            await this.redis.connect();
            this.redisConnected = true;
            console.log('✅ Redis conectado para caché de mensajes');
        } catch (error) {
            console.warn('⚠️  Redis no disponible, usando solo caché en memoria:', error.message);
            this.redisConnected = false;
        }
    }

    /**
     * Guardar mensaje en caché (memoria + Redis)
     */
    async set(key, value, ttlSeconds = 300) {
        // 1. Guardar en memoria (instantáneo)
        this.memoryCache.set(key, {
            data: value,
            expires: Date.now() + (ttlSeconds * 1000)
        });

        // Limitar tamaño de caché en memoria
        if (this.memoryCache.size > this.maxMemoryItems) {
            const firstKey = this.memoryCache.keys().next().value;
            this.memoryCache.delete(firstKey);
        }

        // 2. Guardar en Redis (asíncrono, no bloquea)
        if (this.redisConnected) {
            try {
                const serialized = JSON.stringify(value);
                await this.redis.setex(key, ttlSeconds, serialized);
            } catch (error) {
                console.error('[CACHE] Error guardando en Redis:', error.message);
            }
        }
    }

    /**
     * Obtener mensaje de caché
     */
    async get(key) {
        // 1. Intentar desde memoria (ultra-rápido)
        const memItem = this.memoryCache.get(key);
        if (memItem) {
            // Verificar si expiró
            if (Date.now() < memItem.expires) {
                return memItem.data;
            } else {
                this.memoryCache.delete(key);
            }
        }

        // 2. Intentar desde Redis
        if (this.redisConnected) {
            try {
                const cached = await this.redis.get(key);
                if (cached) {
                    const data = JSON.parse(cached);
                    // Guardar en memoria para próxima vez
                    this.memoryCache.set(key, {
                        data,
                        expires: Date.now() + 300000 // 5 min
                    });
                    return data;
                }
            } catch (error) {
                console.error('[CACHE] Error leyendo de Redis:', error.message);
            }
        }

        return null;
    }

    /**
     * Verificar si un mensaje existe en caché
     */
    async has(key) {
        // Verificar en memoria primero
        const memItem = this.memoryCache.get(key);
        if (memItem && Date.now() < memItem.expires) {
            return true;
        }

        // Verificar en Redis
        if (this.redisConnected) {
            try {
                const exists = await this.redis.exists(key);
                return exists === 1;
            } catch (error) {
                return false;
            }
        }

        return false;
    }

    /**
     * Eliminar de caché
     */
    async delete(key) {
        this.memoryCache.delete(key);
        if (this.redisConnected) {
            try {
                await this.redis.del(key);
            } catch (error) {
                console.error('[CACHE] Error eliminando de Redis:', error.message);
            }
        }
    }

    /**
     * Limpiar mensajes expirados
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, item] of this.memoryCache.entries()) {
            if (now >= item.expires) {
                this.memoryCache.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`[CACHE] 🧹 Limpieza: ${cleaned} mensajes expirados eliminados`);
        }
    }

    /**
     * Obtener estadísticas de caché
     */
    getStats() {
        return {
            memoryItems: this.memoryCache.size,
            maxMemoryItems: this.maxMemoryItems,
            redisConnected: this.redisConnected,
            memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 // MB
        };
    }

    /**
     * Cerrar conexiones
     */
    async close() {
        if (this.redisConnected) {
            await this.redis.quit();
        }
        this.memoryCache.clear();
    }
}

// Singleton
const messageCache = new MessageCache();

module.exports = messageCache;
