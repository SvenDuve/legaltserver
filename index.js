const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

dotenv.config();

// intialize express app
const app = express();

// pull routes
const authRoutes = require('./routes/auth');
const entriesRoutes = require('./routes/entries');
const generateRoutes = require('./routes/generate');
const reportingRoutes = require('./routes/reporting');
// pull dbase
db = require('./config/database');

// pull functions
const { initDb, seedAdminUser, checkTimezone } = require('./services/dbaseSetup');



app.use(helmet());

// Cors options
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' ? 'https://legaltclient.fly.dev' : '*',
    optionsSuccessStatus: 200,
    credentials: true, // Allow credentials if using cookies
};

app.use(cors(corsOptions));


// Rate Limiting to prevent brute-force attacks
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use('/api/', apiLimiter);
app.use(express.json()); // for parsing application/json


app.use('/api/auth', authRoutes);
app.use('/api/entries', entriesRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/reporting', reportingRoutes);


// const { Pool } = require('pg');
const moment = require('moment-timezone');


const { Parser } = require('json2csv');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');

// potentially unused
const { format } = require('path');
const { body, validationResult } = require('express-validator');



initDb();
seedAdminUser();
checkTimezone();


app.get('/', (req, res) => {

    res.send('Hello Sven, Paul, Emma und Mama, spielt ihr heute Doppelkopf?');

});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


// Gracefully handle shutdown on SIGINT or SIGTERM
const gracefulShutdown = () => {
    console.log('Shutting down gracefully...');
    server.close(() => {
      console.log('Closed out remaining connections');
      process.exit(0);
    });
  
    // If after 10 seconds, force shutdown
    setTimeout(() => {
      console.error('Forcing server shutdown');
      process.exit(1);
    }, 10000);
  };
  
  // Listen for termination signals
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

