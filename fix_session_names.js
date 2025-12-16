const mysql = require('mysql2/promise');
const { makeWASocket, fetchLatestBaileysVersion, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');

const BASE_AUTH_DIR = path.join(__dirname, 'auth_info_multi');

async function fixSessionNames() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: 'whatsflow2024',
        database: 'whatsflow',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        console.log('🔍 Buscando sesiones activas sin nombre...');
        
        const [sessions] = await pool.execute(
            'SELECT id, phone_number, session_id, name, avatar_url FROM user_sessions WHERE is_active = TRUE AND name IS NULL'
        );
        
        console.log(`\n📊 Encontradas ${sessions.length} sesiones sin nombre`);
        
        for (const session of sessions) {
            console.log(`\n📞 Procesando ${session.phone_number} (${session.session_id})...`);
            
            // Verificar si existen credenciales
            const authPath = path.join(BASE_AUTH_DIR, session.session_id);
            const credsPath = path.join(authPath, 'creds.json');
            
            if (!fs.existsSync(credsPath)) {
                console.log(`  ⚠️  No hay credenciales guardadas`);
                continue;
            }
            
            try {
                // Cargar credenciales
                const { state, saveCreds } = await useMultiFileAuthState(authPath);
                
                // Leer creds.json para obtener información del usuario
                const credsData = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
                
                let userName = null;
                let userAvatarUrl = session.avatar_url; // Mantener el existente si ya tiene
                
                // Intentar obtener el nombre de las credenciales
                if (credsData.me) {
                    userName = credsData.me.name || credsData.me.pushname || credsData.me.notify || null;
                    console.log(`  ✅ Nombre encontrado en credenciales: ${userName}`);
                }
                
                // Si no hay nombre en credenciales, intentar conectar brevemente
                if (!userName) {
                    console.log(`  🔄 Intentando obtener nombre mediante conexión temporal...`);
                    
                    const { version } = await fetchLatestBaileysVersion();
                    const sock = makeWASocket({
                        version,
                        auth: state,
                        printQRInTerminal: false,
                        syncFullHistory: false,
                        markOnlineOnConnect: false
                    });
                    
                    // Esperar a que se conecte
                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
                        
                        sock.ev.on('connection.update', (update) => {
                            if (update.connection === 'open') {
                                clearTimeout(timeout);
                                
                                if (sock.user) {
                                    userName = sock.user.pushname || sock.user.name || sock.user.notify || null;
                                    console.log(`  ✅ Nombre obtenido: ${userName}`);
                                }
                                
                                // Obtener avatar si no existe
                                if (!userAvatarUrl && sock.user) {
                                    const userJid = session.phone_number + '@s.whatsapp.net';
                                    sock.profilePictureUrl(userJid, 'image')
                                        .then(url => {
                                            userAvatarUrl = url;
                                            console.log(`  ✅ Avatar obtenido`);
                                        })
                                        .catch(() => {
                                            console.log(`  ℹ️  Sin foto de perfil`);
                                        })
                                        .finally(() => {
                                            sock.ws.close();
                                            resolve();
                                        });
                                } else {
                                    sock.ws.close();
                                    resolve();
                                }
                            } else if (update.connection === 'close') {
                                clearTimeout(timeout);
                                reject(new Error('Connection closed'));
                            }
                        });
                    }).catch(err => {
                        console.log(`  ⚠️  No se pudo conectar: ${err.message}`);
                    });
                }
                
                // Actualizar en base de datos
                if (userName || userAvatarUrl) {
                    await pool.execute(
                        'UPDATE user_sessions SET name = ?, avatar_url = ? WHERE id = ?',
                        [userName, userAvatarUrl, session.id]
                    );
                    console.log(`  ✅ Actualizado en base de datos`);
                    if (userName) console.log(`     Nombre: ${userName}`);
                    if (userAvatarUrl) console.log(`     Avatar: SI`);
                }
                
            } catch (err) {
                console.log(`  ❌ Error: ${err.message}`);
            }
        }
        
        console.log('\n✅ Proceso completado');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

fixSessionNames();
