const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const { Pool } = require('pg');
const moment = require('moment-timezone');


// Function to append timezone to connection string
function appendTimezone(connectionString, timezone) {
    return connectionString.includes('?') ? 
        `${connectionString}&timezone='${encodeURIComponent(timezone)}'` : 
        `${connectionString}?timezone='${encodeURIComponent(timezone)}'`;
}


const connectionStringWithTimezone = appendTimezone(process.env.DATABASE_URL, 'Europe/Berlin');

const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});



// // for local development
// const db = new Pool({
//     user: '', // your PostgreSQL username, e.g., 'postgres'
//     host: 'localhost',
//     database: 'legaldb',
//     password: '', // leave empty if no password is set
//     port: 5432, // default PostgreSQL port
// });


const cors = require('cors');
const corsOptions = {
    origin: '*',
}
app.use(cors(corsOptions));


const fs = require('fs');

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



function initDb() {
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

    db.query(createTableQuery)
        .then(() => {
            console.log("Table 'time_entries' created or already exists.");
        })
        .catch(err => {
            console.error(err.message);
        });
}



initDb();

app.use(express.json()); // for parsing application/json



app.get('/', (req, res) => {

    res.send('Hello Sven, Paul, Emma und Mama, spielt ihr heute Doppelkopf?');

});

app.get('/api/clients', (req, res) => {
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

app.get('/api/departments/:client', (req, res) => {
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

app.get('/api/projects/:client', (req, res) => {
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

app.get('/api/counterparties', (req, res) => {
    // Fetch or compute the clients data
    // const fs = require('fs');
    fs.readFile('data/counterparties.json', 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('An error occurred')
        }
        let counterpartiesData = JSON.parse(data);
        // Sort the data alphabetically by label
        counterpartiesData.sort((a, b) => {
            if (a.label.toLowerCase() < b.label.toLowerCase()) return -1;
            if (a.label.toLowerCase() > b.label.toLowerCase()) return 1;
            return 0;
        });

        res.json(counterpartiesData);
    });
});


app.post('/api/add-entry', (req, res) => {
    const { pid, client, department, project, counterparty, description, start_time, end_time } = req.body;
    console.log('Request body:', req.body); // Log the request body
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


app.put('/api/time-entries/:id', (req, res) => {
    console.log('Request body:', req.body); // Log the request body
    console.log('Request params:', req.params); 
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



app.delete('/api/time-entries/:id', (req, res) => {
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


app.get('/api/time-entries', (req, res) => {
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
            console.log(rows)
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



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

