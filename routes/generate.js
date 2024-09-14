const express = require('express');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
const path = require('path'); 
const fs = require('fs');
const router = express.Router();


const clientsFilePath = path.resolve(__dirname, '../data/clients.json');
const counterpartiesFilePath = path.resolve(__dirname, '../data/counterparties.json');
const departmentsFilePath = path.resolve(__dirname, '../data/departments.json');
const projectsFilePath = path.resolve(__dirname, '../data/projects.json');


router.get('/clients', authenticateToken, (req, res) => {
    // Fetch or compute the clients data
    // const fs = require('fs');
    fs.readFile(clientsFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('An error occurred')
        }
        const clientsData = JSON.parse(data);
        res.json(clientsData);
    });
});

router.get('/departments/:client', authenticateToken, (req, res) => {
    // Fetch or compute the clients data
    // const fs = require('fs');
    fs.readFile(departmentsFilePath, 'utf8', (err, data) => {
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

router.get('/projects/:client', authenticateToken, (req, res) => {
    // Fetch or compute the clients data
    // const fs = require('fs');
    fs.readFile(projectsFilePath, 'utf8', (err, data) => {
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

router.get('/counterparties', authenticateToken, (req, res) => {
    // Fetch or compute the clients data
    // const fs = require('fs');
    fs.readFile(counterpartiesFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('An error occurred')
        }
        let counterpartiesData = JSON.parse(data);

        res.json(counterpartiesData);
    });
});

module.exports = router;
