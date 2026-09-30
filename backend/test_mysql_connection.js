/**
 * Database Connection & Health Verification Tool for MySQL
 * Run with: node backend/test_mysql_connection.js
 */
const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MYSQL_CONFIG = {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'blueprint_db'
};

async function testDatabaseConnection() {
    console.log('====================================================');
    console.log('   DOC DENTAL CARE: MYSQL CONNECTION DIAGNOSTIC     ');
    console.log('====================================================\n');
    console.log(`Connecting to: ${MYSQL_CONFIG.user}@${MYSQL_CONFIG.host}:${MYSQL_CONFIG.port}/${MYSQL_CONFIG.database}...\n`);

    try {
        const startTime = Date.now();
        const connection = await mysql.createConnection(MYSQL_CONFIG);
        const latency = Date.now() - startTime;

        console.log(`✔ [OK] Connection Established! (Response Time: ${latency}ms)`);

        // 1. Check Tables in Database
        const [tables] = await connection.query(`SHOW TABLES IN \`${MYSQL_CONFIG.database}\``);
        const tableNames = tables.map(t => Object.values(t)[0]);
        console.log(`✔ [OK] Total Tables Found (${tableNames.length}):`);
        console.log(`   ${tableNames.join(', ')}\n`);

        // 2. Check Users
        const [users] = await connection.query('SELECT id, email, role, full_name, otp_status FROM users');
        console.log(`✔ [OK] Users in Database (${users.length}):`);
        if (users.length > 0) {
            console.table(users);
        } else {
            console.log('   (No users found yet. Run the insert script in Workbench.)\n');
        }

        // 3. Check Clinic Pricelist
        const [prices] = await connection.query('SELECT COUNT(*) as count FROM clinic_pricelist');
        console.log(`✔ [OK] Clinic Services Seeded: ${prices[0].count} services.`);

        await connection.end();

        console.log('\n====================================================');
        console.log('  STATUS: DATABASE CONNECTION IS 100% READY & ACTIVE ');
        console.log('====================================================\n');
    } catch (err) {
        console.error('\n✖ [FAIL] CONNECTION FAILED:');
        console.error(`  Error Code    : ${err.code || 'UNKNOWN'}`);
        console.error(`  Error Message : ${err.message}\n`);
        console.error('Troubleshooting checklist:');
        console.error('1. Is MySQL Server running in MySQL Workbench / XAMPP on port 3306?');
        console.error('2. Check your .env file: Ensure MYSQL_USER, MYSQL_PASSWORD, and MYSQL_DATABASE are correct.');
        console.error('3. Did you execute the database schema creation query?\n');
    }
}

testDatabaseConnection();
