const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const { Pool } = require('pg');
const moment = require('moment-timezone');
const { Parser } = require('json2csv');


// const db = new Pool({
//     connectionString: process.env.DATABASE_URL,
//     ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
// });



// for local development
const db = new Pool({
    user: '', // your PostgreSQL username, e.g., 'postgres'
    host: 'localhost',
    database: 'legaldb',
    password: '', // leave empty if no password is set
    port: 5432, // default PostgreSQL port
});



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

        res.json(counterpartiesData);
    });
});


app.post('/api/add-entry', (req, res) => {
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


app.put('/api/time-entries/:id', (req, res) => {
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

app.get('/download-csv', async (req, res) => {
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


app.post('/api/clients/data', async (req, res) => {
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



app.post('/api/clients/data/A', async (req, res) => {
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
  


app.post('/api/clients/data/B', async (req, res) => {
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


app.post('/api/clients/data/AnnexTable', async (req, res) => {
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
  


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

