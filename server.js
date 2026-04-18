const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const { scrapeRecipe, processRawJSON } = require('./scraper');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Get all recipes
app.get('/api/recipes', (req, res) => {
    db.all('SELECT * FROM recipes ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Add a recipe via URL
app.post('/api/recipes/scrape', async (req, res) => {
    const { url, theme } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        const recipe = await scrapeRecipe(url);
        recipe.theme = theme || 'Algemeen';

        const sql = `INSERT INTO recipes (title, theme, source_url, image_url, ingredients, instructions, prep_time) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.run(sql, [recipe.title, recipe.theme, recipe.source_url, recipe.image_url, recipe.ingredients, recipe.instructions, recipe.prep_time], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, ...recipe });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add a recipe via Bookmarklet (Raw JSON)
app.post('/api/recipes/raw', (req, res) => {
    const { json, url, theme, ogImage } = req.body;
    if (!json || !url) return res.status(400).json({ error: 'JSON and URL are required' });

    try {
        const recipe = processRawJSON(json, url, ogImage);
        recipe.theme = theme || 'Algemeen';

        const sql = `INSERT INTO recipes (title, theme, source_url, image_url, ingredients, instructions, prep_time) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.run(sql, [recipe.title, recipe.theme, recipe.source_url, recipe.image_url, recipe.ingredients, recipe.instructions, recipe.prep_time], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, ...recipe });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add a recipe manually
app.post('/api/recipes/manual', (req, res) => {
    const { title, theme, prep_time, ingredients, instructions, image_url } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const sql = `INSERT INTO recipes (title, theme, source_url, image_url, ingredients, instructions, prep_time) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [title, theme || 'Algemeen', 'Handmatig toegevoegd', image_url || '', ingredients, instructions, prep_time], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

// Update a recipe (including favorites and notes)
app.put('/api/recipes/:id', (req, res) => {
    const { title, theme, prep_time, ingredients, instructions, is_favorite, notes } = req.body;
    const sql = `UPDATE recipes SET title = ?, theme = ?, prep_time = ?, ingredients = ?, instructions = ?, is_favorite = ?, notes = ? WHERE id = ?`;
    db.run(sql, [title, theme, prep_time, ingredients, instructions, is_favorite, notes, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
    });
});

// Delete a recipe
app.get('/api/shopping-list', (req, res) => {
    db.all('SELECT * FROM shopping_list ORDER BY created_at ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/shopping-list', (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });
    db.run('INSERT INTO shopping_list (text) VALUES (?)', [text], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, text, is_checked: 0 });
    });
});

app.patch('/api/shopping-list/:id', (req, res) => {
    const { is_checked } = req.body;
    db.run('UPDATE shopping_list SET is_checked = ? WHERE id = ?', [is_checked, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
    });
});

app.delete('/api/shopping-list/:id', (req, res) => {
    db.run('DELETE FROM shopping_list WHERE id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

app.delete('/api/shopping-list', (req, res) => {
    db.run('DELETE FROM shopping_list', [], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// Delete a recipe
app.delete('/api/recipes/:id', (req, res) => {
    db.run('DELETE FROM recipes WHERE id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
