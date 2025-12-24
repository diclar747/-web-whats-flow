const jwt = require('jsonwebtoken');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwidXNlcklkIjo1LCJlbWFpbCI6Imdlc3Rpb25AZ21haWwuY29tLnB5IiwicGhvbmUiOiI1OTU5OTQ4NTQxNjciLCJwaG9uZU51bWJlciI6IjU5NTk5NDg1NDE2NyIsInJvbGUiOiJhZ2VudCIsImlhdCI6MTc2NjUzMzE4NSwiZXhwIjoxNzY3MTM3OTg1fQ.raGClP4CcmnGHRvaOJZICM5OfeCZtOg5m_eAjYQvCjA';

console.log('\n📋 Token Decodificado:');
console.log(jwt.decode(token));

const JWT_SECRET = process.env.JWT_SECRET || 'whatsflow_jwt_secret';

try {
    const verified = jwt.verify(token, JWT_SECRET);
    console.log('\n✅ Token VÁLIDO');
    console.log('Datos verificados:', verified);
} catch (error) {
    console.log('\n❌ Token INVÁLIDO:', error.message);
}

// Test con curl
const { exec } = require('child_process');

const curlCmd = `curl -s -H "Authorization: Bearer ${token}" http://localhost:3001/api/agents/5/chats?sessionId=1`;

console.log('\n🔍 Probando endpoint con curl...\n');

exec(curlCmd, (error, stdout, stderr) => {
    if (error) {
        console.error('❌ Error ejecutando curl:', error.message);
        return;
    }

    console.log('📡 Respuesta del servidor:');
    try {
        const response = JSON.parse(stdout);
        console.log(JSON.stringify(response, null, 2));
    } catch (e) {
        console.log(stdout);
    }
});
