/**
 * Utility to resolve and validate WhatsApp sessions.
 * Prepares the system for centralized session management (Map or Redis).
 */

class SessionResolver {
    constructor() {
        this.sessions = new Map(); // Fallback if global.sessions is not available
        this.ownerMap = new Map();  // sessionId -> ownerPhone
        this.redisClient = null;
    }

    /**
     * Set the sessions map reference
     */
    setSessionsMap(sessionsMap) {
        this.sessions = sessionsMap;
    }

    /**
     * Set the owner map reference
     */
    setOwnerMap(ownerMap) {
        this.ownerMap = ownerMap;
    }

    /**
     * Resolve a session by various identifiers
     * @param {string} id - sessionId, phone number, or JID
     */
    resolve(id) {
        if (!id) return null;

        // Clean ID (remove @s.whatsapp.net if present)
        const cleanId = String(id).split('@')[0];

        // 1. Try Redis if available (future implementation hook)
        if (this.redisClient && this.redisClient.connected) {
            // return await this.getFromRedis(cleanId);
        }

        // 2. Try direct match in memory sessions
        let session = this.sessions.get(id) || this.sessions.get(cleanId);

        if (session) return session;

        // 3. Try searching by phone property in all sessions
        session = Array.from(this.sessions.values()).find(s =>
            s.phoneNumber === cleanId ||
            String(s.sessionId) === String(id) ||
            String(s.userId) === String(id)
        );

        return session || null;
    }

    /**
     * Get the owner phone number for a session
     */
    getOwner(sessionId) {
        return this.ownerMap.get(sessionId) || null;
    }

    /**
     * Check if a session is connected
     */
    isConnected(id) {
        const session = this.resolve(id);
        return !!(session && session.isConnected);
    }

    /**
     * Enable Redis support (placeholder)
     */
    enableRedis(client) {
        this.redisClient = client;
        console.log('[SESSION-RESOLVER] Redis support enabled (placeholder)');
    }
}

const sessionResolver = new SessionResolver();

// Export as singleton
module.exports = sessionResolver;
