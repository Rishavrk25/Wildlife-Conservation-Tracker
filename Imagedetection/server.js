const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 3000;

// Configure upload folder
const UPLOAD_FOLDER = 'uploads';
if (!fs.existsSync(UPLOAD_FOLDER)) {
    fs.mkdirSync(UPLOAD_FOLDER);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_FOLDER);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Imagga API credentials
const API_KEY = 'acc_1ee415b0061eac4';
const API_SECRET = '9e10e9fbfc0f98d1c79988725aaf85f0';

// Initialize SQLite database
const db = new sqlite3.Database('./wildlife_sightings.db', (err) => {
    if (err) {
        console.error('Error opening database', err);
    } else {
        console.log('Connected to the SQLite database.');
        // Create table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS sightings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            animal_name TEXT NOT NULL,
            location TEXT NOT NULL, 
            confidence REAL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Error creating table', err);
            } else {
                console.log('Sightings table ready');
            }
        });
    }
});

// Serve static files from the public directory
app.use(express.static('public'));

// Serve the index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle image analysis
app.post('/analyze', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
    }

    const filepath = req.file.path;
    const location = req.body.location || 'Unknown location';
    
    try {
        // Create form data for the API request
        const formData = new FormData();
        formData.append('image', fs.createReadStream(filepath));

        // Call Imagga API
        const response = await axios({
            method: 'post',
            url: 'https://api.imagga.com/v2/tags',
            data: formData,
            headers: {
                ...formData.getHeaders(),
                'Authorization': 'Basic ' + Buffer.from(API_KEY + ':' + API_SECRET).toString('base64')
            }
        });

        // Delete the temporary file
        fs.unlinkSync(filepath);

        // Get the most confident tag
        if (response.data.result && response.data.result.tags && response.data.result.tags.length > 0) {
            const tags = response.data.result.tags;
            const maxConfidenceTag = tags.reduce((max, tag) => 
                (tag.confidence > max.confidence) ? tag : max, 
                { confidence: 0 });
            
            // Store in database
            db.run(
                'INSERT INTO sightings (animal_name, location, confidence) VALUES (?, ?, ?)',
                [maxConfidenceTag.tag.en, location, maxConfidenceTag.confidence],
                function(err) {
                    if (err) {
                        console.error('Error saving to database:', err);
                    } else {
                        console.log(`Sighting saved with ID: ${this.lastID}`);
                    }
                }
            );
        }

        // Return the API response
        res.json(response.data);
    } catch (error) {
        // Delete the temporary file if it exists
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
        res.status(500).json({ error: error.message });
    }
});

// Get all sightings
app.get('/sightings', (req, res) => {
    db.all('SELECT * FROM sightings ORDER BY timestamp DESC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ sightings: rows });
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

// Close the database connection when the server is terminated
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Closed the database connection.');
        process.exit(0);
    });
});