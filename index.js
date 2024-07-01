const express = require("express");
const mysql = require("mysql2");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const nodemailer = require('nodemailer');
const uuid = require('uuid');
const cron = require('node-cron');
const PORT = process.env.PORT || 8080;
const axios = require('axios');
const stripe = require('stripe')('sk_test_51LoS3iSGyKMMAZwstPlmLCEi1eBUy7MsjYxiKsD1lT31LQwvPZYPvqCdfgH9xl8KgeJoVn6EVPMgnMRsFInhnnnb00WhKhMOq7');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const QRCode = require('qrcode');
const fs = require('fs');
const cheerio = require('cheerio');


// URL Constants
const BASE_URL = 'https://b6fc791aa51cdc4cb2047b4ffdf0773c.serveo.net';
const SUCCESS_URL = `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}&sender_id=`;
const CANCEL_URL = `${BASE_URL}/cancel`;
const TICKET_URL = `${BASE_URL}/tickets/`;
const DOCUMENT_URL = `${BASE_URL}/documents/`;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use(session({
  key: "userId",
  secret: "Englishps4",
  resave: false,
  saveUninitialized: false,
  cookie: {
    expires: 60 * 60 * 24 * 12,
  },
}));

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "DELETE", "PUT"],
  credentials: true,
}));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

const connection = mysql.createPool({
  connectionLimit: 10, // Maximum number of connections in the pool
  host: "localhost",
  user: "root",
  password: "Englishps#4",
  database: "chromeextension",
});

connection.getConnection((err) => {
  if (err) {
    console.error("Error connecting to MySQL database: ", err);
  } else {
    console.log("Connected to MySQL database");
  }
});



// GET endpoint for testing
app.get('/', (req, res) => {
  res.send('Welcome!');
});
// Get all to-do items
app.get('/todos', (req, res) => {
  connection.query('SELECT * FROM todos', (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

// Add a new to-do item
app.post('/todos', (req, res) => {
  const { task } = req.body;
  connection.query('INSERT INTO todos (task) VALUES (?)', [task], (err, result) => {
    if (err) throw err;
    res.json({ id: result.insertId, task, completed: false });
  });
});

// Update a to-do item
app.put('/todos/:id', (req, res) => {
  const { id } = req.params;
  const { task, completed } = req.body;
  connection.query('UPDATE todos SET task = ?, completed = ? WHERE id = ?', [task, completed, id], (err) => {
    if (err) throw err;
    res.json({ id, task, completed });
  });
});

// Delete a to-do item
app.delete('/todos/:id', (req, res) => {
  const { id } = req.params;
  connection.query('DELETE FROM todos WHERE id = ?', [id], (err) => {
    if (err) throw err;
    res.json({ message: 'To-do item deleted' });
  });
});

// Endpoint to handle POST requests for storing notes
app.post('/api/notes', (req, res) => {
  const noteText = req.body.note;

  // Insert note into MySQL
  const sql = 'INSERT INTO notes (note) VALUES (?)';
  connection.query(sql, [noteText], (err, result) => {
    if (err) {
      console.error('Error inserting note:', err);
      res.status(500).json({ message: 'Error storing note' });
      return;
    }

    console.log('Note stored successfully:', result.insertId);
    res.status(200).json({ message: 'Note taken!', noteId: result.insertId });
  });
});

// Endpoint to handle GET requests for fetching notes
app.get('/api/notes', (req, res) => {
  // Fetch all notes from MySQL
  const sql = 'SELECT * FROM notes';
  connection.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching notes:', err);
      res.status(500).json({ message: 'Error fetching notes' });
      return;
    }

    console.log('Notes fetched successfully');
    res.status(200).json({ notes: results });
  });
});


// Enhanced chatbot response generation
const generateResponse = (message) => {
  const lowerCaseMessage = message.toLowerCase().trim();

  // Handle opening websites
  const decideSiteUrl = (siteName) => {
    const normalizedSiteName = siteName.toLowerCase();
  
    switch (normalizedSiteName) {
      case 'youtube':
        return 'https://www.youtube.com';
      case 'google':
        return 'https://www.google.com';
      case 'instagram':
        return 'https://www.instagram.com';
      default:
        if (normalizedSiteName.endsWith('.com') || normalizedSiteName.endsWith('.org') || normalizedSiteName.endsWith('.net')) {
          return `https://www.${siteName}`;
        } else {
          return `https://www.${normalizedSiteName}.com`;
        }
    }
  };
  if (lowerCaseMessage.startsWith('open ')) {
    const siteName = lowerCaseMessage.substring(5).trim();
    const siteUrl = decideSiteUrl(siteName);

    if (siteUrl) {
      return `Opening ${siteUrl}`;
    } else {
      return `Sorry, I couldn't understand the site name.`;
    }
  }

  // Handle setting reminders
  if (lowerCaseMessage.startsWith('remind me to')) {
    const reminderMessage = lowerCaseMessage.substring(12).trim();
    return `Reminder set: ${reminderMessage}`;
  }

  // Handle stopping reminders
  if (lowerCaseMessage.includes('stop') && lowerCaseMessage.includes('reminders')) {
    return 'All reminders stopped.';
  }

  // Handle showing to-do list
  if (lowerCaseMessage.includes('show') && lowerCaseMessage.includes('to-do list')) {
    return 'Fetching your to-do list...';
  }

 // Handle adding to the to-do list
 if (lowerCaseMessage.includes('add') && lowerCaseMessage.includes('to') && lowerCaseMessage.includes('to-do list')) {
  const task = lowerCaseMessage.split('to-do list')[1].trim();
  return `Adding to your to-do list: ${task}`;
}

// Handle directly adding task to the to-do list
if (lowerCaseMessage.includes(' to my to-do list')) {
  const task = lowerCaseMessage.replace(' to my to-do list', '').trim();
  return `Adding to your to-do list: ${task}`;
}

  // Handle removing from the to-do list
  if (lowerCaseMessage.includes('remove') && lowerCaseMessage.includes('from') && lowerCaseMessage.includes('to-do list')) {
    const taskId = lowerCaseMessage.split('to-do list')[1].trim();
    return `Removing item from your to-do list with ID: ${taskId}`;
  }

  // Handle directly adding task to the to-do list
  if (lowerCaseMessage.includes(' to my to-do list')) {
    const task = lowerCaseMessage.replace(' to my to-do list', '').trim();
    return `Adding to your to-do list: ${task}`;
  }

  // Handle math problems
  if (lowerCaseMessage.includes('solve math problems')) {
    return 'Sure! Please provide me with a math problem.';
  }

  // Handle solving math problems
  if (lowerCaseMessage.startsWith('solve ') || lowerCaseMessage.startsWith('calculate ')) {
    try {
      const problem = lowerCaseMessage.replace('solve', '').replace('calculate', '').trim();
      const result = eval(problem); // Use eval cautiously; consider implementing a safer expression parser

      return `The result of ${problem} is ${result}`;
    } catch (error) {
      console.error('Error solving math problem:', error);
      return 'Sorry, I couldn\'t solve that math problem.';
    }
  }

  // Handle unit conversion
  if (lowerCaseMessage.startsWith('convert ') || lowerCaseMessage.startsWith('conversion of ')) {
    let conversionDetails = lowerCaseMessage.replace('convert', '').replace('conversion of', '').trim();

    // Detect the type of conversion
    let conversionType;
    if (conversionDetails.includes('kg to grams')) {
      conversionType = 'weight';
      conversionDetails = conversionDetails.replace('kg to grams', '').trim();
    } else if (conversionDetails.includes('feet to inches')) {
      conversionType = 'distance';
      conversionDetails = conversionDetails.replace('feet to inches', '').trim();
    }
    // Add more conversions as needed (e.g., temperature)

    if (conversionType) {
      // Perform the conversion based on the detected type
      const conversionResult = convertUnits(conversionType, conversionDetails);
      if (conversionResult !== null) {
        return `Converted: ${conversionResult}`;
      } else {
        return 'Sorry, I couldn\'t understand the conversion request.';
      }
    } else {
      return 'Sorry, I couldn\'t understand the conversion request.';
    }
  }

  

  // Default responses (existing functionality)
  const responses = {
    hi: `Hi there! How can I assist you today?`,
    hello: `Hello! How can I help you?`,
    hey: `Hey! What can I do for you?`,
    howdy: `Howdy! What's on your mind?`,
    default: `Nice to meet you! How can I assist?`
  };

  for (const key in responses) {
    if (lowerCaseMessage.includes(key)) {
      return responses[key];
    }
  }

  return responses.default;
};

// Example conversion functions for weight and distance
const convertUnits = (conversionType, conversionDetails) => {
  let value, fromUnit, toUnit;

  switch (conversionType) {
    case 'weight':
      value = parseFloat(conversionDetails);
      fromUnit = 'kg';
      toUnit = 'grams';
      return convertWeight(value, fromUnit, toUnit);
    case 'distance':
      value = parseFloat(conversionDetails);
      fromUnit = 'feet';
      toUnit = 'inches';
      return convertDistance(value, fromUnit, toUnit);
    // Add more cases for other types of conversions (e.g., temperature)
    default:
      return null;
  }
};

// Example conversion functions for weight and distance
const convertWeight = (value, fromUnit, toUnit) => {
  let result;
  switch (`${fromUnit}-${toUnit}`) {
    case 'kg-grams':
      result = value * 1000;
      break;
    // Add more conversions as needed
    default:
      result = null;
  }
  return result !== null ? result.toFixed(2) : null;
};

const convertDistance = (value, fromUnit, toUnit) => {
  let result;
  switch (`${fromUnit}-${toUnit}`) {
    case 'feet-inches':
      result = value * 12;
      break;
    // Add more conversions as needed
    default:
      result = null;
  }
  return result !== null ? result.toFixed(2) : null;
};

app.post('/send-message', (req, res) => {
  const { message } = req.body;
  const responseMessage = generateResponse(message);

  console.log('Received message:', message);
  console.log('Generated response:', responseMessage);

  res.json({ message: responseMessage });
});


// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});