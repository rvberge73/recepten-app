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

// Update a recipe
app.put('/api/recipes/:id', (req, res) => {
    const { title, theme, prep_time, ingredients, instructions } = req.body;
    const sql = `UPDATE recipes SET title = ?, theme = ?, prep_time = ?, ingredients = ?, instructions = ? WHERE id = ?`;
    db.run(sql, [title, theme, prep_time, ingredients, instructions, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
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
