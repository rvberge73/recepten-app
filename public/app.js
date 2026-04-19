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
    const bookmarkletBtn = document.getElementById('bookmarklet-btn');
    const manualBtn = document.getElementById('manual-btn');
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    const showListBtn = document.getElementById('show-list-btn');
    const listDrawer = document.getElementById('list-drawer');
    const closeDrawer = document.querySelector('.close-drawer');
    const clearListBtn = document.getElementById('clear-list-btn');
    const listItemsContainer = document.getElementById('list-items');
    const listCountBadge = document.getElementById('list-count');

    // Generate dynamic bookmarklet based on current origin
    if (bookmarkletBtn) {
        const origin = window.location.origin;
        const code = `(function() {
            let scripts = document.querySelectorAll('script[type="application/ld+json"]');
            let found = null;
            for(let s of scripts) {
                try {
                    let j = JSON.parse(s.innerHTML);
                    let items = Array.isArray(j) ? j : [j];
                    if(j['@graph']) items = j['@graph'];
                    for(let i of items) {
                        if(i['@type'] === 'Recipe' || (Array.isArray(i['@type']) && i['@type'].includes('Recipe'))) {
                            found = j;
                            break;
                        }
                    }
                } catch(e) {}
            }
            if(!found) {
                alert('Geen compatibel recept gevonden op deze pagina!');
                return;
            }
            let theme = prompt('Welk thema wil je aan dit recept geven?', 'Algemeen');
            if(theme === null) return;
            let ogImage = document.querySelector('meta[property="og:image"]')?.content || document.querySelector('meta[name="twitter:image"]')?.content || '';
            fetch('${origin}/api/recipes/raw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ json: found, url: window.location.href, theme: theme, ogImage: ogImage })
            }).then(r => r.json()).then(d => {
                if(d.error) alert('Fout: ' + d.error);
                else alert('Recept succesvol opgeslagen in je app!');
            }).catch(e => alert('Fout bij opslaan! Zorg dat de app op ${origin} bereikbaar is.'));
        })()`;
        bookmarkletBtn.href = `javascript:${encodeURIComponent(code)}`;
    }

    let allRecipes = [];
    let shoppingList = [];
    let activeTheme = 'Alles';
    let searchQuery = '';
    let sortMethod = 'newest';

    if (manualBtn) {
        manualBtn.addEventListener('click', () => renderManualForm());
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase();
            renderRecipes();
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            sortMethod = e.target.value;
            renderRecipes();
        });
    }

    if (showListBtn) showListBtn.addEventListener('click', () => openDrawer());
    if (closeDrawer) closeDrawer.addEventListener('click', () => listDrawer.classList.add('hidden'));
    if (listDrawer) {
        listDrawer.addEventListener('click', (e) => {
            if (e.target === listDrawer) listDrawer.classList.add('hidden');
        });
    }
    if (clearListBtn) clearListBtn.addEventListener('click', () => clearShoppingList());

    loadRecipes();
    loadShoppingList();

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
        
        let filtered = activeTheme === 'Alles' ? allRecipes : allRecipes.filter(r => r.theme === activeTheme);
        
        if (searchQuery) {
            filtered = filtered.filter(r => 
                r.title.toLowerCase().includes(searchQuery) || 
                r.ingredients.toLowerCase().includes(searchQuery)
            );
        }

        // Sorting
        filtered.sort((a, b) => {
            if (sortMethod === 'newest') return new Date(b.created_at) - new Date(a.created_at);
            if (sortMethod === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
            if (sortMethod === 'title') return a.title.localeCompare(b.title);
            if (sortMethod === 'prep_time') {
                const getMins = (s) => {
                    if (!s) return 999;
                    const match = s.match(/(\d+)/);
                    return match ? parseInt(match[1]) : 999;
                };
                return getMins(a.prep_time) - getMins(b.prep_time);
            }
            return 0;
        });
        
        filtered.forEach(recipe => {
            const card = document.createElement('div');
            card.className = 'recipe-card';
            card.innerHTML = `
                <img src="${recipe.image_url || 'https://via.placeholder.com/300x200?text=Geen+Foto'}" alt="Recipe" class="recipe-img">
                <button class="card-fav-btn ${recipe.is_favorite ? 'active' : ''}" data-id="${recipe.id}">
                    ${recipe.is_favorite ? '❤️' : '🤍'}
                </button>
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
                if(e.target.closest('.delete-btn') || e.target.closest('.card-fav-btn')) return;
                openModal(recipe);
            });

            const delBtn = card.querySelector('.delete-btn');
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('Weet je zeker dat je dit recept wilt verwijderen?')) {
                    await fetch(`/api/recipes/${recipe.id}`, { method: 'DELETE' });
                    loadRecipes();
                }
            });

            const favBtn = card.querySelector('.card-fav-btn');
            favBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const newState = recipe.is_favorite ? 0 : 1;
                await updateRecipeField(recipe.id, { is_favorite: newState });
                recipe.is_favorite = newState;
                renderRecipes();
            });

            recipesGrid.appendChild(card);
        });
    }

    async function updateRecipeField(id, fields) {
        const recipe = allRecipes.find(r => r.id === id);
        const updated = { ...recipe, ...fields };
        await fetch(`/api/recipes/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated)
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
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div class="recipe-theme">
                            ${recipe.theme}
                            ${recipe.prep_time ? `<span class="recipe-time" style="margin-left: 10px;">⏱️ ${recipe.prep_time}</span>` : ''}
                        </div>
                        <button id="modal-fav-btn" class="fav-btn ${recipe.is_favorite ? 'active' : ''}">
                            ${recipe.is_favorite ? '❤️' : '🤍'}
                        </button>
                    </div>
                    <h2 class="modal-title">${recipe.title}</h2>
                    <a href="${recipe.source_url}" target="_blank" class="source-link">Bekijk originele bron →</a>
                    <div style="margin-top: 15px; display: flex; gap: 10px;">
                        <button id="edit-recipe-btn" class="edit-btn" style="margin-top: 0;">Bewerken</button>
                    </div>
                </div>
            </div>
            <div class="modal-body-content">
                <div class="ingredients-list">
                    <h3>
                        Ingrediënten
                    </h3>
                    <div class="servings-control">
                        <button id="serv-minus">-</button>
                        <span id="serv-text">2 personen</span>
                        <button id="serv-plus">+</button>
                    </div>
                    <ul id="modal-ingredients">
                        ${ingredients.map((ing, idx) => `
                            <li class="ingredient-item">
                                <label class="checkbox-container">
                                    <input type="checkbox" class="ing-checkbox" data-ing="${ing.replace(/"/g, '&quot;')}">
                                    <span class="checkmark"></span>
                                    <span class="ing-text">${ing}</span>
                                </label>
                            </li>
                        `).join('')}
                    </ul>
                    <div class="ingredient-actions" style="display: flex; flex-direction: column; gap: 8px; margin-top: 15px;">
                        <button id="add-selected-to-list" class="add-to-list-btn secondary" disabled>🛒 Selectie toevoegen</button>
                        <button id="add-all-to-list" class="add-to-list-btn">🛒 Alles op lijstje</button>
                    </div>
                </div>
                <div class="instructions-list">
                    <h3>Bereidingswijze</h3>
                    <ol>
                        ${instructions.map(inst => `<li>${inst}</li>`).join('')}
                    </ol>
                    <div style="margin-top: 24px;">
                        <h3>Notities</h3>
                        <textarea id="modal-notes" class="notes-area" placeholder="Voeg een notitie toe...">${recipe.notes || ''}</textarea>
                    </div>
                </div>
            </div>
        `;
        
        const servingsText = modalBody.querySelector('#serv-text');
        const ingredientsList = modalBody.querySelector('#modal-ingredients');
        const notesArea = modalBody.querySelector('#modal-notes');
        const addSelectedBtn = modalBody.querySelector('#add-selected-to-list');
        let currentServings = 2;

        const updateSelectedBtnState = () => {
            const checkedCount = ingredientsList.querySelectorAll('.ing-checkbox:checked').length;
            addSelectedBtn.disabled = checkedCount === 0;
            if (checkedCount > 0) {
                addSelectedBtn.textContent = `🛒 ${checkedCount} item${checkedCount > 1 ? 's' : ''} toevoegen`;
            } else {
                addSelectedBtn.textContent = `🛒 Selectie toevoegen`;
            }
        };

        ingredientsList.addEventListener('change', (e) => {
            if (e.target.classList.contains('ing-checkbox')) {
                updateSelectedBtnState();
            }
        });

        const updateServings = (newServings) => {
            currentServings = Math.max(1, newServings);
            servingsText.textContent = `${currentServings} personen`;
            const multiplier = currentServings / 2;
            ingredientsList.innerHTML = ingredients.map((ing, idx) => `
                <li class="ingredient-item">
                    <label class="checkbox-container">
                        <input type="checkbox" class="ing-checkbox" data-ing="${scaleIngredient(ing, multiplier).replace(/"/g, '&quot;')}">
                        <span class="checkmark"></span>
                        <span class="ing-text">${scaleIngredient(ing, multiplier)}</span>
                    </label>
                </li>
            `).join('');
            updateSelectedBtnState();
        };

        modalBody.querySelector('#serv-minus').addEventListener('click', () => updateServings(currentServings - 1));
        modalBody.querySelector('#serv-plus').addEventListener('click', () => updateServings(currentServings + 1));
        
        addSelectedBtn.addEventListener('click', () => {
            const selectedIngs = Array.from(ingredientsList.querySelectorAll('.ing-checkbox:checked')).map(cb => cb.dataset.ing);
            selectedIngs.forEach(ing => addToShoppingList(ing));
            openDrawer();
        });

        modalBody.querySelector('#add-all-to-list').addEventListener('click', () => {
            const currentIngs = Array.from(ingredientsList.querySelectorAll('.ing-text')).map(span => span.textContent);
            currentIngs.forEach(ing => addToShoppingList(ing));
            openDrawer();
        });

        notesArea.addEventListener('blur', () => {
            updateRecipeField(recipe.id, { notes: notesArea.value });
            recipe.notes = notesArea.value;
        });

        modalBody.querySelector('#modal-fav-btn').addEventListener('click', async (e) => {
            const newState = recipe.is_favorite ? 0 : 1;
            await updateRecipeField(recipe.id, { is_favorite: newState });
            recipe.is_favorite = newState;
            e.target.textContent = newState ? '❤️' : '🤍';
            e.target.classList.toggle('active');
            renderRecipes();
        });
        
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

    function renderManualForm() {
        modalBody.innerHTML = `
            <div class="modal-header">
                <div style="width: 100%;">
                    <h2 class="modal-title">Nieuw Recept Toevoegen</h2>
                    <label style="font-weight: 600; display: block; margin-bottom: 5px;">Titel</label>
                    <input type="text" id="manual-title" placeholder="Naam van het recept" class="edit-input">
                    
                    <div style="display: flex; gap: 15px;">
                        <div style="flex: 1;">
                            <label style="font-weight: 600; display: block; margin-bottom: 5px;">Thema</label>
                            <input type="text" id="manual-theme" placeholder="bijv. Italiaans" class="edit-input">
                        </div>
                        <div style="flex: 1;">
                            <label style="font-weight: 600; display: block; margin-bottom: 5px;">Bereidingstijd</label>
                            <input type="text" id="manual-prep-time" placeholder="bijv. 30 min" class="edit-input">
                        </div>
                    </div>
                    <label style="font-weight: 600; display: block; margin-bottom: 5px;">Afbeelding URL (optioneel)</label>
                    <input type="text" id="manual-image" placeholder="https://..." class="edit-input">
                </div>
            </div>
            <div class="modal-body-content">
                <div class="ingredients-list" style="flex: 1;">
                    <h3>Ingrediënten (1 per regel)</h3>
                    <textarea id="manual-ingredients" class="edit-textarea" placeholder="bijv. 500g Pasta"></textarea>
                </div>
                <div class="instructions-list" style="flex: 1;">
                    <h3>Bereidingswijze (1 per regel)</h3>
                    <textarea id="manual-instructions" class="edit-textarea" placeholder="bijv. Kook de pasta..."></textarea>
                </div>
            </div>
            <div style="margin-top: 20px; text-align: right;">
                <button id="cancel-manual-btn" class="delete-btn" style="background: var(--text-muted); margin-right: 10px;">Annuleren</button>
                <button id="save-manual-btn" class="edit-btn">Recept Opslaan</button>
            </div>
        `;

        modal.classList.remove('hidden');

        document.getElementById('cancel-manual-btn').addEventListener('click', () => modal.classList.add('hidden'));
        document.getElementById('save-manual-btn').addEventListener('click', async () => {
            const title = document.getElementById('manual-title').value;
            const theme = document.getElementById('manual-theme').value;
            const prep_time = document.getElementById('manual-prep-time').value;
            const image_url = document.getElementById('manual-image').value;
            const ings = document.getElementById('manual-ingredients').value.split('\n').map(i => i.trim()).filter(i => i);
            const insts = document.getElementById('manual-instructions').value.split('\n').map(i => i.trim()).filter(i => i);

            if (!title) {
                alert('Titel is verplicht!');
                return;
            }

            try {
                const res = await fetch('/api/recipes/manual', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title, theme, prep_time, image_url,
                        ingredients: JSON.stringify(ings),
                        instructions: JSON.stringify(insts)
                    })
                });

                if (res.ok) {
                    modal.classList.add('hidden');
                    loadRecipes();
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

    // Shopping List Functions
    async function loadShoppingList() {
        const res = await fetch('/api/shopping-list');
        shoppingList = await res.json();
        renderShoppingList();
    }

    function renderShoppingList() {
        listItemsContainer.innerHTML = '';
        listCountBadge.textContent = shoppingList.length;

        shoppingList.forEach(item => {
            const div = document.createElement('div');
            div.className = `list-item ${item.is_checked ? 'checked' : ''}`;
            div.innerHTML = `
                <input type="checkbox" ${item.is_checked ? 'checked' : ''}>
                <span class="list-item-text">${item.text}</span>
                <button class="delete-btn" style="border:none; padding: 4px;">&times;</button>
            `;

            div.querySelector('input').addEventListener('change', async (e) => {
                const is_checked = e.target.checked ? 1 : 0;
                await fetch(`/api/shopping-list/${item.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_checked })
                });
                item.is_checked = is_checked;
                div.classList.toggle('checked', is_checked);
            });

            div.querySelector('.delete-btn').addEventListener('click', async () => {
                await fetch(`/api/shopping-list/${item.id}`, { method: 'DELETE' });
                shoppingList = shoppingList.filter(i => i.id !== item.id);
                renderShoppingList();
            });

            listItemsContainer.appendChild(div);
        });
    }

    async function addToShoppingList(text) {
        const res = await fetch('/api/shopping-list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        const newItem = await res.json();
        shoppingList.push(newItem);
        renderShoppingList();
    }

    async function clearShoppingList() {
        if (confirm('Boodschappenlijst helemaal leegmaken?')) {
            await fetch('/api/shopping-list', { method: 'DELETE' });
            shoppingList = [];
            renderShoppingList();
        }
    }

    function openDrawer() {
        listDrawer.classList.remove('hidden');
    }

    // Helper: Scaling logic
    function scaleIngredient(ing, multiplier) {
        // Regex to find numbers (including decimals and fractions)
        // Handles: 500, 1.5, 1,5, 1/2
        const numRegex = /(\d+[\.,\/]?\d*)/g;
        
        return ing.replace(numRegex, (match) => {
            if (match.includes('/')) {
                const [a, b] = match.split('/');
                const val = (parseInt(a) / parseInt(b)) * multiplier;
                return formatNumber(val);
            }
            const val = parseFloat(match.replace(',', '.')) * multiplier;
            return formatNumber(val);
        });
    }

    function formatNumber(num) {
        if (num % 1 === 0) return num.toString();
        // Return 1 decimal if needed, but avoid 1.0
        const s = num.toFixed(1);
        return s.endsWith('.0') ? s.slice(0, -2) : s;
    }
});
