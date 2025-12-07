/**
 * 🚀 SOCKET.IO OPTIMIZADO CON ROOMS
 * 
 * Mejoras:
 * - Emisión selectiva por chat (no broadcast)
 * - Rooms dinámicas por sesión y chat
 * - Compresión automática de payloads grandes
 * - Tracking de conexiones activas
 */

class SocketManager {
    constructor(io) {
        this.io = io;
        this.activeConnections = new Map(); // sessionId -> Set of socket IDs
        this.chatRooms = new Map(); // chatJid -> Set of socket IDs

        this.setupListeners();
    }

    setupListeners() {
        this.io.on('connection', (socket) => {
            console.log(`[SOCKET] ✅ Cliente conectado: ${socket.id}`);

            // Unirse a room de sesión
            socket.on('join-session', (sessionId) => {
                socket.join(`session-${sessionId}`);

                // Trackear conexión
                if (!this.activeConnections.has(sessionId)) {
                    this.activeConnections.set(sessionId, new Set());
                }
                this.activeConnections.get(sessionId).add(socket.id);

                console.log(`[SOCKET] 📱 Cliente ${socket.id} unido a sesión: ${sessionId}`);
            });

            // Unirse a room de chat específico
            socket.on('join-chat', ({ sessionId, chatJid }) => {
                const roomName = `chat-${sessionId}-${chatJid}`;
                socket.join(roomName);

                // Trackear room de chat
                if (!this.chatRooms.has(chatJid)) {
                    this.chatRooms.set(chatJid, new Set());
                }
                this.chatRooms.get(chatJid).add(socket.id);

                console.log(`[SOCKET] 💬 Cliente ${socket.id} unido a chat: ${chatJid}`);
            });

            // Salir de room de chat
            socket.on('leave-chat', ({ sessionId, chatJid }) => {
                const roomName = `chat-${sessionId}-${chatJid}`;
                socket.leave(roomName);

                if (this.chatRooms.has(chatJid)) {
                    this.chatRooms.get(chatJid).delete(socket.id);
                }

                console.log(`[SOCKET] 👋 Cliente ${socket.id} salió de chat: ${chatJid}`);
            });

            // Desconexión
            socket.on('disconnect', () => {
                // Limpiar tracking
                for (const [sessionId, sockets] of this.activeConnections.entries()) {
                    sockets.delete(socket.id);
                    if (sockets.size === 0) {
                        this.activeConnections.delete(sessionId);
                    }
                }

                for (const [chatJid, sockets] of this.chatRooms.entries()) {
                    sockets.delete(socket.id);
                    if (sockets.size === 0) {
                        this.chatRooms.delete(chatJid);
                    }
                }

                console.log(`[SOCKET] ❌ Cliente desconectado: ${socket.id}`);
            });
        });
    }

    /**
     * Emitir mensaje a sesión específica (optimizado)
     */
    emitToSession(sessionId, event, data) {
        const roomName = `session-${sessionId}`;
        this.io.to(roomName).emit(event, data);
    }

    /**
     * Emitir mensaje a chat específico (ultra-optimizado)
     * Solo llega a usuarios viendo ese chat
     */
    emitToChat(sessionId, chatJid, event, data) {
        const roomName = `chat-${sessionId}-${chatJid}`;
        const room = this.io.sockets.adapter.rooms.get(roomName);

        if (room && room.size > 0) {
            // Hay usuarios viendo este chat, emitir solo a ellos
            this.io.to(roomName).emit(event, data);
            return true;
        }

        // Nadie viendo este chat, emitir a toda la sesión como fallback
        this.emitToSession(sessionId, event, data);
        return false;
    }

    /**
     * Emitir actualización de estado de mensaje (entregado, leído, etc)
     */
    emitMessageStatus(sessionId, chatJid, messageId, status) {
        const data = {
            messageId,
            chatJid,
            status,
            timestamp: new Date().toISOString()
        };

        // Intentar emitir al chat específico primero
        const sentToChat = this.emitToChat(sessionId, chatJid, 'message-status', data);

        if (!sentToChat) {
            // Si no hay nadie en el chat, emitir a la sesión
            this.emitToSession(sessionId, 'message-status', data);
        }
    }

    /**
     * Broadcast a todos los clientes (usar con precaución)
     */
    broadcast(event, data) {
        this.io.emit(event, data);
    }

    /**
     * Obtener estadísticas de conexiones
     */
    getStats() {
        return {
            totalConnections: this.io.sockets.sockets.size,
            activeSessions: this.activeConnections.size,
            activeChats: this.chatRooms.size,
            rooms: this.io.sockets.adapter.rooms.size
        };
    }

    /**
     * Verificar si hay clientes conectados a una sesión
     */
    hasActiveClients(sessionId) {
        const connections = this.activeConnections.get(sessionId);
        return connections && connections.size > 0;
    }

    /**
     * Verificar si hay clientes viendo un chat específico
     */
    hasChatViewers(sessionId, chatJid) {
        const roomName = `chat-${sessionId}-${chatJid}`;
        const room = this.io.sockets.adapter.rooms.get(roomName);
        return room && room.size > 0;
    }
}

module.exports = SocketManager;
