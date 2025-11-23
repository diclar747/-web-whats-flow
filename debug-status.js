const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');

async function debugStatus() {
    const sessionId = '595985768793';
    const authDir = path.join(__dirname, 'auth_info_multi', sessionId);

    console.log(`🔍 Iniciando diagnóstico para sesión: ${sessionId}`);

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        browser: ['WhatsFlow Debug', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log('✅ CONEXIÓN ESTABLECIDA');
            const userJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            console.log(`👤 Usuario conectado: ${userJid}`);

            // Esperar sincronización inicial
            console.log('⏳ Esperando 5 segundos para sincronización...');
            await new Promise(r => setTimeout(r, 5000));

            try {
                // PRUEBA 1: Mensaje normal a uno mismo (Verificar envío básico)
                console.log('\n--- PRUEBA 1: Mensaje directo a ti mismo ---');
                const msg1 = await sock.sendMessage(userJid, { text: '🤖 Test de Conectividad WhatsFlow: OK' });
                console.log('Resultado:', msg1 ? '✅ Enviado (ID: ' + msg1.key.id + ')' : '❌ Falló');

                // PRUEBA 2: Estado de Texto (Método Estándar)
                console.log('\n--- PRUEBA 2: Estado de Texto (Método Estándar) ---');
                const statusContent = {
                    text: 'Test Estado Estándar ' + new Date().toLocaleTimeString(),
                    backgroundColor: '#FF0000', // Rojo para distinguir
                    font: 1
                };
                const msg2 = await sock.sendMessage('status@broadcast', statusContent, {
                    statusJidList: [] // Enviar a todos
                });
                console.log('Resultado:', msg2 ? '✅ Enviado (ID: ' + msg2.key.id + ')' : '❌ Falló');

                // PRUEBA 3: Estado de Texto (Método Relay - Avanzado)
                console.log('\n--- PRUEBA 3: Estado de Texto (Método Relay) ---');
                const messageContent = {
                    extendedTextMessage: {
                        text: 'Test Estado Relay ' + new Date().toLocaleTimeString(),
                        backgroundArgb: 0xFF00FF00, // Verde
                        font: 2
                    }
                };

                const waMessage = await generateWAMessageFromContent(
                    'status@broadcast',
                    messageContent,
                    { userJid: sock.user.id }
                );

                await sock.relayMessage(
                    'status@broadcast',
                    waMessage.message,
                    { messageId: waMessage.key.id }
                );
                console.log('Resultado: ✅ Relay ejecutado (sin error)');

                console.log('\n🏁 PRUEBAS FINALIZADAS. Revisa tu celular.');
                console.log('1. ¿Te llegó un mensaje directo? (Si NO, no hay conexión real)');
                console.log('2. ¿Ves el estado Rojo? (Método Estándar)');
                console.log('3. ¿Ves el estado Verde? (Método Relay)');

                setTimeout(() => process.exit(0), 5000);

            } catch (error) {
                console.error('❌ ERROR CRÍTICO:', error);
                process.exit(1);
            }
        } else if (connection === 'close') {
            if (lastDisconnect?.error) {
                console.log('❌ Desconectado:', lastDisconnect.error);
            }
        }
    });
}

debugStatus();
