document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('add-recipe-form');
    const submitBtn = document.getElementById('submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const loader = submitBtn.querySelector('.loader');
    const statusMsg = document.getElementById('status-msg');
    const recipesGrid = document.getElementById('recipes-grid');
    const themeFilters = document.getElementById('theme-filters');
    const modal = document.getElementById('recipe-modal');
    const closeBtn = document.querySelector('.close-btn');
    const modalBody = document.getElementById('modal-body');

    let allRecipes = [];
    let activeTheme = 'Alles';

    loadRecipes();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const urlsInput = document.getElementById('url').value;
        const theme = document.getElementById('theme').value;
        
        const urls = urlsInput.split(',').map(u => u.trim()).filter(u => u);
        
        submitBtn.disabled = true;
        btnText.textContent = 'Bezig...';
        loader.classList.remove('hidden');
        statusMsg.textContent = '';
        statusMsg.className = '';

        let successCount = 0;
        let failCount = 0;

        for (const url of urls) {
            try {
                const res = await fetch('/api/recipes/scrape', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url, theme })
                });
                if (res.ok) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (err) {
                failCount++;
            }
        }

        submitBtn.disabled = false;
        btnText.textContent = 'Ophalen & Opslaan';
        loader.classList.add('hidden');

        if (failCount === 0) {
            statusMsg.textContent = `${successCount} recept(en) succesvol opgeslagen!`;
            statusMsg.className = 'success';
            form.reset();
        } else {
            statusMsg.textContent = `${successCount} opgeslagen, ${failCount} mislukt. Zorg dat het een geldige recepten-URL is.`;
            statusMsg.className = failCount > 0 && successCount === 0 ? 'error' : 'success';
        }

        loadRecipes();
    });

    async function loadRecipes() {
        try {
            const res = await fetch('/api/recipes');
            allRecipes = await res.json();
            renderFilters();
            renderRecipes();
        } catch (error) {
            console.error('Error loading recipes', error);
        }
    }

    function renderFilters() {
        const themes = ['Alles', ...new Set(allRecipes.map(r => r.theme))];
        themeFilters.innerHTML = '';
        themes.forEach(theme => {
            const badge = document.createElement('div');
            badge.className = `badge ${activeTheme === theme ? 'active' : ''}`;
            badge.textContent = theme;
            badge.addEventListener('click', () => {
                activeTheme = theme;
                renderFilters();
                renderRecipes();
            });
            themeFilters.appendChild(badge);
        });
    }

    function renderRecipes() {
        recipesGrid.innerHTML = '';
        const filtered = activeTheme === 'Alles' ? allRecipes : allRecipes.filter(r => r.theme === activeTheme);
        
        filtered.forEach(recipe => {
            const card = document.createElement('div');
            card.className = 'recipe-card';
            card.innerHTML = `
                <img src="${recipe.image_url || 'https://via.placeholder.com/300x200?text=Geen+Foto'}" alt="Recipe" class="recipe-img">
                <div class="recipe-content">
                    <div class="recipe-theme">
                        ${recipe.theme} 
                        ${recipe.prep_time ? `<span class="recipe-time">⏱️ ${recipe.prep_time}</span>` : ''}
                    </div>
                    <div class="recipe-title">${recipe.title}</div>
                    <div class="recipe-actions">
                        <button class="delete-btn" data-id="${recipe.id}">Verwijder</button>
                    </div>
                </div>
            `;

            card.addEventListener('click', (e) => {
                if(e.target.classList.contains('delete-btn')) return;
                openModal(recipe);
            });

            const delBtn = card.querySelector('.delete-btn');
            delBtn.addEventListener('click', async () => {
                if (confirm('Weet je zeker dat je dit recept wilt verwijderen?')) {
                    await fetch(`/api/recipes/${recipe.id}`, { method: 'DELETE' });
                    loadRecipes();
                }
            });

            recipesGrid.appendChild(card);
        });
    }

    function openModal(recipe) {
        let ingredients = [];
        let instructions = [];
        try { ingredients = JSON.parse(recipe.ingredients); } catch(e){}
        try { instructions = JSON.parse(recipe.instructions); } catch(e){}

        modalBody.innerHTML = `
            <div class="modal-header">
                <img src="${recipe.image_url || 'https://via.placeholder.com/300x200?text=Geen+Foto'}" alt="${recipe.title}">
                <div>
                    <div class="recipe-theme">
                        ${recipe.theme}
                        ${recipe.prep_time ? `<span class="recipe-time" style="margin-left: 10px;">⏱️ ${recipe.prep_time}</span>` : ''}
                    </div>
                    <h2 class="modal-title">${recipe.title}</h2>
                    <a href="${recipe.source_url}" target="_blank" class="source-link">Bekijk originele bron →</a>
                    <button id="edit-recipe-btn" class="edit-btn">Bewerken</button>
                </div>
            </div>
            <div class="modal-body-content">
                <div class="ingredients-list">
                    <h3>Ingrediënten</h3>
                    <ul>
                        ${ingredients.map(ing => `<li>${ing}</li>`).join('')}
                    </ul>
                </div>
                <div class="instructions-list">
                    <h3>Bereidingswijze</h3>
                    <ol>
                        ${instructions.map(inst => `<li>${inst}</li>`).join('')}
                    </ol>
                </div>
            </div>
        `;
        
        const editBtn = modalBody.querySelector('#edit-recipe-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => renderEditForm(recipe, ingredients, instructions));
        }

        modal.classList.remove('hidden');
    }

    function renderEditForm(recipe, ingredients, instructions) {
        modalBody.innerHTML = `
            <div class="modal-header">
                <div style="width: 100%;">
                    <label style="font-weight: 600; display: block; margin-bottom: 5px;">Titel</label>
                    <input type="text" id="edit-title" value="${recipe.title.replace(/"/g, '&quot;')}" class="edit-input">
                    
                    <div style="display: flex; gap: 15px;">
                        <div style="flex: 1;">
                            <label style="font-weight: 600; display: block; margin-bottom: 5px;">Thema</label>
                            <input type="text" id="edit-theme" value="${recipe.theme.replace(/"/g, '&quot;')}" class="edit-input">
                        </div>
                        <div style="flex: 1;">
                            <label style="font-weight: 600; display: block; margin-bottom: 5px;">Bereidingstijd</label>
                            <input type="text" id="edit-prep-time" value="${(recipe.prep_time || '').replace(/"/g, '&quot;')}" class="edit-input">
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-body-content">
                <div class="ingredients-list" style="flex: 1;">
                    <h3>Ingrediënten (1 per regel)</h3>
                    <textarea id="edit-ingredients" class="edit-textarea">${ingredients.join('\n')}</textarea>
                </div>
                <div class="instructions-list" style="flex: 1;">
                    <h3>Bereidingswijze (1 per regel)</h3>
                    <textarea id="edit-instructions" class="edit-textarea">${instructions.join('\n')}</textarea>
                </div>
            </div>
            <div style="margin-top: 20px; text-align: right;">
                <button id="cancel-edit-btn" class="delete-btn" style="background: var(--text-muted); margin-right: 10px;">Annuleren</button>
                <button id="save-recipe-btn" class="edit-btn">Opslaan</button>
            </div>
        `;

        document.getElementById('cancel-edit-btn').addEventListener('click', () => openModal(recipe));
        document.getElementById('save-recipe-btn').addEventListener('click', async () => {
            const title = document.getElementById('edit-title').value;
            const theme = document.getElementById('edit-theme').value;
            const prep_time = document.getElementById('edit-prep-time').value;
            const ings = document.getElementById('edit-ingredients').value.split('\n').map(i => i.trim()).filter(i => i);
            const insts = document.getElementById('edit-instructions').value.split('\n').map(i => i.trim()).filter(i => i);

            try {
                const res = await fetch(`/api/recipes/${recipe.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title, theme, prep_time,
                        ingredients: JSON.stringify(ings),
                        instructions: JSON.stringify(insts)
                    })
                });

                if (res.ok) {
                    recipe.title = title;
                    recipe.theme = theme;
                    recipe.prep_time = prep_time;
                    recipe.ingredients = JSON.stringify(ings);
                    recipe.instructions = JSON.stringify(insts);
                    loadRecipes();
                    openModal(recipe);
                } else {
                    alert('Fout bij opslaan van recept.');
                }
            } catch(e) {
                alert('Netwerkfout bij opslaan.');
            }
        });
    }

    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });
});
