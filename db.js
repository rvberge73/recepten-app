const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'recipes.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS recipes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            theme TEXT,
            source_url TEXT,
            image_url TEXT,
            ingredients TEXT,
            instructions TEXT,
            is_favorite INTEGER DEFAULT 0,
            notes TEXT,
            prep_time TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, () => {
            // Check and add columns if they don't exist (for existing databases)
            db.run(`ALTER TABLE recipes ADD COLUMN is_favorite INTEGER DEFAULT 0`, () => {});
            db.run(`ALTER TABLE recipes ADD COLUMN notes TEXT`, () => {});
            db.run(`ALTER TABLE recipes ADD COLUMN prep_time TEXT`, () => {});
        });

        db.run(`CREATE TABLE IF NOT EXISTS shopping_list (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            is_checked INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

module.exports = db;
