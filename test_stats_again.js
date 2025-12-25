const axios = require('axios');

async function test() {
    try {
        console.log('Testing /api/dashboard/stats/1...');
        const response = await axios.get('http://localhost:3002/api/dashboard/stats/1');
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.error('Error:', err.response ? err.response.data : err.message);
    }
}

test();
