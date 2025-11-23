const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');

async function testStatus() {
    const sessionId = '595985768793';
    const authDir = path.join(__dirname, 'auth_info_multi', sessionId);

    console.log(`Using auth dir: ${authDir}`);

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'debug' }), // Nivel DEBUG para ver todo
        printQRInTerminal: true,
        auth: state,
        browser: ['WhatsFlow', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log('✅ Conectado a WhatsApp!');

            // Esperar un momento para asegurar sincronización
            await new Promise(r => setTimeout(r, 5000));

            try {
                console.log('📱 Intentando publicar estado de TEXTO...');

                const statusContent = {
                    text: 'Prueba desde Script Aislado ' + new Date().toLocaleTimeString(),
                    backgroundColor: '#315594',
                    font: 1
                };

                const result = await sock.sendMessage('status@broadcast', statusContent, {
                    statusJidList: [] // Enviar a todos
                });

                console.log('✅ Resultado:', JSON.stringify(result, null, 2));

                console.log('📱 Intentando publicar estado de IMAGEN (si existe)...');
                // Aquí podrías probar imagen si quisieras

                console.log('⏳ Esperando 10 segundos antes de cerrar...');
                await new Promise(r => setTimeout(r, 10000));
                process.exit(0);

            } catch (error) {
                console.error('❌ Error publicando:', error);
                process.exit(1);
            }
        } else if (connection === 'close') {
            console.log('❌ Desconectado:', lastDisconnect?.error);
        }
    });
}

testStatus();
