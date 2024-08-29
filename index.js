const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const moment = require('moment-timezone');
const { Parser } = require('json2csv');
const bcrypt = require('bcrypt');
require('dotenv').config(); // Load environment variables from .env file


const jwt = require('jsonwebtoken');
const app = express();


const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});



// for local development
// const db = new Pool({
//     user: '', // your PostgreSQL username, e.g., 'postgres'
//     host: 'localhost',
//     database: 'legaldb',
//     password: '', // leave empty if no password is set
//     port: 5432, // default PostgreSQL port
// });




async function checkTimezone() {
    try {
        const result = await db.query('SHOW timezone');
        console.log('Current Timezone:', result.rows[0].TimeZone);
    } catch (error) {
        console.error('Error fetching timezone:', error);
    }
}

checkTimezone();

const cors = require('cors');
const corsOptions = {
    origin: '*',
}
app.use(cors(corsOptions));


const fs = require('fs');
const { format } = require('path');

let clientsMap = {};

// Load the clients JSON file when the server starts
fs.readFile('data/clients.json', 'utf8', (err, data) => {
    if (err) {
        console.error(err);
        return;
    }

    let clientsData = JSON.parse(data);
    clientsData.forEach(client => {
        clientsMap[client.value] = client.label;
    });
});

console.log('Hello World I am running..!');

function convertToUTC(localTimeString, timeZone) {
    return moment.tz(localTimeString, timeZone).utc().format();
}

function addTimeEntry(pid, client, department, project, counterparty, description, start_time, end_time, callback) {

    const timeZone = 'Europe/Berlin';
    start_time = convertToUTC(start_time, timeZone);
    end_time = convertToUTC(end_time, timeZone);
    const sql = `INSERT INTO time_entries (pid, client, department, project, counterparty, description, start_time, end_time) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id;`;
    db.query(sql, [pid, client, department, project, counterparty, description, start_time, end_time])
    .then(result => {
        callback(null, { id: result.rows[0].id });
    })
    .catch(err => {
        callback(err);
    });
}


// Function to convert data to CSV and adjust timezone
function convertToCSV(data) {
    // Convert data to CSV format and adjust timezone
    const parser = new Parser();
    const csv = parser.parse(data);
    return csv;
    // Use moment-timezone to convert times to 'Europe/Berlin'
    // Return CSV formatted string
}


async function initDb() {
    const createTableQuery = `
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

    const createUsersTableQuery = `
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            is_admin BOOLEAN DEFAULT FALSE
        );
    `;

    await db.query(createTableQuery)
        .then(() => {
            console.log("Table 'time_entries' created or already exists.");
        })
        .catch(err => {
            console.error(err.message);
        });

    // Create the 'users' table
    await db.query(createUsersTableQuery)
        .then(() => {
            console.log("Table 'users' created or already exists.");
        })
        .catch(err => {
            console.error(err.message);
        });

    // Insert the admin user if not already exists
    await createAdminUser();

}


async function createAdminUser() {
    const username = 'admin'; // Replace with your admin username
    const password = 'adminpassword'; // Replace with your admin password
    const is_admin = true;

    // Check if admin already exists
    const checkAdminQuery = `SELECT * FROM users WHERE username = $1`;
    const checkAdminResult = await db.query(checkAdminQuery, [username]);

    if (checkAdminResult.rows.length > 0) {
        console.log('Admin user already exists.');
        return;
    }

    // Hash the admin password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the admin user into the database
    const insertAdminQuery = `
        INSERT INTO users (username, password, is_admin) VALUES ($1, $2, $3)
    `;
    
    await db.query(insertAdminQuery, [username, hashedPassword, is_admin])
        .then(() => {
            console.log("Admin user created successfully.");
        })
        .catch(err => {
            console.error('Error creating admin user:', err.message);
        });
}


initDb();

app.use(express.json()); // for parsing application/json



// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    console.log('Authorization Header:', authHeader);
    const token = authHeader && authHeader.split(' ')[1];
    console.log('Token:', token);

    if (!token) {
        console.log('No token provided');
        return res.sendStatus(401);
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.log('Token verification failed:', err.message);
            return res.sendStatus(403);
        }

        req.user = user;
        console.log('Token verified, user:', user);
        next();
    });
}

// Middleware to check if user is an admin
async function authenticateAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
        if (err) return res.sendStatus(403);

        try {
            const result = await db.query('SELECT is_admin FROM users WHERE id = $1', [user.id]);
            const isAdmin = result.rows[0].is_admin;

            if (isAdmin) {
                req.user = user;
                next();
            } else {
                res.sendStatus(403);
            }
        } catch (error) {
            console.error(error);
            res.sendStatus(500);
        }
    });
}



// Admin-only route to create new users
app.post('/admin/create-user', authenticateAdmin, async (req, res) => {
    const { username, password, isAdmin } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log(hashedPassword)
        const result = await db.query(
            'INSERT INTO users (username, password, is_admin) VALUES ($1, $2, $3) RETURNING id',
            [username, hashedPassword, isAdmin || false]
        );

        res.status(201).json({ message: 'User created successfully', userId: result.rows[0].id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Function to generate JWT token
function generateToken(user) {
    const payload = {
        id: user.id,
        username: user.username,
        isAdmin: user.is_admin // Add isAdmin based on the user's role
    };

    // Generate the token with a secret key and expiration time
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// Function to fetch a user from the database by username
async function getUserFromDatabase(username) {
    const query = 'SELECT * FROM users WHERE username = $1';
    try {
        const result = await db.query(query, [username]); // Query the database
        return result.rows[0]; // Return the user object if found
    } catch (error) {
        console.error('Error fetching user from database:', error);
        throw error; // Throw the error to handle it in the route
    }
}




// Login route to authenticate users
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        
        const user = await getUserFromDatabase(username); // Fetch the user from the database

        if (user && await bcrypt.compare(password, user.password)) {
            const token = generateToken(user); // Generate a JWT token
            res.json({ token });
        } else {
            res.status(401).json({ error: 'Invalid username or password' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to login user' });
    }
});






app.get('/', (req, res) => {

    res.send('Hello Sven, Paul, Emma und Mama, spielt ihr heute Doppelkopf?');

});

app.get('/api/clients', authenticateToken, (req, res) => {
    // Fetch or compute the clients data
    // const fs = require('fs');
    fs.readFile('data/clients.json', 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('An error occurred')
        }
        const clientsData = JSON.parse(data);
        res.json(clientsData);
    });
});

app.get('/api/departments/:client', authenticateToken, (req, res) => {
    // Fetch or compute the clients data
    // const fs = require('fs');
    fs.readFile('data/departments.json', 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('An error occurred')
        }
        let departmentsData = JSON.parse(data);
        let clientDepartments = departmentsData[req.params.client]
        if (!clientDepartments) {
            return res.status(404).send('Client not found')
        }
        res.json(clientDepartments);
    });
});

app.get('/api/projects/:client', authenticateToken, (req, res) => {
    // Fetch or compute the clients data
    // const fs = require('fs');
    fs.readFile('data/projects.json', 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('An error occurred')
        }
        let projectsData = JSON.parse(data);
        let clientProjects = projectsData[req.params.client]
        if (!clientProjects) {
            return res.status(404).send('Client not found')
        }
        res.json(clientProjects);
    });
});

app.get('/api/counterparties', authenticateToken, (req, res) => {
    // Fetch or compute the clients data
    // const fs = require('fs');
    fs.readFile('data/counterparties.json', 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('An error occurred')
        }
        let counterpartiesData = JSON.parse(data);

        res.json(counterpartiesData);
    });
});


app.post('/api/add-entry', authenticateToken, (req, res) => {
    const { pid, client, department, project, counterparty, description, start_time, end_time } = req.body;
    // console.log('Request body:', req.body); // Log the request body
    addTimeEntry(pid, client, department, project, counterparty, description, start_time, end_time, (err, result) => {
        if (err) {
            // Handle error (e.g., send a 500 Internal Server Error response)
            console.error(err);
            res.status(500).json({ error: err.message });
        } else {
            // Send a success response (e.g., 201 Created)
            res.status(201).json({ message: 'Entry added successfully', id: result.id });
        }
    });
});


app.put('/api/time-entries/:id', authenticateToken, (req, res) => {
    // console.log('Request body:', req.body); // Log the request body
    // console.log('Request params:', req.params); 
    const { id } = req.params;
    const { pid, client, department, project, counterparty, description, start_time, end_time } = req.body;

    const sql = `UPDATE time_entries SET 
                    pid = $1,
                    client = $2, 
                    department = $3, 
                    project = $4, 
                    counterparty = $5, 
                    description = $6,
                    start_time = $7, 
                    end_time = $8 
                 WHERE id = $9`;

    db.query(sql, [pid, client, department, project, counterparty, description, start_time, end_time, id])
        .then(result => {
            if (result.rowCount === 0) {
                res.status(404).json({ message: 'Entry not found' });
            } else {
                res.json({ message: 'Entry updated successfully', changes: result.rowCount });
            }
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({ error: err.message });
        });
});



app.delete('/api/time-entries/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM time_entries WHERE id = $1`;

    db.query(sql, [id])
        .then(result => {
            if (result.rowCount === 0) {
                res.status(404).json({ message: 'Entry not found' });
            } else {
                res.json({ message: 'Entry deleted successfully', changes: result.rowCount });
            }
        })
        .catch(err => {
            res.status(400).json({ error: err.message });
        });
});


app.get('/api/time-entries', authenticateToken, (req, res) => {
    const sql = `
        SELECT 
            id, 
            pid, 
            client, 
            department, 
            project, 
            counterparty, 
            description, 
            start_time, 
            end_time,
            TO_CHAR(end_time - start_time, 'HH24:MI') AS time_diff_hrs_mins,
            ROUND(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0, 2) AS time_diff_decimal
        FROM time_entries
        ORDER BY start_time DESC`;

    db.query(sql)
        .then(result => {
            const rows = result.rows;
            // Map the client values to their labels
            // Assuming clientsMap is defined and loaded elsewhere
            rows.forEach(row => {
                row.client = clientsMap[row.client] || row.client;
            });

            res.json({
                "success": true,
                "entries": rows
            });
        })
        .catch(err => {
            res.status(500).json({ error: err.message });
        });
});

app.get('/download-csv', authenticateToken, async (req, res) => {
    const sql = `
    SELECT 
        id, 
        pid, 
        client, 
        department, 
        project, 
        counterparty, 
        description, 
        start_time, 
        end_time,
        TO_CHAR(end_time - start_time, 'HH24:MI') AS time_diff_hrs_mins,
        ROUND(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0, 2) AS time_diff_decimal
    FROM time_entries
    ORDER BY start_time DESC`;

    db.query(sql)
        .then(data => {
            const formattedData = data.rows.map(row => ({
                ...row,
                start_time: moment(row.start_time).tz('Europe/Berlin').format('DD.MM.YYYY HH:mm:ss'),
                end_time: moment(row.end_time).tz('Europe/Berlin').format('DD.MM.YYYY HH:mm:ss'),
                client: clientsMap[row.client] // Apply counterpartyMap to row element counterparty
            }));
    
            const csvData = convertToCSV(formattedData);
            res.header('Content-Type', 'text/csv');
            res.attachment('data.csv');
            return res.send(csvData);
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({ error: err.message });
        });
});


app.post('/api/clients/data', authenticateToken, async (req, res) => {
    const { startDate, endDate, client } = req.body;

    // Convert startDate and endDate to the appropriate format if necessary
    // ...

    const sql = `
        SELECT 
        id, 
        pid, 
        client, 
        department, 
        project, 
        counterparty, 
        description, 
        start_time, 
        end_time,
        TO_CHAR(end_time - start_time, 'HH24:MI') AS time_diff_hrs_mins,
        ROUND(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0, 2) AS time_diff_decimal
        FROM time_entries 
        WHERE client = $1 
        AND start_time >= $2 
        AND end_time <= $3
        ORDER BY start_time`;

    const sqlSumSeconds = `
        SELECT
        SUM(EXTRACT(EPOCH FROM (end_time - start_time))) AS total_time_diff_seconds
        FROM time_entries 
        WHERE client = $1 
        AND start_time >= $2 
        AND end_time <= $3`;


    try {
        const result = await db.query(sql, [client, startDate, endDate]);
        const entries = result.rows.map(row => ({
            ...row,
            client: clientsMap[row.client] // Convert client label to value using clientsMap
        }));

        const resultSumSeconds = await db.query(sqlSumSeconds, [client, startDate, endDate]);
        const totalSeconds = resultSumSeconds.rows[0].total_time_diff_seconds;
    
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const totalHrsMins = `${hours}:${minutes.toString().padStart(2, '0')}`;

        const totalDecimalHours = (totalSeconds / 3600).toFixed(2);

        res.json({
            success: true,
            entries: entries,
            totalHrsMins: totalHrsMins,
            totalDecimalHours: totalDecimalHours
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



app.post('/api/clients/data/A', authenticateToken, async (req, res) => {
    const { startDate, endDate, client }  = req.body;

    // Convert startDate and endDate to the appropriate format if necessary
    // ...

    let result = await db.query(`SELECT DISTINCT department FROM time_entries WHERE client = $1`, [client]);
    const departments = result.rows.map(row => row.department);

    console.log('Departments:', departments);    

    const sql = `
        SELECT 
        id, 
        pid, 
        client, 
        department, 
        project, 
        counterparty, 
        description, 
        start_time, 
        end_time,
        TO_CHAR(end_time - start_time, 'HH24:MI') AS time_diff_hrs_mins,
        ROUND(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0, 2) AS time_diff_decimal
        FROM time_entries 
        WHERE client = $1
        AND department = $2
        AND start_time >= $3
        AND end_time <= $4
        ORDER BY start_time`;

    const sqlSumSeconds = `
        SELECT
        SUM(EXTRACT(EPOCH FROM (end_time - start_time))) AS total_time_diff_seconds
        FROM time_entries 
        WHERE client = $1 
        AND department = $2
        AND start_time >= $3 
        AND end_time <= $4`;

    const totalSumSeconds = `
        SELECT
        SUM(EXTRACT(EPOCH FROM (end_time - start_time))) AS total_time_diff_seconds
        FROM time_entries 
        WHERE client = $1 
        AND start_time >= $2 
        AND end_time <= $3`;


    // Create an empty array to store the entries
    let allEntries = [];
    let allDeptEntriesHrsMins = [];
    let allDeptDecimalEntriesHrsMins = [];
    let errorOccurred = null;


    // ...

    for (const department of departments) {
        try {
            const result = await db.query(sql, [client, department, startDate, endDate]);
            const entries = result.rows.map(row => ({
                ...row,
                client: clientsMap[row.client] // Convert client label to value using clientsMap
            }));
            allEntries = allEntries.concat([entries]);


            const resultSumSeconds = await db.query(sqlSumSeconds, [client, department, startDate, endDate]);
            const totalSeconds = resultSumSeconds.rows[0].total_time_diff_seconds;
    
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const totalHrsMins = `${hours}:${minutes.toString().padStart(2, '0')}`;

            const totalDecimalHours = (totalSeconds / 3600).toFixed(2);

            allDeptEntriesHrsMins = allDeptEntriesHrsMins.concat([totalHrsMins]);
            allDeptDecimalEntriesHrsMins = allDeptDecimalEntriesHrsMins.concat([totalDecimalHours]);

            // ...
        } catch (err) {
            errorOccurred = err
            break;
        }
    }

    const resultSumSeconds = await db.query(totalSumSeconds, [client, startDate, endDate]);
    const totalSeconds = resultSumSeconds.rows[0].total_time_diff_seconds;

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const totalHrsMins = `${hours}:${minutes.toString().padStart(2, '0')}`;

    const totalDecimalHours = (totalSeconds / 3600).toFixed(2);

    if (errorOccurred) {
        res.status(500).json({ error: errorOccurred.message });
    } else {
        res.json({
            success: true,
            entries: allEntries,
            deptHrsMins: allDeptEntriesHrsMins,
            deptDecHrsMins: allDeptDecimalEntriesHrsMins,
            totalHrsMins: totalHrsMins,
            totalDecHrsMins: totalDecimalHours,
            client: clientsMap[client]
        });

    }

});
  


app.post('/api/clients/data/B', authenticateToken, async (req, res) => {
    const { startDate, endDate, client }  = req.body;


    let result = await db.query(`SELECT DISTINCT department FROM time_entries WHERE client = $1`, [client]);
    const departments = result.rows.map(row => row.department);


    const sqlProjects = `
        SELECT DISTINCT
        project
        FROM time_entries 
        WHERE client = $1
        AND department = $2
        AND start_time >= $3
        AND end_time <= $4
        ORDER BY project`;

    let departmentProjects = {};
    let errorOccurred = null;

    for (const department of departments) {
        try {
            const resultProjects = await db.query(sqlProjects, [client, department, startDate, endDate]);
            const projects = resultProjects.rows.map(row => row.project);
            departmentProjects[department] = projects;

            // ...
        } catch (err) {
            errorOccurred = err
            break;
        }
    }

    const sql = `
        SELECT 
        id, 
        pid, 
        client, 
        department, 
        project, 
        counterparty, 
        description, 
        start_time, 
        end_time,
        TO_CHAR(end_time - start_time, 'HH24:MI') AS time_diff_hrs_mins,
        ROUND(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0, 2) AS time_diff_decimal
        FROM time_entries 
        WHERE client = $1
        AND department = $2
        AND project = $3
        AND start_time >= $4
        AND end_time <= $5
        ORDER BY counterparty, start_time`;

    const sqlProjectSeconds = `
        SELECT
        SUM(EXTRACT(EPOCH FROM (end_time - start_time))) AS total_time_diff_seconds
        FROM time_entries 
        WHERE client = $1 
        AND department = $2
        AND project = $3
        AND start_time >= $4 
        AND end_time <= $5`;

    const sqlDeptSeconds = `
        SELECT
        SUM(EXTRACT(EPOCH FROM (end_time - start_time))) AS total_time_diff_seconds
        FROM time_entries 
        WHERE client = $1 
        AND department = $2
        AND start_time >= $3 
        AND end_time <= $4`;

    const totalSumSeconds = `
        SELECT
        SUM(EXTRACT(EPOCH FROM (end_time - start_time))) AS total_time_diff_seconds
        FROM time_entries 
        WHERE client = $1 
        AND start_time >= $2 
        AND end_time <= $3`;


    // Create an empty array to store the entries
    let allEntries = [];
    let allProjectEntriesHrsMins = [];
    let allProjectDecimalEntriesHrsMins = [];
    let allDeptEntriesHrsMins = [];
    let allDeptDecimalEntriesHrsMins = [];
    errorOccurred = null;


    // ...

    let deptProjectEntries = {};

    for (const department of departments) {
        let projects = departmentProjects[department];
        if (!deptProjectEntries[department]) {
            deptProjectEntries[department] = {};
        }
        for (const project of projects) {

            try {
                const result = await db.query(sql, [client, department, project, startDate, endDate]);
                const entries = result.rows.map(row => ({
                    ...row,
                    client: clientsMap[row.client] // Convert client label to value using clientsMap
                }));
                allEntries = allEntries.concat([entries]);

                if (!deptProjectEntries[department][project]) {
                    deptProjectEntries[department][project] = [];
                }
                
                deptProjectEntries[department][project] = deptProjectEntries[department][project].concat([entries]);


                const resultSumSeconds = await db.query(sqlProjectSeconds, [client, department, project, startDate, endDate]);
                const totalSeconds = resultSumSeconds.rows[0].total_time_diff_seconds;
        
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const totalHrsMins = `${hours}:${minutes.toString().padStart(2, '0')}`;

                const totalDecimalHours = (totalSeconds / 3600).toFixed(2);

                allProjectEntriesHrsMins = allProjectEntriesHrsMins.concat([totalHrsMins]);
                allProjectDecimalEntriesHrsMins = allProjectDecimalEntriesHrsMins.concat([totalDecimalHours]);

                // ...
            } catch (err) {
                errorOccurred = err
                break;
            }
        }

        try {
            // Sum up all projects for the department
            const resultSumSeconds = await db.query(sqlDeptSeconds, [client, department, startDate, endDate]);
            const totalSeconds = resultSumSeconds.rows[0].total_time_diff_seconds;
    
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const totalHrsMins = `${hours}:${minutes.toString().padStart(2, '0')}`;

            const totalDecimalHours = (totalSeconds / 3600).toFixed(2);

            allDeptEntriesHrsMins = allDeptEntriesHrsMins.concat([totalHrsMins]);
            allDeptDecimalEntriesHrsMins = allDeptDecimalEntriesHrsMins.concat([totalDecimalHours]);

            // ...
        } catch (err) {
            errorOccurred = err
            break;
        }



    }

    const resultSumSeconds = await db.query(totalSumSeconds, [client, startDate, endDate]);
    const totalSeconds = resultSumSeconds.rows[0].total_time_diff_seconds;

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const totalHrsMins = `${hours}:${minutes.toString().padStart(2, '0')}`;

    const totalDecimalHours = (totalSeconds / 3600).toFixed(2);

    if (errorOccurred) {
        res.status(500).json({ error: errorOccurred.message });
    } else {
        res.json({
            success: true,
            entries: allEntries,
            deptProjectEntries: deptProjectEntries,
            projHrsMins: allProjectEntriesHrsMins,
            projDecHrsMins: allProjectDecimalEntriesHrsMins,
            deptHrsMins: allDeptEntriesHrsMins,
            deptDecHrsMins: allDeptDecimalEntriesHrsMins,
            totalHrsMins: totalHrsMins,
            totalDecHrsMins: totalDecimalHours,
            client: clientsMap[client]
        });

    }

});


app.post('/api/clients/data/AnnexTable', authenticateToken, async (req, res) => {
    const { startDate, endDate, client }  = req.body;


    const sql = `
    SELECT DISTINCT project
    FROM time_entries
    WHERE client = $1
    AND start_time >= $2
    AND end_time <= $3
    ORDER BY project;
    `;

    let result = await db.query(sql, [client, startDate, endDate]);

    const sqlProjectTimes = `
    SELECT
    project,
    counterparty,
    SUM(EXTRACT(EPOCH FROM (end_time - start_time))) AS total_time_diff
    FROM time_entries
    WHERE client = $1
    AND project = $2
    AND start_time >= $3
    AND end_time <= $4
    GROUP BY project, counterparty
    ORDER BY project, counterparty;
    `;

    let projectTimes = {};
    let errorOccurred = null;
    
    for (const project of ['EFET', 'MSPA']) {
        console.log(project)
        try {
            const resultTimes = await db.query(sqlProjectTimes, [client, project, startDate, endDate]);
            const times = resultTimes.rows.map(row => row);
            console.log(times)
            
            projectTimes[project] = times.map(row => {
                    const totalSeconds = row.total_time_diff;
                    const hours = Math.floor(totalSeconds / 3600);
                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                    const totalHrsMins = `${hours}:${minutes.toString().padStart(2, '0')}`;
                    return { ...row, total_time_diff: totalHrsMins };
            });

            // const PORT = process.env.PORT || 3000;
            // app.listen(PORT, () => {
            //     console.log(`Server is running on port ${PORT}`);
            // });
            // console.log(times)
            // projectTimes[project.project] = times;

            // ...
        } catch (err) {
            errorOccurred = err
            break;
        }
    }   

    console.log(projectTimes);

    if (errorOccurred) {
        res.status(500).json({ error: errorOccurred.message });
    } else {
        res.json({
            success: true,
            client: clientsMap[client],
            startDate: startDate,
            endDate: endDate,
            projectTimes: projectTimes,
            // deptProjectEntries: deptProjectEntries,
            // projHrsMins: allProjectEntriesHrsMins,
            // projDecHrsMins: allProjectDecimalEntriesHrsMins,
            // deptHrsMins: allDeptEntriesHrsMins,
            // deptDecHrsMins: allDeptDecimalEntriesHrsMins,
            // totalHrsMins: totalHrsMins,
            // totalDecHrsMins: totalDecimalHours
        });

    }


});
  

app.post('/api/clients/data/C', authenticateToken, async (req, res) => {
    const { startDate, endDate, client }  = req.body;

    // Convert startDate and endDate to the appropriate format if necessary
    // ...

    let result = await db.query(`SELECT DISTINCT department FROM time_entries WHERE client = $1`, [client]);
    const departments = result.rows.map(row => row.department);

    console.log('Departments:', departments);    

    const sql = `
        SELECT 
        id, 
        pid, 
        client, 
        department, 
        project, 
        counterparty, 
        description, 
        start_time, 
        end_time,
        TO_CHAR(end_time - start_time, 'HH24:MI') AS time_diff_hrs_mins,
        ROUND(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0, 2) AS time_diff_decimal
        FROM time_entries 
        WHERE client = $1
        AND department = $2
        AND start_time >= $3
        AND end_time <= $4
        ORDER BY start_time`;

    const sqlSumSeconds = `
        SELECT
        SUM(EXTRACT(EPOCH FROM (end_time - start_time))) AS total_time_diff_seconds
        FROM time_entries 
        WHERE client = $1 
        AND department = $2
        AND start_time >= $3 
        AND end_time <= $4`;

    const totalSumSeconds = `
        SELECT
        SUM(EXTRACT(EPOCH FROM (end_time - start_time))) AS total_time_diff_seconds
        FROM time_entries 
        WHERE client = $1 
        AND start_time >= $2 
        AND end_time <= $3`;


    // Create an empty array to store the entries
    let allEntries = [];
    let allDeptEntriesHrsMins = [];
    let allDeptDecimalEntriesHrsMins = [];
    let errorOccurred = null;


    // ...

    for (const department of departments) {
        try {
            const result = await db.query(sql, [client, department, startDate, endDate]);
            const entries = result.rows.map(row => ({
                ...row,
                client: clientsMap[row.client] // Convert client label to value using clientsMap
            }));
            allEntries = allEntries.concat([entries]);


            const resultSumSeconds = await db.query(sqlSumSeconds, [client, department, startDate, endDate]);
            const totalSeconds = resultSumSeconds.rows[0].total_time_diff_seconds;
    
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const totalHrsMins = `${hours}:${minutes.toString().padStart(2, '0')}`;

            const totalDecimalHours = (totalSeconds / 3600).toFixed(2);

            allDeptEntriesHrsMins = allDeptEntriesHrsMins.concat([totalHrsMins]);
            allDeptDecimalEntriesHrsMins = allDeptDecimalEntriesHrsMins.concat([totalDecimalHours]);

            // ...
        } catch (err) {
            errorOccurred = err
            break;
        }
    }

    const resultSumSeconds = await db.query(totalSumSeconds, [client, startDate, endDate]);
    const totalSeconds = resultSumSeconds.rows[0].total_time_diff_seconds;

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const totalHrsMins = `${hours}:${minutes.toString().padStart(2, '0')}`;

    const totalDecimalHours = (totalSeconds / 3600).toFixed(2);

    if (errorOccurred) {
        res.status(500).json({ error: errorOccurred.message });
    } else {
        res.json({
            success: true,
            entries: allEntries,
            deptHrsMins: allDeptEntriesHrsMins,
            deptDecHrsMins: allDeptDecimalEntriesHrsMins,
            totalHrsMins: totalHrsMins,
            totalDecHrsMins: totalDecimalHours,
            client: clientsMap[client]
        });

    }

});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

