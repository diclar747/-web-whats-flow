const axios = require('axios');
const jwt = require('jsonwebtoken');

// Config
// Try ports 3000, 3001, 3002
const PORTS = [5000, 3000, 3001, 8080];
const JWT_SECRET = process.env.JWT_SECRET || 'whatsflow_jwt_secret';
require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });

const SESSION_ID = '595985768793'; // Admin phone
const ADMIN_PHONE = '595985768793';
const AGENT_ID = 4; // Claudio
const CHAT_JID = '595981234567@s.whatsapp.net'; // Dummy chat

async function runTests() {
    let BASE_URL = '';

    // Find working port
    for (const port of PORTS) {
        try {
            await axios.get(`http://localhost:${port}/api/health`, { timeout: 1000 });
            BASE_URL = `http://localhost:${port}`;
            console.log(`✅ Server found on port ${port}`);
            break;
        } catch (e) {
            // ignore
        }
    }

    if (!BASE_URL) {
        console.log('❌ Could not find server on ports', PORTS);
        const port = process.env.PORT || 3000;
        BASE_URL = `http://localhost:${port}`;
        console.log(`⚠️ Defaulting to env PORT: ${port}`);
    }
    try {
        // 1. Create ADMIN Token (Legacy/Admin format)
        // admin_token = base64(userId:email:timestamp:hash) is legacy.
        // Let's use the JWT admin format I enabled.
        const adminToken = jwt.sign({
            role: 'admin',
            phone: ADMIN_PHONE,
            sessionId: SESSION_ID
        }, JWT_SECRET);

        console.log('\n=== TEST 1: GET /api/agents/list ===');
        try {
            const res = await axios.get(`${BASE_URL}/api/agents/list`, {
                headers: { Authorization: `Bearer ${adminToken}` },
                params: { sessionId: SESSION_ID }
            });
            console.log('Status:', res.status);
            console.log('Agents Found:', res.data.agents.length);
            if (res.data.agents.length > 0) {
                console.log('First Agent:', JSON.stringify(res.data.agents[0], null, 2));
            }
        } catch (e) {
            console.error('Agents List Error:', e.response ? e.response.data : e.message);
        }

        console.log('\n=== TEST 2: POST /api/chats/transfer ===');
        try {
            const payload = {
                sessionId: SESSION_ID,
                chatJid: CHAT_JID,
                to_user_id: AGENT_ID,
                from_user_id: null
            };
            console.log('Payload:', payload);
            const res = await axios.post(`${BASE_URL}/api/chats/transfer`, payload, {
                headers: { Authorization: `Bearer ${adminToken}` }
            });
            console.log('Transfer Response:', res.data);
        } catch (e) {
            console.error('Transfer Error:', e.response ? e.response.data : e.message);
            console.error('Status:', e.response ? e.response.status : 'N/A');
        }

    } catch (err) {
        console.error('General Error:', err);
    }
}

runTests();
