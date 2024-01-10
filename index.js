const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();


// if (process.env.NODE_ENV === 'production') {
//     app.use(express.static(path.join(__dirname, '../client/build')));
//     app.get('*', (req, res) => {
//         res.sendFile(path.resolve(__dirname, '../client', 'build', 'index.html'));
//     });
// }


const cors = require('cors');
const corsOptions = {
    origin: '*',
}
app.use(cors(corsOptions));
const dbPath = 'data/legalttracker.sqlite';
// const dbPath = new URL(process.env.DATABASE_URL).pathname;




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

console.log('Hello World Casper!');


// const db = new sqlite3.Database(new URL(process.env.DATABASE_URL).pathname, (err) => {
//     if (err) {
//         console.error(err.message);
//     } else {
//         console.log('Connected to the SQLite database.');
//         initDb(); // Call the function to initialize the database
//     }
// });
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb(); // Call the function to initialize the database
    }
});

function addTimeEntry(pid, client, department, project, counterparty, description, start_time, end_time, callback) {
    const sql = `INSERT INTO time_entries (pid, client, department, project, counterparty, description, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
    db.run(sql, [pid, client, department, project, counterparty, description, start_time, end_time], function(err) {
        callback(err, { id: this.lastID });
    });
}




function initDb() {
    // Database table creation logic
    // Example: Creating a 'clients' table
    db.run(`CREATE TABLE IF NOT EXISTS time_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pid TEXT NOT NULL,
        client TEXT NOT NULL,
        department TEXT NOT NULL,
        project TEXT NOT NULL,
        counterparty TEXT,
        description TEXT,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL
    );`, (err) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log("Table 'time_entries' created or already exists.");
        }
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
                    pid = ?,
                    client = ?, 
                    department = ?, 
                    project = ?, 
                    counterparty = ?, 
                    description = ?,
                    start_time = ?, 
                    end_time = ? 
                 WHERE id = ?`;

    db.run(sql, [pid, client, department, project, counterparty, description, start_time, end_time, id], function(err) {
        if (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ message: 'Entry not found' });
        } else {
            res.json({ message: 'Entry updated successfully', changes: this.changes });
        }
    });
});


app.delete('/api/time-entries/:id', (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM time_entries WHERE id = ?`;

    db.run(sql, id, function(err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ message: 'Entry not found' });
        } else {
            res.json({ message: 'Entry deleted successfully', changes: this.changes });
        }
    });
});


// app.get('/api/time-entries', (req, res) => {
//     const sql = "SELECT * FROM time_entries";

//     db.all(sql, [], (err, rows) => {
//         if (err) {
//             res.status(500).json({ error: err.message });
//             return;
//         }
//         res.json({
//             "success": true,
//             "entries": rows
//         });
//     });
// });

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
            strftime('%H:%M', (julianday(end_time) - julianday(start_time)) * 86400.0, 'unixepoch') AS time_diff_hrs_mins,
            ROUND((julianday(end_time) - julianday(start_time)) * 24.0, 2) AS time_diff_decimal
        FROM time_entries
        ORDER BY start_time DESC`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // // Load the clients JSON file


        // Map the client values to their labels
        rows.forEach(row => {
            row.client = clientsMap[row.client] || row.client;
        });

        res.json({
            "success": true,
            "entries": rows
        });
                    
    });

});





const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

