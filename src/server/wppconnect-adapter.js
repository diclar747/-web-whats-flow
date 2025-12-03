/**
 * ADAPTADOR WPPCONNECT - Compatibilidad con código Baileys existente
 * Permite usar WPPConnect con la misma API que Baileys
 */

const wppconnect = require('@wppconnect-team/wppconnect');
const EventEmitter = require('events');

class WPPConnectAdapter extends EventEmitter {
    constructor() {
        super();
        this.client = null;
        this.sessionId = null;
    }

    /**
     * Crear sesión WPPConnect compatible con Baileys
     */
    async create(sessionId, options = {}) {
        this.sessionId = sessionId;
        
        console.log(`[WPPCONNECT] 🚀 Creando sesión: ${sessionId}`);
        
        try {
            this.client = await wppconnect.create({
                session: sessionId,
                catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
                    console.log(`[WPPCONNECT] 📱 QR Code generado (intento ${attempts})`);
                    // Emitir QR compatible con Baileys
                    this.emit('qr', urlCode || asciiQR);
                },
                statusFind: (statusSession, session) => {
                    console.log(`[WPPCONNECT] 📊 Estado: ${statusSession}`);
                    
                    if (statusSession === 'qrReadSuccess' || statusSession === 'isLogged') {
                        this.emit('connection.update', {
                            connection: 'open',
                            legacy: false,
                            isNewLogin: statusSession === 'qrReadSuccess'
                        });
                    } else if (statusSession === 'qrReadError') {
                        this.emit('connection.update', {
                            connection: 'close',
                            lastDisconnect: {
                                error: { message: 'QR Read Error' }
                            }
                        });
                    }
                },
                logQR: false,
                disableWelcome: true,
                updatesLog: false,
                autoClose: 60000,
                tokenStore: 'file',
                folderNameToken: './auth_info_multi',
                puppeteerOptions: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--single-process',
                        '--disable-gpu'
                    ],
                    executablePath: '/usr/bin/chromium-browser'
                }
            });

            console.log(`[WPPCONNECT] ✅ Cliente creado exitosamente`);

            // Configurar listeners de mensajes
            this.setupMessageListeners();
            
            // Configurar listener de estado
            this.setupStatusListeners();

            return this;

        } catch (error) {
            console.error(`[WPPCONNECT] ❌ Error creando cliente:`, error);
            throw error;
        }
    }

    /**
     * Configurar listeners de mensajes (compatible con Baileys messages.upsert)
     */
    setupMessageListeners() {
        // Mensajes entrantes (notify)
        this.client.onMessage(async (message) => {
            console.log(`[WPPCONNECT] 📥 Mensaje RECIBIDO:`, message.id);
            this.emitBaileysMessage(message, 'notify');
        });

        // TODOS los mensajes (incluye enviados desde teléfono - append)
        this.client.onAnyMessage(async (message) => {
            if (message.isGroupMsg) return; // Ignorar grupos por ahora
            
            // Determinar tipo de mensaje
            const type = message.fromMe ? 'append' : 'notify';
            console.log(`[WPPCONNECT] 📨 Mensaje (${type}):`, message.id, message.fromMe ? '(FROM_ME)' : '(RECIBIDO)');
            
            this.emitBaileysMessage(message, type);
        });
    }

    /**
     * Emitir mensaje en formato compatible con Baileys
     */
    emitBaileysMessage(wppMessage, type) {
        const baileysFormat = {
            messages: [{
                key: {
                    remoteJid: wppMessage.chatId,
                    fromMe: wppMessage.fromMe,
                    id: wppMessage.id
                },
                messageTimestamp: wppMessage.timestamp,
                message: this.convertMessageContent(wppMessage)
            }],
            type: type // 'notify' o 'append'
        };

        // Emitir evento compatible con Baileys
        this.emit('messages.upsert', baileysFormat);
    }

    /**
     * Convertir contenido de mensaje WPPConnect a formato Baileys
     */
    convertMessageContent(wppMessage) {
        const content = {};

        if (wppMessage.type === 'chat') {
            content.conversation = wppMessage.body;
        } else if (wppMessage.type === 'image') {
            content.imageMessage = {
                caption: wppMessage.caption || '',
                mimetype: wppMessage.mimetype
            };
        } else if (wppMessage.type === 'video') {
            content.videoMessage = {
                caption: wppMessage.caption || '',
                mimetype: wppMessage.mimetype
            };
        } else if (wppMessage.type === 'audio' || wppMessage.type === 'ptt') {
            content.audioMessage = {
                mimetype: wppMessage.mimetype,
                ptt: wppMessage.type === 'ptt'
            };
        } else if (wppMessage.type === 'document') {
            content.documentMessage = {
                caption: wppMessage.caption || '',
                mimetype: wppMessage.mimetype,
                fileName: wppMessage.filename
            };
        }

        return content;
    }

    /**
     * Configurar listeners de estado
     */
    setupStatusListeners() {
        // Listener de desconexión
        this.client.onStateChange((state) => {
            console.log(`[WPPCONNECT] 🔄 Estado cambió a: ${state}`);
            
            if (state === 'DISCONNECTED') {
                this.emit('connection.update', {
                    connection: 'close',
                    lastDisconnect: {
                        error: { message: 'Disconnected' }
                    }
                });
            }
        });
    }

    /**
     * Enviar mensaje (compatible con Baileys)
     */
    async sendMessage(jid, content, options = {}) {
        if (!this.client) throw new Error('Cliente no inicializado');

        try {
            if (content.text) {
                return await this.client.sendText(jid, content.text);
            } else if (content.image) {
                return await this.client.sendImage(jid, content.image, 'image', content.caption || '');
            } else if (content.video) {
                return await this.client.sendVideoAsGif(jid, content.video, 'video', content.caption || '');
            } else if (content.audio) {
                return await this.client.sendVoice(jid, content.audio);
            } else if (content.document) {
                return await this.client.sendFile(jid, content.document, content.fileName || 'file', content.caption || '');
            }
        } catch (error) {
            console.error(`[WPPCONNECT] ❌ Error enviando mensaje:`, error);
            throw error;
        }
    }

    /**
     * Obtener contactos
     */
    async getAllContacts() {
        if (!this.client) throw new Error('Cliente no inicializado');
        return await this.client.getAllContacts();
    }

    /**
     * Obtener chats
     */
    async getAllChats() {
        if (!this.client) throw new Error('Cliente no inicializado');
        return await this.client.getAllChats();
    }

    /**
     * Descargar media
     */
    async downloadMedia(message) {
        if (!this.client) throw new Error('Cliente no inicializado');
        return await this.client.decryptFile(message);
    }

    /**
     * Cerrar sesión
     */
    async logout() {
        if (this.client) {
            await this.client.logout();
        }
    }

    /**
     * Obtener info del usuario
     */
    async getMe() {
        if (!this.client) throw new Error('Cliente no inicializado');
        return await this.client.getHostDevice();
    }
}

module.exports = { WPPConnectAdapter };
