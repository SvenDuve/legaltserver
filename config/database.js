const { Pool } = require('pg');

let pool;

if (process.env.NODE_ENV === 'production') {
    // Use production connection string
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false, // Required for many hosted PostgreSQL services
        },
    });
} else {
    // Use local development database configuration
    pool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_DATABASE,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT || 5432, // Default PostgreSQL port
    });
}

module.exports = pool; // Export the single instance of Pool
