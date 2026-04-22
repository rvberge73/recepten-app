const { findRecipeInGraph, extractFromJSON, processRawJSON } = require('./scraper');

const sampleJSON = {
  "@graph": [
    {
      "@type": "Recipe",
      "name": "Pompoensoep",
      "recipeIngredient": ["Pompoen", "Wortel"],
      "recipeInstructions": [{ "text": "Koken" }],
      "totalTime": "PT30M"
    }
  ]
};

try {
    const result = processRawJSON(sampleJSON, "http://test.com", "http://image.com");
    console.log("Success:", result);
} catch (e) {
    console.error("Error:", e.message);
}
