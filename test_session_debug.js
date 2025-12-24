const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');

async function testSession(sessionId) {
    const authPath = path.join('/var/www/web.whats-flow.com/auth_info_multi', sessionId);
    console.log(`Testing session: ${sessionId} at ${authPath}`);

    if (!fs.existsSync(authPath)) {
        console.error('Auth directory not found');
        return;
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        console.log(`Connection update: ${connection}`);
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reason:', lastDisconnect?.error?.message);
            console.log('Status code:', lastDisconnect?.error?.output?.statusCode);
            console.log('Should reconnect?', shouldReconnect);
            process.exit(0);
        } else if (connection === 'open') {
            console.log('Connection opened successfully!');
            console.log('User:', sock.user);
            process.exit(0);
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

const sessionId = '63d9a64982fe0f92';
testSession(sessionId).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
