/* eslint-disable no-undef */
// ESM format for server.js
import express from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const { verbose } = sqlite3;
const db = new verbose().Database('./spaceExplorer.db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));
app.use(session({
  secret: 'space_explorer_secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Initialize SQLite database
db.serialize(() => {
  // Create tables if they don't exist
  db.run(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating players table', err.message);
    } else {
      console.log('Players table ready');
    }
  });
  
  db.run(`CREATE TABLE IF NOT EXISTS game_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    duration INTEGER,
    enemies_destroyed INTEGER DEFAULT 0,
    FOREIGN KEY (player_id) REFERENCES players (id)
  )`, (err) => {
    if (err) {
      console.error('Error creating game_sessions table', err.message);
    } else {
      console.log('Game sessions table ready');
    }
  });
});

// API Routes

// Get all players with scores
app.get('/api/players', (req, res) => {
  db.all('SELECT * FROM players ORDER BY score DESC LIMIT 10', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Add a new player
app.post('/api/players', (req, res) => {
  const { name, score, level } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Player name is required' });
    return;
  }
  
  const sql = 'INSERT INTO players (name, score, level) VALUES (?, ?, ?)';
  db.run(sql, [name, score || 0, level || 1], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    res.json({
      id: this.lastID,
      name,
      score,
      level,
      message: 'Player added successfully'
    });
  });
});

// Update player score
app.put('/api/players/:id', (req, res) => {
  const { id } = req.params;
  const { score, level } = req.body;
  
  const sql = 'UPDATE players SET score = ?, level = ? WHERE id = ?';
  db.run(sql, [score, level, id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    
    res.json({ message: 'Player updated successfully' });
  });
});

// Record a game session
app.post('/api/sessions', (req, res) => {
  const { player_id, duration, enemies_destroyed } = req.body;
  
  const sql = 'INSERT INTO game_sessions (player_id, duration, enemies_destroyed, end_time) VALUES (?, ?, ?, CURRENT_TIMESTAMP)';
  db.run(sql, [player_id, duration, enemies_destroyed], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    res.json({
      id: this.lastID,
      message: 'Game session recorded successfully'
    });
  });
});

// Get player stats
app.get('/api/players/:id/stats', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM players WHERE id = ?', [id], (err, player) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    
    db.all('SELECT * FROM game_sessions WHERE player_id = ?', [id], (err, sessions) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      res.json({
        player,
        sessions,
        total_games: sessions.length,
        total_enemies_destroyed: sessions.reduce((total, session) => total + session.enemies_destroyed, 0)
      });
    });
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Close the database connection when the process ends
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed');
    process.exit(0);
  });
}); 