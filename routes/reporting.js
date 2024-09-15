const express = require('express');
const db = require('../config/database');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path'); 
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
const moment = require('moment');
const router = express.Router();

const clientsFilePath = path.resolve(__dirname, '../data/clients.json');
const counterpartiesFilePath = path.resolve(__dirname, '../data/counterparties.json');
const departmentsFilePath = path.resolve(__dirname, '../data/departments.json');
const projectsFilePath = path.resolve(__dirname, '../data/projects.json');


// Function to convert data to CSV and adjust timezone
function convertToCSV(data) {
    // Convert data to CSV format and adjust timezone
    const parser = new Parser();
    const csv = parser.parse(data);
    return csv;
    // Use moment-timezone to convert times to 'Europe/Berlin'
    // Return CSV formatted string
}

let clientsMap = {};

// Load the clients JSON file when the server starts
fs.readFile(clientsFilePath, 'utf8', (err, data) => {
    if (err) {
        console.error(err);
        return;
    }

    let clientsData = JSON.parse(data);
    clientsData.forEach(client => {
        clientsMap[client.value] = client.label;
    });
});



router.get('/download-csv', authenticateToken, async (req, res) => {
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


router.post('/clients/data', authenticateToken, async (req, res) => {
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


router.post('/clients/data/A', authenticateToken, async (req, res) => {
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
  


router.post('/clients/data/B', authenticateToken, async (req, res) => {
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


router.post('/clients/data/AnnexTable', authenticateToken, async (req, res) => {
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



router.post('/clients/data/C', authenticateToken, async (req, res) => {
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


module.exports = router;