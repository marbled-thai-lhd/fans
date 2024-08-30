const express = require('express');
const mysql = require('mysql');
const moment = require('moment-timezone');
const http = require('http');
const app = express();
const port = 3000;

// MySQL connection configuration
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
	user: process.env.DB_USER || 'user',
	password: process.env.DB_PASSWORD || 'userpassword',
	database: process.env.DB_NAME || 'mydatabase'
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error('error connecting: ' + err.stack);
    return;
  }
  console.log('connected as id ' + db.threadId);
  
  // Create table if not exists
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      i DECIMAL(4,2),
      e DECIMAL(4,2),
      f INT,
      a INT,
      r1 TINYINT,
      r2 TINYINT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  db.query(createTableQuery, (err, result) => {
    if (err) throw err;
    console.log('Table logs created or already exists.');
  });
});

const cleanUp = () => {
  // Auto clean data older than 7 days
  const cleanQuery = 'DELETE FROM logs WHERE timestamp < NOW() - INTERVAL 7 DAY';
  db.query(cleanQuery, (err, result) => {
    if (err) {
      console.error('Error cleaning data:', err);
    }
    console.log('Data older than 7 days deleted.');
  });
}

// Route to handle saving data
app.get('/', (req, res) => {
  cleanUp();
  const data = `${req.query.data.replace(/([a-z0-9]+):/g, '"$1": ')}`;
  if (!data) {
    return res.status(400).json({ error: 'No data provided' });
  }
  
  try {
    const {i, e, f, a, r1, r2} = JSON.parse(data);
    if (i > 60 || e > 60) return res.status(400).json({ error: 'Invalid JSON format' });
    
    // Save data to database with timestamp in UTC+7
    const timestamp = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
    const insertQuery = 'INSERT INTO logs (i, e, f, a, r1, r2, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)';
    db.query(insertQuery, [i, e, f, a, r1, r2, timestamp], (err, result) => {
      if (err) {
        console.error('Error inserting data:', err);
        return res.status(500).json({ error: 'Database error', err });
      }
      res.status(200).json({ message: 'Data saved successfully' });
    });
  } catch (err) {
    res.status(400).json({ error: 'Invalid JSON format' });
  }
});

app.get('/max-min', (req, res) => {
  // Return today's data
  const selectQuery = `
    SELECT max(i) as mxi, min(i) as mni, max(e) as mxe, min(e) as mne 
    FROM logs 
    where e between 20 and 50
    and i between 20 and 60`;
  db.query(selectQuery, [], (err, results) => {
  if (err) {
    console.error('Error fetching data:', err);
    return res.status(500).json({ error: 'Database error' });
  }
  res.status(200).json(results);
  });
})

// Route to return data from logs table
app.get('/json', (req, res) => {
	const { all } = req.query;
  // Set headers to allow all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
	if (all && all.toLowerCase() === 'true') {
	  // Return all data
	  const selectQuery = 'SELECT * FROM logs';
	  db.query(selectQuery, (err, results) => {
		if (err) {
		  console.error('Error fetching data:', err);
		  return res.status(500).json({ error: 'Database error' });
		}
		res.status(200).json(results);
	  });
	} else {
	  // Return today's data
	  const todayStart = moment().startOf('day').format('YYYY-MM-DD HH:mm:ss');
	  const todayEnd = moment().endOf('day').format('YYYY-MM-DD HH:mm:ss');
	  const selectQuery = 'SELECT * FROM logs WHERE timestamp >= ? AND timestamp <= ?';
	  db.query(selectQuery, [todayStart, todayEnd], (err, results) => {
		if (err) {
		  console.error('Error fetching data:', err);
		  return res.status(500).json({ error: 'Database error' });
		}
		res.status(200).json(results);
	  });
	}
  });

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});


setInterval(() => cleanUp() || http.request({
    hostname: '192.168.1.50',
    port: 80,
    path: '/?log=1',
    method: 'GET'
}).end(), 5 * 60 * 1000);
