const express = require('express');
const mysql = require('mysql');
const moment = require('moment-timezone');
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
      i INT,
      e INT,
      f INT,
      a INT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  db.query(createTableQuery, (err, result) => {
    if (err) throw err;
    console.log('Table logs created or already exists.');
  });
});

// Route to handle saving data
app.get('/', (req, res) => {
  const data = req.query.data;
  if (!data) {
    return res.status(400).json({ error: 'No data provided' });
  }
  
  try {
    const jsonData = JSON.parse(data);
    const { i, e, f, a } = jsonData;
    
    // Save data to database with timestamp in UTC+7
    const timestamp = moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss');
    const insertQuery = 'INSERT INTO logs (i, e, f, a, timestamp) VALUES (?, ?, ?, ?, ?)';
    
    db.query(insertQuery, [i, e, f, a, timestamp], (err, result) => {
      if (err) {
        console.error('Error inserting data:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.status(200).json({ message: 'Data saved successfully' });
    });
  } catch (err) {
    res.status(400).json({ error: 'Invalid JSON format' });
  }
});

// Route to return data from logs table
app.get('/json', (req, res) => {
	const { all } = req.query;
  
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
