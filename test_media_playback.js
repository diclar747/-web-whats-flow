#!/usr/bin/env node

/**
 * Test script to verify media playback functionality
 * Checks database for media messages and verifies files exist
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function testMediaPlayback() {
    console.log('🔍 Testing Media Playback Functionality\n');

    // Database connection
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'Diclar2024*',
        database: 'whatsflow'
    });

    try {
        // 1. Check for media messages in database
        console.log('1️⃣ Checking database for media messages...');
        const [messages] = await connection.execute(`
      SELECT id, message_type, media_url, text_content 
      FROM messages 
      WHERE media_url IS NOT NULL 
      ORDER BY timestamp DESC 
      LIMIT 10
    `);

        console.log(`   Found ${messages.length} media messages\n`);

        // 2. Verify message types
        console.log('2️⃣ Message types found:');
        const types = {};
        messages.forEach(msg => {
            types[msg.message_type] = (types[msg.message_type] || 0) + 1;
        });
        Object.entries(types).forEach(([type, count]) => {
            console.log(`   - ${type}: ${count}`);
        });
        console.log('');

        // 3. Verify files exist
        console.log('3️⃣ Verifying media files exist on server...');
        let existCount = 0;
        let missingCount = 0;

        for (const msg of messages) {
            const mediaPath = path.join('/var/www/web.whats-flow.com', msg.media_url);
            const exists = fs.existsSync(mediaPath);

            if (exists) {
                existCount++;
                const stats = fs.statSync(mediaPath);
                console.log(`   ✅ ${msg.message_type.padEnd(15)} ${msg.media_url} (${(stats.size / 1024).toFixed(1)} KB)`);
            } else {
                missingCount++;
                console.log(`   ❌ ${msg.message_type.padEnd(15)} ${msg.media_url} (MISSING)`);
            }
        }

        console.log('');
        console.log('📊 Summary:');
        console.log(`   Total media messages: ${messages.length}`);
        console.log(`   Files found: ${existCount}`);
        console.log(`   Files missing: ${missingCount}`);

        if (missingCount === 0) {
            console.log('\n✅ All media files are accessible!');
        } else {
            console.log('\n⚠️ Some media files are missing!');
        }

        // 4. Test case-insensitive matching
        console.log('\n4️⃣ Testing case-insensitive type matching...');
        const testTypes = ['imageMessage', 'audioMessage', 'videoMessage', 'stickerMessage'];
        testTypes.forEach(type => {
            const normalized = type.toLowerCase();
            const matches =
                normalized === 'imagemessage' || normalized === 'image' ||
                normalized === 'audiomessage' || normalized === 'audio' ||
                normalized === 'videomessage' || normalized === 'video' ||
                normalized === 'stickermessage' || normalized === 'sticker';
            console.log(`   ${type} → ${normalized} → ${matches ? '✅' : '❌'}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await connection.end();
    }
}

testMediaPlayback().catch(console.error);
