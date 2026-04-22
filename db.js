const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');

const isProduction = process.env.DATABASE_URL !== undefined;
let db;

if (isProduction) {
    // PostgreSQL (for Render / Production)
    console.log('Connecting to PostgreSQL (Production)...');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    // Helper to convert '?' placeholders to '$1, $2...'
    const convertPlaceholders = (sql) => {
        let index = 1;
        return sql.replace(/\?/g, () => `$${index++}`);
    };

    db = {
        all: (sql, params, callback) => {
            const p = Array.isArray(params) ? params : [params];
            pool.query(convertPlaceholders(sql), p, (err, res) => {
                if (err) callback(err);
                else callback(null, res.rows);
            });
        },
        run: function(sql, params, callback) {
            const p = Array.isArray(params) ? params : [params];
            let finalSql = convertPlaceholders(sql);
            const isInsert = sql.trim().toUpperCase().startsWith('INSERT');
            if (isInsert && !finalSql.toUpperCase().includes('RETURNING')) {
                finalSql += ' RETURNING id';
            }

            pool.query(finalSql, p, (err, res) => {
                if (err) {
                    if (callback) callback(err);
                } else {
                    const lastID = res.rows[0] ? res.rows[0].id : null;
                    if (callback) callback.call({ lastID: lastID, changes: res.rowCount }, null);
                }
            });
        },
        get: (sql, params, callback) => {
            const p = Array.isArray(params) ? params : [params];
            pool.query(convertPlaceholders(sql), p, (err, res) => {
                if (err) callback(err);
                else callback(null, res.rows[0]);
            });
        }
    };

    // Initialize Postgres tables
    initPostgres(pool);

} else {
    // SQLite (for Local / Development)
    console.log('Connecting to SQLite (Local)...');
    const dbPath = path.join(__dirname, 'data', 'recipes.db');
    const sqliteDb = new sqlite3.Database(dbPath, (err) => {
        if (err) console.error('Error opening SQLite database', err.message);
        else console.log('Connected to the SQLite database.');
    });

    db = sqliteDb;
    // Tables are initialized in the standard sqlite way
    initSQLite(sqliteDb);
}

function initSQLite(sqliteDb) {
    sqliteDb.serialize(() => {
        sqliteDb.run(`CREATE TABLE IF NOT EXISTS recipes (
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
            sqliteDb.run(`ALTER TABLE recipes ADD COLUMN is_favorite INTEGER DEFAULT 0`, () => {});
            sqliteDb.run(`ALTER TABLE recipes ADD COLUMN notes TEXT`, () => {});
            sqliteDb.run(`ALTER TABLE recipes ADD COLUMN prep_time TEXT`, () => {});
        });

        sqliteDb.run(`CREATE TABLE IF NOT EXISTS shopping_list (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            is_checked INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    });
}

async function initPostgres(pool) {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS recipes (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            theme TEXT,
            source_url TEXT,
            image_url TEXT,
            ingredients TEXT,
            instructions TEXT,
            is_favorite INTEGER DEFAULT 0,
            notes TEXT,
            prep_time TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        
        await pool.query(`CREATE TABLE IF NOT EXISTS shopping_list (
            id SERIAL PRIMARY KEY,
            text TEXT NOT NULL,
            is_checked INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log('PostgreSQL tables initialized.');
    } catch (err) {
        console.error('Error initializing PostgreSQL tables:', err.message);
    }
}

module.exports = db;
