const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

const secret = 'whatsflow_jwt_secret';
const token = jwt.sign({
    phone: '595994854167',
    role: 'admin',
    is_super_admin: true
}, secret);

console.log('Testing with token:', token);

fetch('http://localhost:3001/api/plans', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        name: 'Test Plan',
        price: 100,
        description: 'Test',
        modules: []
    })
})
    .then(res => {
        console.log('Status:', res.status);
        return res.text().then(text => console.log('Body:', text));
    })
    .catch(err => console.error('Error:', err));
