const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');

async function testMessage() {
    // Usar la sesión del número 595994854167 para enviar mensaje al 595985768793
    const authDir = path.join(__dirname, 'auth_info_multi', 'e16d1b95cf79d526');

    console.log(`📱 Enviando mensaje de prueba...`);

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ['WhatsFlow Test', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection } = update;

        if (connection === 'open') {
            console.log('✅ Conectado');

            await new Promise(r => setTimeout(r, 3000));

            try {
                const targetJid = '595985768793@s.whatsapp.net';

                console.log(`📤 Enviando mensaje a ${targetJid}...`);
                const result = await sock.sendMessage(targetJid, {
                    text: '🤖 PRUEBA DE CONECTIVIDAD - WhatsFlow\n\nSi ves este mensaje, la conexión funciona perfectamente.\n\nEl problema está SOLO en los Estados de WhatsApp, no en el sistema general.\n\nHora: ' + new Date().toLocaleTimeString()
                });

                console.log('✅ Mensaje enviado exitosamente:', result.key.id);
                console.log('\n🏁 Revisa el WhatsApp del número 595985768793');

                setTimeout(() => process.exit(0), 3000);

            } catch (error) {
                console.error('❌ Error:', error);
                process.exit(1);
            }
        }
    });
}

testMessage();
