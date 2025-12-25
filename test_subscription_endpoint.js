const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const API_URL = 'http://localhost:3002/api/subscriptions/my-subscription';
const PHONE = '595985768793';
const SECRET = process.env.JWT_SECRET || 'whatsflow_jwt_secret';

// Generate a mock token for Claudio
const token = jwt.sign(
    {
        id: 999, // dummy id
        email: 'claudio@cnid.com.py',
        role: 'admin',
        phone: PHONE
    },
    SECRET,
    { expiresIn: '1h' }
);

async function checkSubscription() {
    try {
        console.log(`Testing subscription for phone: ${PHONE}`);
        const response = await axios.get(`${API_URL}?phone=${PHONE}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Response Status:', response.status);
        console.log('Response Data:', JSON.stringify(response.data, null, 2));

        if (response.data.success) {
            const sub = response.data.subscription;
            if (sub.subscription_plan === 'Manager') {
                console.log('✅ Plan is correctly set to Manager.');
            } else {
                console.error('❌ Plan is NOT Manager. It is:', sub.subscription_plan);
            }

            if (sub.plan_details) {
                console.log('Plan Details found:');
                console.log(`- Max Users: ${sub.plan_details.max_users}`);
                console.log(`- Max Sessions: ${sub.plan_details.max_sessions || 'N/A from this endpoint'}`);
                console.log(`- Max Messages: ${sub.plan_details.max_messages_per_month}`);
            } else {
                console.error('❌ No plan_details found in response.');
            }
        }

    } catch (error) {
        console.error('Error calling API:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

checkSubscription();
