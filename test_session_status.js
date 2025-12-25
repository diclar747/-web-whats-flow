const axios = require('axios');

async function checkStatus() {
    try {
        // ID de sesión del usuario
        const sessionId = '72255598c3ca9f16';
        console.log(`Checking status for session: ${sessionId}`);

        const response = await axios.get(`http://localhost:3001/api/sessions/status/${sessionId}`);
        console.log('Status Response:', response.data);
    } catch (error) {
        console.error('Error fetching status:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

checkStatus();
