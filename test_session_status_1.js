const axios = require('axios');

async function test() {
    try {
        console.log('Testing /api/session/1/status...');
        const response = await axios.get('http://localhost:3002/api/session/1/status');
        console.log('Response:', response.data);
    } catch (err) {
        console.error('Error:', err.response ? err.response.data : err.message);
    }
}

test();
