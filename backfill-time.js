const db = require('./db');
const { scrapeRecipe } = require('./scraper');

async function backfill() {
    console.log('Starting backfill for prep_time...');
    db.all('SELECT id, source_url FROM recipes WHERE prep_time IS NULL OR prep_time = ""', [], async (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(`Found ${rows.length} recipes to backfill.`);
        for (let row of rows) {
            try {
                console.log(`Scraping ${row.source_url}...`);
                const recipe = await scrapeRecipe(row.source_url);
                if (recipe.prep_time) {
                    db.run('UPDATE recipes SET prep_time = ? WHERE id = ?', [recipe.prep_time, row.id]);
                    console.log(`Updated recipe ${row.id} with time: ${recipe.prep_time}`);
                } else {
                    console.log(`No time found for recipe ${row.id}`);
                }
            } catch (e) {
                console.error(`Failed to scrape recipe ${row.id}: ${e.message}`);
            }
        }
        console.log('Backfill complete!');
    });
}

// We need to wait a tiny bit for db to open, though sqlite3 usually queues.
setTimeout(backfill, 1000);
