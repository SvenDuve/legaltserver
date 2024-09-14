const moment = require('moment-timezone');
const db = require('../config/database');

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

module.exports = { addTimeEntry };
