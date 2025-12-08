const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'whatsflow_jwt_secret';
const PORT = 3002; // Default port from index.js
const ADMIN_PHONE = '595985768793';

async function test() {
    try {
        const token = jwt.sign({
            role: 'admin',
            phone: ADMIN_PHONE
        }, JWT_SECRET);

        console.log('Testing /api/agents/list on port', PORT);
        const res = await axios.get(`http://localhost:${PORT}/api/agents/list`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('Response Status:', res.status);
        console.log('Agents JSON:', JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error('Error:', e.response ? e.response.data : e.message);
    }
}
test();
