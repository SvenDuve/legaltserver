const { Pool } = require('pg');


const db = new Pool(
    process.env.NODE_ENV === 'production'
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl: { 
                    rejectUnauthorized: false,
            },
        }
        : {
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_DATABASE,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT,
        }
);

module.exports = db;