const express = require('express');
const db = require('../config/database');
const fs = require('fs');
const path = require('path'); 
const { authenticateToken } = require('../middleware/auth');
const { addTimeEntry } = require('../services/timeEntries');

const router = express.Router();
const clientsFilePath = path.resolve(__dirname, '../data/clients.json');

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

router.post('/add-entry', authenticateToken, (req, res) => {
    const { pid, client, department, project, counterparty, description, start_time, end_time } = req.body;
    addTimeEntry(pid, client, department, project, counterparty, description, start_time, end_time, (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.status(201).json({ message: 'Entry added successfully', id: result.id });
        }
    });
});


router.put('/time-entries/:id', authenticateToken, (req, res) => {
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



router.delete('/time-entries/:id', authenticateToken, (req, res) => {
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


router.get('/time-entries', authenticateToken, (req, res) => {
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






module.exports = router;
