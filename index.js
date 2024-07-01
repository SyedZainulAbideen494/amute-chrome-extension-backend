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
const PORT = process.env.PORT || 8080;
const axios = require('axios');
const cheerio = require('cheerio');
const querystring = require('querystring'); // Include the querystring module

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

app.get('/auth/spotify/token', async (req, res) => {
  try {
    // Use your Spotify app client ID and client secret
    const clientId = '0aac6cb1ec104103a5e2e5d6f9b490e7';
    const clientSecret = '4e2d9a5a3be9406c970cf3f6cb78b7a3';

    // Base64 encode client ID and client secret as required by Spotify
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    // Request parameters for Spotify token endpoint
    const params = new URLSearchParams({
      grant_type: 'client_credentials'
    });

    // Spotify token endpoint URL
    const tokenEndpoint = 'https://accounts.spotify.com/api/token';

    // Make a POST request to Spotify token endpoint
    const response = await axios.post(tokenEndpoint, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}` // Corrected the interpolation syntax
      }
    });

    // Send back the access token in the response
    res.send({ access_token: response.data.access_token });
  } catch (error) {
    console.error('Error fetching Spotify token:', error);
    res.status(500).send('Failed to fetch Spotify access token');
  }
});

// Function to fetch data from Wikipedia API
async function fetchInfoFromWikipedia(query) {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    const response = await axios.get(url);
    const { data } = response;

    if (data.type && data.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') {
      console.log(`Page not found for ${query}`);
      return null; // Return null if page not found
    } else {
      return data.extract; // Return the extracted summary
    }
  } catch (error) {
    console.error('Error fetching data:', error.message);
    throw error; // Throw the error for handling in calling function
  }
}
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
  

   // Handle playing a song
   if (lowerCaseMessage.startsWith('play ')) {
    const songRequest = lowerCaseMessage.substring(5).trim();
    if (songRequest.includes('by')) {
      const [song, artist] = songRequest.split(' by ');
      return `Play a song by ${song.trim()} by ${artist.trim()}`;
    }
    return `Sorry, I need both the song and artist to play a song.`;
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

app.post('/send-message', async (req, res) => {
  const { message } = req.body;

  try {
    let responseMessage = '';

    // Check if the message matches "what is (thing)" or "who is (person)"
    const lowerCaseMessage = message.toLowerCase().trim();
    if (lowerCaseMessage.startsWith('what is ') || lowerCaseMessage.startsWith('who is ')) {
      const searchTerm = lowerCaseMessage.replace('what is ', '').replace('who is ', '').trim();
      
      // Fetch information from Wikipedia using fetchInfoFromWikipedia function
      responseMessage = await fetchInfoFromWikipedia(searchTerm);
    } else {
      // Generate response using generateResponse function
      responseMessage = generateResponse(message);
    }

    // Log received and generated messages
    console.log('Received message:', message);
    console.log('Generated response:', responseMessage);
    
    // Send the response back to the client
    res.json({ message: responseMessage });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

