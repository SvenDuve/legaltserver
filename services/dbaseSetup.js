const db = require('../config/database');


// Initialize Database Tables
function initDb() {
    const createTimeEntriesTable = `
        CREATE TABLE IF NOT EXISTS time_entries (
            id SERIAL PRIMARY KEY,
            pid TEXT NOT NULL,
            client TEXT NOT NULL,
            department TEXT NOT NULL,
            project TEXT NOT NULL,
            counterparty TEXT,
            description TEXT,
            start_time TIMESTAMP NOT NULL,
            end_time TIMESTAMP NOT NULL
        );
    `;

    const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(20) DEFAULT 'user'
        );
    `;

    db.query(createTimeEntriesTable)
        .then(() => console.log("Table 'time_entries' created or already exists."))
        .catch(err => console.error('Error creating time_entries table:', err.message));

    db.query(createUsersTable)
        .then(() => console.log("Table 'users' created or already exists."))
        .catch(err => console.error('Error creating users table:', err.message));
}


// Function to seed an initial admin user
async function seedAdminUser() {
    const adminUsername = process.env.ADMIN;
    const adminPassword = process.env.ADMIN_PASSWORD; // Change this to a secure password

    try {
        // Check if admin user exists
        const userResult = await db.query('SELECT * FROM users WHERE username = $1', [adminUsername]);
        if (userResult.rows.length === 0) {
            // Hash the password
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            // Insert admin user
            await db.query(
                'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
                [adminUsername, hashedPassword, 'admin']
            );
            console.log('Admin user created with username:', adminUsername);
        } else {
            console.log('Admin user already exists.');
        }
    } catch (err) {
        console.error('Error seeding admin user:', err.message);
    }
}


async function checkTimezone() {
    try {
        const result = await db.query('SHOW timezone');
        console.log('Current Timezone:', result.rows[0].TimeZone);
    } catch (error) {
        console.error('Error fetching timezone:', error);
    }
}


module.exports = { initDb, seedAdminUser, checkTimezone };