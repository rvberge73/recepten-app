const axios = require('axios');
const cheerio = require('cheerio');

function parseISO8601Duration(duration) {
    if (!duration) return '';
    const regex = /PT(?:(\d+)H)?(?:(\d+)M)?/;
    const matches = duration.match(regex);
    if (!matches) return '';
    
    const hours = parseInt(matches[1] || 0);
    const minutes = parseInt(matches[2] || 0);
    
    let result = [];
    if (hours > 0) result.push(`${hours} uur`);
    if (minutes > 0) result.push(`${minutes} min`);
    
    return result.join(' ');
}

function extractFromJSON(recipeData, url, ogImage) {
    const title = recipeData.name || 'Naamloos Recept';
    
    let image_url = '';
    if (recipeData.image) {
        if (typeof recipeData.image === 'string') image_url = recipeData.image;
        else if (Array.isArray(recipeData.image)) image_url = recipeData.image[0];
        else if (recipeData.image.url) image_url = recipeData.image.url;
    }
    
    if (!image_url && ogImage) {
        image_url = ogImage;
    }

    let ingredients = [];
    if (recipeData.recipeIngredient) {
        ingredients = Array.isArray(recipeData.recipeIngredient) ? recipeData.recipeIngredient : [recipeData.recipeIngredient];
    }

    let instructions = [];
    if (recipeData.recipeInstructions) {
        let instr = recipeData.recipeInstructions;
        if (Array.isArray(instr)) {
            instructions = instr.map(step => step.text || step.name || step).filter(s => typeof s === 'string');
        } else {
            instructions = [instr];
        }
    }

    let prep_time = '';
    if (recipeData.totalTime) prep_time = parseISO8601Duration(recipeData.totalTime);
    else if (recipeData.prepTime) prep_time = parseISO8601Duration(recipeData.prepTime);
    else if (recipeData.cookTime) prep_time = parseISO8601Duration(recipeData.cookTime);

    return {
        title,
        image_url,
        ingredients: JSON.stringify(ingredients),
        instructions: JSON.stringify(instructions),
        source_url: url,
        prep_time
    };
}

function findRecipeInGraph(json) {
    let items = Array.isArray(json) ? json : [json];
    if (json['@graph']) items = json['@graph'];

    for (let item of items) {
        if (item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))) {
            return item;
        }
    }
    return null;
}

async function scrapeRecipe(url) {
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
            }
        });
        const $ = cheerio.load(data);
        let recipeData = null;

        $('script[type="application/ld+json"]').each((i, el) => {
            try {
                const json = JSON.parse($(el).html());
                const found = findRecipeInGraph(json);
                if (found) recipeData = found;
            } catch (e) {}
        });

        if (!recipeData) {
            throw new Error('Geen compatibele recept-data gevonden op deze webpagina.');
        }

        if (!recipeData.name) recipeData.name = $('title').text();

        let ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
        return extractFromJSON(recipeData, url, ogImage);
    } catch (error) {
        console.error('Scraping error:', error.message);
        throw error;
    }
}

function processRawJSON(json, url, ogImage) {
    const recipeData = findRecipeInGraph(json);
    if (!recipeData) throw new Error('Geen compatibele recept-data gevonden in de opgestuurde gegevens.');
    if (!recipeData.name) recipeData.name = 'Recept van ' + url;
    return extractFromJSON(recipeData, url, ogImage);
}

module.exports = { scrapeRecipe, processRawJSON };
