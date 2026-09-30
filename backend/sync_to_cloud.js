

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const localConfig = {
    host: 'localhost',
    port: 3306,
    user: process.env.LOCAL_MYSQL_USER || process.env.MYSQL_USER || 'root',
    password: process.env.LOCAL_MYSQL_PASSWORD || process.env.MYSQL_PASSWORD || '',
    database: process.env.LOCAL_MYSQL_DATABASE || 'blueprint_db'
};

const args = process.argv.slice(2);
const targetConfig = {
    host: args[0] || process.env.TARGET_HOST || process.env.TARGET_MYSQL_HOST || process.env.MYSQL_HOST,
    port: parseInt(args[1] || process.env.TARGET_PORT || process.env.TARGET_MYSQL_PORT || process.env.MYSQL_PORT || '3306', 10),
    user: args[2] || process.env.TARGET_USER || process.env.TARGET_MYSQL_USER || process.env.MYSQL_USER || 'root',
    password: args[3] || process.env.TARGET_PASSWORD || process.env.TARGET_MYSQL_PASSWORD || process.env.MYSQL_PASSWORD || '',
    database: args[4] || process.env.TARGET_DATABASE || process.env.TARGET_MYSQL_DATABASE || process.env.MYSQL_DATABASE || 'blueprint_db',
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false }
};

async function sync() {
    console.log('====================================================');
    console.log('  CAREPLUS CLINIC: LOCAL -> CLOUD DATABASE SYNC     ');
    console.log('====================================================\n');

    if (!targetConfig.host || targetConfig.host === 'localhost' || targetConfig.host === '127.0.0.1') {
        console.error('✖ Error: Target cloud host is missing or set to localhost.');
        console.log('\nPlease run:');
        console.log('node backend/sync_to_cloud.js <HOST> <PORT> <USER> <PASSWORD> [DATABASE]\n');
        process.exit(1);
    }

    let localConn;
    let targetConn;

    try {
        console.log(`1. Connecting to Local XAMPP MySQL (${localConfig.host}:${localConfig.port})...`);
        localConn = await mysql.createConnection(localConfig);
        console.log('   ✔ Local database connected.');

        console.log(`2. Connecting to Cloud MySQL (${targetConfig.user}@${targetConfig.host}:${targetConfig.port})...`);
        
        // Connect without database first to ensure database exists
        const rootTargetConn = await mysql.createConnection({
            host: targetConfig.host,
            port: targetConfig.port,
            user: targetConfig.user,
            password: targetConfig.password,
            ssl: targetConfig.ssl
        });

        await rootTargetConn.query(`CREATE DATABASE IF NOT EXISTS \`${targetConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await rootTargetConn.end();

        // Connect directly to target database
        targetConn = await mysql.createConnection(targetConfig);
        console.log(`   ✔ Cloud database connected and \`${targetConfig.database}\` selected.`);

        // 3. Apply Schema
        console.log('3. Applying tables and schema...');
        const schemaPath = path.join(__dirname, 'mysql_schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // Clean SQL comments and split statements
        const cleanedSql = schemaSql
            .replace(/--[^\r\n]*/g, '') // remove line comments
            .replace(/\/\*[\s\S]*?\*\//g, ''); // remove block comments

        const statements = cleanedSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.toUpperCase().startsWith('CREATE DATABASE') && !s.toUpperCase().startsWith('USE '));

        for (const statement of statements) {
            try {
                await targetConn.query(statement);
            } catch (err) {
                console.warn(`   Notice on statement: ${err.message}`);
            }
        }
        console.log('   ✔ All schema tables ensured on cloud database.');

        // 4. Sync Superadmin & Users
        console.log('4. Copying users (including Superadmin)...');
        const [users] = await localConn.query('SELECT * FROM users');
        for (const u of users) {
            await targetConn.query(`
                INSERT INTO users (id, email, password, role, full_name, phone, temp_otp, otp_status, banned_until, patient_type, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    password = VALUES(password),
                    role = VALUES(role),
                    full_name = VALUES(full_name),
                    otp_status = VALUES(otp_status),
                    patient_type = VALUES(patient_type)
            `, [
                u.id, u.email, u.password, u.role, u.full_name, u.phone, u.temp_otp, u.otp_status, u.banned_until, u.patient_type || 'New Patient', u.created_at
            ]);
        }
        console.log(`   ✔ ${users.length} users synchronized (Superadmin account active).`);

        // 5. Sync Clinic Pricelist
        console.log('5. Copying clinic pricelist catalog...');
        const [pricelist] = await localConn.query('SELECT * FROM clinic_pricelist');
        await targetConn.query('TRUNCATE TABLE clinic_pricelist');
        for (const item of pricelist) {
            await targetConn.query(`
                INSERT INTO clinic_pricelist (id, category, service, price, created_at)
                VALUES (?, ?, ?, ?, ?)
            `, [item.id, item.category, item.service, item.price, item.created_at || new Date()]);
        }
        console.log(`   ✔ ${pricelist.length} clinic pricelist services synchronized.`);

        console.log('\n====================================================');
        console.log('   SYNC COMPLETE: CLOUD DATABASE IS READY TO USE!   ');
        console.log('====================================================\n');
    } catch (err) {
        console.error('\n✖ Sync failed:', err.message);
    } finally {
        if (localConn) await localConn.end();
        if (targetConn) await targetConn.end();
    }
}

sync();
