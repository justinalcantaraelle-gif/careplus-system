const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');


dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();


const connectionUrl = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.MYSQL_URI || process.env.JAWSDB_URL || process.env.CLEARDB_DATABASE_URL;

let host = 'localhost';
let port = 3306;
let user = 'root';
let password = '';
let database = 'blueprint_db';

if (connectionUrl && typeof connectionUrl === 'string' && (connectionUrl.startsWith('mysql://') || connectionUrl.startsWith('mysql2://'))) {
    try {
        const parsed = new URL(connectionUrl);
        host = parsed.hostname || 'localhost';
        port = parseInt(parsed.port || '3306', 10);
        user = decodeURIComponent(parsed.username || 'root');
        password = decodeURIComponent(parsed.password || '');
        database = parsed.pathname ? parsed.pathname.replace(/^\//, '') : 'blueprint_db';
    } catch (e) {
        console.warn('[MySQL DB] Warning: Could not parse connection URL, falling back to individual variables:', e.message);
    }
} else {
    // 2. Support standard and cloud variable aliases (e.g. MYSQL_*, DB_*, TIDB_*, Railway MYSQL*)
    host = (process.env.MYSQL_HOST || process.env.DB_HOST || process.env.MYSQLHOST || process.env.TIDB_HOST || process.env.DATABASE_HOST || process.env.DB_HOSTNAME || process.env.MYSQL_HOSTNAME || 'localhost').trim();
    port = parseInt(process.env.MYSQL_PORT || process.env.DB_PORT || process.env.MYSQLPORT || process.env.TIDB_PORT || '3306', 10);
    user = (process.env.MYSQL_USER || process.env.DB_USER || process.env.MYSQLUSER || process.env.TIDB_USER || 'root').trim();
    password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.TIDB_PASSWORD || '';
    database = (process.env.MYSQL_DATABASE || process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.TIDB_DATABASE || 'blueprint_db').trim();
}

// 3. SSL Configuration
const isRemoteHost = host !== 'localhost' && host !== '127.0.0.1';
const sslExplicitlyDisabled = process.env.MYSQL_SSL === 'false' || process.env.DB_SSL === 'false' || process.env.MYSQL_SSL === '0';
const useSSL = !sslExplicitlyDisabled && (process.env.MYSQL_SSL === 'true' || process.env.DB_SSL === 'true' || process.env.MYSQL_SSL === '1' || isRemoteHost);

const poolConfig = {
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: process.env.VERCEL ? 5 : 15,
    queueLimit: 0,
    connectTimeout: 15000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    charset: 'utf8mb4'
};

if (useSSL) {
    poolConfig.ssl = {
        rejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED === 'true'
    };
}

const mysqlPool = mysql.createPool(poolConfig);

console.log(`[MySQL DB] Initialized Connection Pool: ${user}@${host}:${port}/${database} (SSL: ${useSSL ? 'Enabled' : 'Disabled'})`);

module.exports = mysqlPool;
