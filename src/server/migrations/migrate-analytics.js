/**
 * Analytics Migration Script
 * 
 * This script:
 * 1. Creates analytics tables
 * 2. Adds indexes to existing tables
 * 3. Populates initial analytics data from existing records
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'whatsflow',
    multipleStatements: true
};

async function runMigration() {
    console.log('🚀 Starting Analytics Migration...\n');

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Database connection established\n');

        // Step 1: Read and execute schema SQL
        console.log('📋 Step 1: Creating analytics tables and indexes...');
        const schemaSQL = fs.readFileSync(
            path.join(__dirname, 'analytics-schema.sql'),
            'utf8'
        );

        await connection.query(schemaSQL);
        console.log('✅ Analytics schema created successfully\n');

        // Step 2: Populate initial message metrics
        console.log('📊 Step 2: Populating initial message metrics...');
        await populateMessageMetrics(connection);
        console.log('✅ Message metrics populated\n');

        // Step 3: Populate campaign metrics
        console.log('📊 Step 3: Populating campaign metrics...');
        await populateCampaignMetrics(connection);
        console.log('✅ Campaign metrics populated\n');

        // Step 4: Populate agent metrics
        console.log('📊 Step 4: Populating agent metrics...');
        await populateAgentMetrics(connection);
        console.log('✅ Agent metrics populated\n');

        // Step 5: Populate kanban metrics
        console.log('📊 Step 5: Populating kanban metrics...');
        await populateKanbanMetrics(connection);
        console.log('✅ Kanban metrics populated\n');

        console.log('🎉 Analytics migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n✅ Database connection closed');
        }
    }
}

/**
 * Populate message metrics from existing messages
 */
async function populateMessageMetrics(connection) {
    const query = `
        INSERT INTO analytics_message_metrics 
        (session_id, metric_date, total_sent, total_received, total_delivered, 
         total_read, total_failed, delivery_rate, read_rate)
        SELECT 
            session_id,
            DATE(timestamp) as metric_date,
            SUM(CASE WHEN from_me = 1 THEN 1 ELSE 0 END) as total_sent,
            SUM(CASE WHEN from_me = 0 THEN 1 ELSE 0 END) as total_received,
            SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as total_delivered,
            SUM(CASE WHEN is_read = 1 THEN 1 ELSE 0 END) as total_read,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
            ROUND(
                (SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) * 100.0) / 
                NULLIF(SUM(CASE WHEN from_me = 1 THEN 1 ELSE 0 END), 0),
                2
            ) as delivery_rate,
            ROUND(
                (SUM(CASE WHEN is_read = 1 THEN 1 ELSE 0 END) * 100.0) / 
                NULLIF(SUM(CASE WHEN from_me = 1 THEN 1 ELSE 0 END), 0),
                2
            ) as read_rate
        FROM messages
        WHERE timestamp >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
        GROUP BY session_id, DATE(timestamp)
        ON DUPLICATE KEY UPDATE
            total_sent = VALUES(total_sent),
            total_received = VALUES(total_received),
            total_delivered = VALUES(total_delivered),
            total_read = VALUES(total_read),
            total_failed = VALUES(total_failed),
            delivery_rate = VALUES(delivery_rate),
            read_rate = VALUES(read_rate),
            updated_at = CURRENT_TIMESTAMP
    `;

    const [result] = await connection.query(query);
    console.log(`   📈 Processed ${result.affectedRows} daily message metrics`);
}

/**
 * Populate campaign metrics from existing campaigns
 */
async function populateCampaignMetrics(connection) {
    const query = `
        INSERT INTO analytics_campaign_metrics
        (campaign_id, session_id, campaign_name, campaign_status, 
         total_recipients, total_sent, total_delivered, total_read, total_failed,
         delivery_rate, read_rate, scheduled_at, started_at)
        SELECT 
            c.id as campaign_id,
            c.session_id,
            c.name as campaign_name,
            c.status as campaign_status,
            COUNT(cr.id) as total_recipients,
            SUM(CASE WHEN cr.status IN ('sent', 'delivered', 'read') THEN 1 ELSE 0 END) as total_sent,
            SUM(CASE WHEN cr.status IN ('delivered', 'read') THEN 1 ELSE 0 END) as total_delivered,
            SUM(CASE WHEN cr.status = 'read' THEN 1 ELSE 0 END) as total_read,
            SUM(CASE WHEN cr.status = 'failed' THEN 1 ELSE 0 END) as total_failed,
            ROUND(
                (SUM(CASE WHEN cr.status IN ('delivered', 'read') THEN 1 ELSE 0 END) * 100.0) / 
                NULLIF(COUNT(cr.id), 0),
                2
            ) as delivery_rate,
            ROUND(
                (SUM(CASE WHEN cr.status = 'read' THEN 1 ELSE 0 END) * 100.0) / 
                NULLIF(COUNT(cr.id), 0),
                2
            ) as read_rate,
            c.scheduled_at,
            MIN(cr.sent_at) as started_at
        FROM campaigns c
        LEFT JOIN campaign_recipients cr ON c.id = cr.campaign_id
        GROUP BY c.id
        ON DUPLICATE KEY UPDATE
            campaign_status = VALUES(campaign_status),
            total_recipients = VALUES(total_recipients),
            total_sent = VALUES(total_sent),
            total_delivered = VALUES(total_delivered),
            total_read = VALUES(total_read),
            total_failed = VALUES(total_failed),
            delivery_rate = VALUES(delivery_rate),
            read_rate = VALUES(read_rate),
            updated_at = CURRENT_TIMESTAMP
    `;

    const [result] = await connection.query(query);
    console.log(`   📈 Processed ${result.affectedRows} campaign metrics`);
}

/**
 * Populate agent metrics from existing agent data
 */
async function populateAgentMetrics(connection) {
    const query = `
        INSERT INTO analytics_agent_metrics
        (agent_id, session_id, metric_date, agent_name, 
         total_conversations, conversations_closed)
        SELECT 
            a.id as agent_id,
            a.session_id,
            DATE(ach.assigned_at) as metric_date,
            a.name as agent_name,
            COUNT(ach.id) as total_conversations,
            SUM(CASE WHEN ach.status = 'closed' THEN 1 ELSE 0 END) as conversations_closed
        FROM agents a
        LEFT JOIN agent_chat_history ach ON a.id = ach.agent_id
        WHERE ach.assigned_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
        GROUP BY a.id, DATE(ach.assigned_at)
        ON DUPLICATE KEY UPDATE
            total_conversations = VALUES(total_conversations),
            conversations_closed = VALUES(conversations_closed),
            updated_at = CURRENT_TIMESTAMP
    `;

    const [result] = await connection.query(query);
    console.log(`   📈 Processed ${result.affectedRows} agent daily metrics`);
}

/**
 * Populate kanban metrics from existing kanban data
 */
async function populateKanbanMetrics(connection) {
    const query = `
        INSERT INTO analytics_kanban_metrics
        (board_id, session_id, metric_date, board_name)
        SELECT 
            kb.id as board_id,
            kb.session_id,
            CURDATE() as metric_date,
            kb.name as board_name
        FROM kanban_boards kb
        ON DUPLICATE KEY UPDATE
            board_name = VALUES(board_name),
            updated_at = CURRENT_TIMESTAMP
    `;

    const [result] = await connection.query(query);
    console.log(`   📈 Processed ${result.affectedRows} kanban board metrics`);
}

// Run migration
if (require.main === module) {
    runMigration()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { runMigration };
