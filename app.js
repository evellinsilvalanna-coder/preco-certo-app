/**
 * PREÇO CERTO - CORE LOGIC
 * Master Developer: Zapia (BrainLogic AI)
 */

// --- STATE MANAGEMENT ---
const Store = {
    db: {
        users: [],
        currentUser: null,
        ingredients: {}, // { userId: [] }
        recipes: {},     // { userId: [] }
        settings: {},    // { userId: { salary: 3000, hours: 160, fixedCosts: [] } }
        history: {},
        tutorialCompleted: {}
    },

    load() {
        const saved = localStorage.getItem('preco_certo_v2_db');
        if (saved) {
            this.db = JSON.parse(saved);
        }
        // Initialize admin if not exists
        if (!this.db.users.find(u => u.email === 'admin@precocerto.com')) {
            this.db.users.push({
                id: 'admin',
                name: 'Administrador',
                email: 'admin@precocerto.com',
                password: 'admin1234',
                role: 'admin',
                status: 'active',
                createdAt: new Date().toISOString()
            });
            this.save();
        }
    },

    save() {
        localStorage.setItem('preco_certo_v2_db', JSON.stringify(this.db));
    },

    getUserData(key) {
        if (!this.db.currentUser) return [];
        const userId = this.db.currentUser.id;
        if (!this.db[key][userId]) this.db[key][userId] = [];
        return this.db[key][userId];
    },

    setUserData(key, data) {
        if (!this.db.currentUser) return;
        const userId = this.db.currentUser.id;
        this.db[key][userId] = data;
        this.save();
    },

    getSettings() {
        if (!this.db.currentUser) return { salary: 3000, hours: 160, fixedCosts: [] };
        const userId = this.db.currentUser.id;
        if (!this.db.settings[userId]) {
            this.db.settings[userId] = { salary: 3000, hours: 160, fixedCosts: [] };
        }
        return this.db.settings[userId];
    }
};

// --- AUTH LOGIC ---
function handleAuth(type) {
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');

    if (type === 'login') {
        const user = Store.db.users.find(u => u.email === emailInput.value && u.password === passwordInput.value);
        if (user) {
            if (user.status !== 'active' && user.role !== 'admin') {
                return showToast('Sua conta está aguardando aprovação ou foi bloqueada.', 'error');
            }
            // Check expiry
            if (user.expiresAt && new Date() > new Date(user.expiresAt)) {
                return showToast('Seu período de acesso expirou. Contate o administrador.', 'error');
            }
            Store.db.currentUser = user;
            Store.save();
            initApp();
            showToast(`Bem-vindo, ${user.name}!`);
        } else {
            showToast('Email ou senha incorretos', 'error');
        }
    } else if (type === 'signup') {
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;

        if (!name || !email || !password) return showToast('Preencha todos os campos', 'error');
        if (Store.db.users.find(u => u.email === email)) return showToast('Email já cadastrado', 'error');

        const newUser = {
            id: 'u' + Date.now(),
            name, email, password,
            role: 'user',
            status: 'pending', // Needs admin approval
            createdAt: new Date().toISOString(),
            expiresAt: null
        };
        Store.db.users.push(newUser);
        Store.save();
        showToast('Cadastro realizado! Aguarde aprovação do administrador.');
        toggleAuthMode();
    } else if (type === 'logout') {
        Store.db.currentUser = null;
        Store.save();
        location.reload();
    }
}

function toggleAuthMode() {
    document.getElementById('login-form').classList.toggle('hidden');
    document.getElementById('signup-form').classList.toggle('hidden');
}

// --- UI & NAVIGATION ---
let currentView = 'dashboard';

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    
    // Nav buttons update
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('text-primary');
        btn.classList.add('text-gray-400');
    });
    const activeBtn = document.getElementById(`nav-${viewId}`) || document.querySelector(`#nav-${viewId}-btn`);
    if (activeBtn) {
        activeBtn.classList.add('text-primary');
        activeBtn.classList.remove('text-gray-400');
    }

    currentView = viewId;
    if (viewId === 'dashboard') updateDashboard();
    if (viewId === 'ingredients') renderIngredientsTable();
    if (viewId === 'recipes') renderRecipesGrid();
    if (viewId === 'settings') renderSettings();
    if (viewId === 'admin') renderAdminPanel();
    
    window.scrollTo(0, 0);
}

function initApp() {
    if (!Store.db.currentUser) {
        document.getElementById('auth-screen').classList.remove('hidden');
        return;
    }
    document.getElementById('auth-screen').classList.add('hidden');
    
    // User menu setup
    document.getElementById('user-initials').innerText = Store.db.currentUser.name.substring(0, 2).toUpperCase();
    document.getElementById('user-display-name').innerText = Store.db.currentUser.name;
    document.getElementById('user-display-email').innerText = Store.db.currentUser.email;

    if (Store.db.currentUser.role === 'admin') {
        document.getElementById('nav-admin-btn').classList.remove('hidden');
    }

    // Check tutorial
    if (!Store.db.tutorialCompleted[Store.db.currentUser.id]) {
        startTutorial();
    }

    showView('dashboard');
    updateLaborRate();
}

// --- DASHBOARD ---
function updateDashboard() {
    const recipes = Store.getUserData('recipes');
    const ingredients = Store.getUserData('ingredients');
    
    document.getElementById('stat-recipes').innerText = recipes.length;
    document.getElementById('stat-ingredients').innerText = ingredients.length;
    
    const totalProfit = recipes.reduce((sum, r) => sum + (r.profitValue * r.yield || 0), 0);
    document.getElementById('stat-profit').innerText = formatCurrency(totalProfit);

    renderSalesChart(recipes);
    renderTopProducts(recipes);
}

function renderSalesChart(recipes) {
    const ctx = document.getElementById('salesChart').getContext('2d');
    if (window.myChart) window.myChart.destroy();

    const labels = recipes.slice(-7).map(r => r.title);
    const data = recipes.slice(-7).map(r => r.salePrice);

    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Preço de Venda (R$)',
                data: data,
                backgroundColor: '#E53935',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function renderTopProducts(recipes) {
    const container = document.getElementById('top-products');
    container.innerHTML = '';
    
    const sorted = [...recipes].sort((a, b) => b.profitValue - a.profitValue).slice(0, 5);
    
    if (sorted.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-400 italic">Nenhuma receita cadastrada.</p>';
        return;
    }

    sorted.forEach(p => {
        container.innerHTML += `
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <div class="h-10 w-10 bg-gray-100 dark:bg-zinc-700 rounded-lg flex items-center justify-center text-primary">
                        <i class="fas fa-cookie"></i>
                    </div>
                    <div>
                        <p class="text-sm font-bold">${p.title}</p>
                        <p class="text-[10px] text-gray-500">${p.profitMargin}% de lucro</p>
                    </div>
                </div>
                <p class="text-sm font-bold text-green-500">+${formatCurrency(p.profitValue)}</p>
            </div>
        `;
    });
}

// --- INGREDIENTS ---
function renderIngredientsTable() {
    const ingredients = Store.getUserData('ingredients');
    const tbody = document.getElementById('ingredients-table-body');
    tbody.innerHTML = '';

    ingredients.forEach((ing, index) => {
        tbody.innerHTML += `
            <tr class="border-b border-gray-50 dark:border-zinc-800 hover:bg-gray-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                <td class="p-4">
                    <p class="font-bold">${ing.name}</p>
                    <p class="text-[10px] text-gray-400 uppercase">${ing.brand || 'Sem marca'} | ${ing.supplier || 'Geral'}</p>
                </td>
                <td class="p-4 text-sm">${ing.qty} ${ing.unit}</td>
                <td class="p-4 text-sm font-medium">${formatCurrency(ing.price)}</td>
                <td class="p-4">
                    <p class="text-xs font-bold text-primary">${formatCurrency(ing.costPerBaseUnit)} / ${ing.baseUnit}</p>
                </td>
                <td class="p-4 text-right">
                    <button onclick="editIngredient(${index})" class="text-accent mr-3"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteIngredient(${index})" class="text-red-500"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

function openModal(modalId) {
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.querySelectorAll('.modal-box').forEach(m => m.classList.add('hidden'));
    document.getElementById(modalId).classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
}

function saveIngredient() {
    const id = document.getElementById('ing-id').value;
    const name = document.getElementById('ing-name').value;
    const brand = document.getElementById('ing-brand').value;
    const supplier = document.getElementById('ing-supplier').value;
    const qty = parseFloat(document.getElementById('ing-qty').value);
    const unit = document.getElementById('ing-unit').value;
    const price = parseFloat(document.getElementById('ing-price').value);

    if (!name || !qty || !price) return showToast('Preencha os campos obrigatórios', 'error');

    // Unit conversion logic for calculation
    let baseUnit = unit;
    let costPerBaseUnit = price / qty;

    const ingredients = Store.getUserData('ingredients');
    const newIng = { name, brand, supplier, qty, unit, price, baseUnit, costPerBaseUnit, updatedAt: new Date().toISOString() };

    if (id) {
        ingredients[id] = newIng;
    } else {
        ingredients.push(newIng);
    }

    Store.setUserData('ingredients', ingredients);
    closeModal();
    renderIngredientsTable();
    showToast('Ingrediente salvo com sucesso!');
}

function editIngredient(index) {
    const ing = Store.getUserData('ingredients')[index];
    document.getElementById('ing-id').value = index;
    document.getElementById('ing-name').value = ing.name;
    document.getElementById('ing-brand').value = ing.brand || '';
    document.getElementById('ing-supplier').value = ing.supplier || '';
    document.getElementById('ing-qty').value = ing.qty;
    document.getElementById('ing-unit').value = ing.unit;
    document.getElementById('ing-price').value = ing.price;
    openModal('modal-ingredient');
}

function deleteIngredient(index) {
    if (!confirm('Deseja realmente excluir este ingrediente?')) return;
    const ings = Store.getUserData('ingredients');
    ings.splice(index, 1);
    Store.setUserData('ingredients', ings);
    renderIngredientsTable();
}

// --- RECIPES ---
function openRecipeEditor(index = null) {
    const modal = document.getElementById('modal-recipe-editor');
    const container = document.getElementById('recipe-ingredients-list');
    container.innerHTML = '';
    
    if (index !== null) {
        const recipe = Store.getUserData('recipes')[index];
        document.getElementById('recipe-id').value = index;
        document.getElementById('recipe-title').value = recipe.title;
        document.getElementById('recipe-yield').value = recipe.yield;
        document.getElementById('recipe-time-hours').value = Math.floor(recipe.prepTime / 60);
        document.getElementById('recipe-time-minutes').value = recipe.prepTime % 60;
        document.getElementById('recipe-packaging').value = recipe.packagingCost;
        document.getElementById('recipe-profit-margin').value = recipe.profitMargin;
        recipe.ingredients.forEach(ing => addRecipeIngredientRow(ing));
    } else {
        document.getElementById('recipe-id').value = '';
        document.getElementById('recipe-title').value = '';
        document.getElementById('recipe-yield').value = '1';
        document.getElementById('recipe-time-hours').value = '0';
        document.getElementById('recipe-time-minutes').value = '30';
        document.getElementById('recipe-packaging').value = '0';
        document.getElementById('recipe-profit-margin').value = '100';
        addRecipeIngredientRow();
    }
    
    updateRecipeTotals();
    openModal('modal-recipe-editor');
}

function addRecipeIngredientRow(data = null) {
    const container = document.getElementById('recipe-ingredients-list');
    const allIngredients = Store.getUserData('ingredients');
    
    if (allIngredients.length === 0) {
        showToast('Cadastre ingredientes primeiro!', 'info');
        return;
    }

    const row = document.createElement('div');
    row.className = 'flex items-center space-x-2 animate-fade-in recipe-ing-row';
    
    const options = allIngredients.map((ing, i) => `<option value="${i}" ${data && data.ingIndex == i ? 'selected' : ''}>${ing.name}</option>`).join('');
    
    row.innerHTML = `
        <select class="flex-1 p-2 bg-gray-50 dark:bg-zinc-900 rounded-lg text-sm ing-select" onchange="updateRecipeTotals()">
            <option value="">Selecione...</option>
            ${options}
        </select>
        <input type="number" step="any" placeholder="Qtd" value="${data ? data.qty : ''}" class="w-20 p-2 bg-gray-50 dark:bg-zinc-900 rounded-lg text-sm ing-qty" oninput="updateRecipeTotals()">
        <select class="w-16 p-2 bg-gray-50 dark:bg-zinc-900 rounded-lg text-[10px] ing-unit" onchange="updateRecipeTotals()">
            <option value="g" ${data && data.unit == 'g' ? 'selected' : ''}>g</option>
            <option value="kg" ${data && data.unit == 'kg' ? 'selected' : ''}>kg</option>
            <option value="ml" ${data && data.unit == 'ml' ? 'selected' : ''}>ml</option>
            <option value="l" ${data && data.unit == 'l' ? 'selected' : ''}>l</option>
            <option value="un" ${data && data.unit == 'un' ? 'selected' : ''}>un</option>
        </select>
        <button onclick="this.parentElement.remove(); updateRecipeTotals();" class="text-red-400 p-1"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(row);
}

function updateRecipeTotals() {
    const allIngredients = Store.getUserData('ingredients');
    const settings = Store.getSettings();
    const rows = document.querySelectorAll('.recipe-ing-row');
    
    let totalIngCost = 0;
    rows.forEach(row => {
        const index = row.querySelector('.ing-select').value;
        const qty = parseFloat(row.querySelector('.ing-qty').value) || 0;
        const unit = row.querySelector('.ing-unit').value;
        
        if (index !== "" && qty > 0) {
            const ing = allIngredients[index];
            let convertedQty = qty;
            
            // Intelligence Conversion Logic
            if (ing.unit === 'kg' && unit === 'g') convertedQty = qty / 1000;
            if (ing.unit === 'g' && unit === 'kg') convertedQty = qty * 1000;
            if (ing.unit === 'l' && unit === 'ml') convertedQty = qty / 1000;
            if (ing.unit === 'ml' && unit === 'l') convertedQty = qty * 1000;
            
            totalIngCost += convertedQty * ing.costPerBaseUnit;
        }
    });

    const hoursInput = parseFloat(document.getElementById('recipe-time-hours').value) || 0;
    const minsInput = parseFloat(document.getElementById('recipe-time-minutes').value) || 0;
    const prepTime = (hoursInput * 60) + minsInput;
    const laborRate = settings.salary / settings.hours;
    const laborCost = (prepTime / 60) * laborRate;
    
    const packaging = parseFloat(document.getElementById('recipe-packaging').value) || 0;
    const yieldVal = parseFloat(document.getElementById('recipe-yield').value) || 1;
    const margin = parseFloat(document.getElementById('recipe-profit-margin').value) || 0;
    
    const baseUnitCost = (totalIngCost + laborCost + packaging) / yieldVal;
    const salePrice = baseUnitCost * (1 + (margin / 100));

    document.getElementById('display-recipe-cost-ing').innerText = formatCurrency(totalIngCost);
    document.getElementById('display-recipe-cost-labor').innerText = formatCurrency(laborCost);
    document.getElementById('display-recipe-price-total').innerText = formatCurrency(salePrice);
    
    return { totalIngCost, laborCost, baseUnitCost, salePrice, margin, packaging };
}

function saveRecipe() {
    const title = document.getElementById('recipe-title').value;
    if (!title) return showToast('Dê um nome para a receita', 'error');
    
    const results = updateRecipeTotals();
    const rows = document.querySelectorAll('.recipe-ing-row');
    const ingredientsUsed = [];
    
    rows.forEach(row => {
        const index = row.querySelector('.ing-select').value;
        const qty = parseFloat(row.querySelector('.ing-qty').value);
        const unit = row.querySelector('.ing-unit').value;
        if (index !== "" && qty) {
            ingredientsUsed.push({ ingIndex: index, qty, unit });
        }
    });

    const hoursInput = parseFloat(document.getElementById('recipe-time-hours').value) || 0;
    const minsInput = parseFloat(document.getElementById('recipe-time-minutes').value) || 0;
    const prepTime = (hoursInput * 60) + minsInput;

    const recipes = Store.getUserData('recipes');
    const newRecipe = {
        title,
        ingredients: ingredientsUsed,
        yield: parseFloat(document.getElementById('recipe-yield').value),
        prepTime: prepTime,
        packagingCost: parseFloat(document.getElementById('recipe-packaging').value),
        profitMargin: results.margin,
        costInsumos: results.totalIngCost,
        costLabor: results.laborCost,
        unitCost: results.baseUnitCost,
        salePrice: results.salePrice,
        profitValue: results.salePrice - results.baseUnitCost,
        updatedAt: new Date().toISOString()
    };

    const id = document.getElementById('recipe-id').value;
    if (id !== "") {
        recipes[id] = newRecipe;
    } else {
        recipes.push(newRecipe);
    }

    Store.setUserData('recipes', recipes);
    closeModal();
    renderRecipesGrid();
    showToast('Receita salva com sucesso!');
}

function renderRecipesGrid() {
    const recipes = Store.getUserData('recipes');
    const grid = document.getElementById('recipes-grid');
    grid.innerHTML = '';

    recipes.forEach((r, i) => {
        grid.innerHTML += `
            <div class="bg-white dark:bg-zinc-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-zinc-700 animate-pop-in">
                <div class="flex justify-between items-start mb-4">
                    <h3 class="font-bold text-lg">${r.title}</h3>
                    <button onclick="toggleFavorite(${i})" class="text-gray-300 hover:text-yellow-400"><i class="fas fa-star"></i></button>
                </div>
                <div class="space-y-2 mb-6">
                    <div class="flex justify-between text-xs">
                        <span class="text-gray-400">Preço Sugerido:</span>
                        <span class="font-bold text-primary">${formatCurrency(r.salePrice)}</span>
                    </div>
                    <div class="flex justify-between text-xs">
                        <span class="text-gray-400">Custo Unitário:</span>
                        <span class="font-bold">${formatCurrency(r.unitCost)}</span>
                    </div>
                    <div class="flex justify-between text-xs">
                        <span class="text-gray-400">Lucro p/ Unidade:</span>
                        <span class="font-bold text-green-500">${formatCurrency(r.profitValue)}</span>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <button onclick="openRecipeEditor(${i})" class="flex-1 py-2 bg-gray-100 dark:bg-zinc-700 rounded-xl text-xs font-bold">Editar</button>
                    <button onclick="deleteRecipe(${i})" class="p-2 text-red-400"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    });
}

function deleteRecipe(index) {
    if (!confirm('Excluir esta receita?')) return;
    const recs = Store.getUserData('recipes');
    recs.splice(index, 1);
    Store.setUserData('recipes', recs);
    renderRecipesGrid();
}

// --- SETTINGS ---
function renderSettings() {
    const settings = Store.getSettings();
    document.getElementById('cfg-salary').value = settings.salary;
    document.getElementById('cfg-hours-month').value = settings.hours;
    
    const fcList = document.getElementById('fixed-costs-list');
    fcList.innerHTML = '';
    settings.fixedCosts.forEach((fc, i) => {
        fcList.innerHTML += `
            <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-900 rounded-xl">
                <span class="text-sm">${fc.name}</span>
                <div class="flex items-center space-x-3">
                    <span class="font-bold text-sm">${formatCurrency(fc.value)}</span>
                    <button onclick="removeFixedCost(${i})" class="text-red-400 text-xs"><i class="fas fa-times"></i></button>
                </div>
            </div>
        `;
    });
}

function addFixedCostPrompt() {
    const name = prompt('Nome da Despesa (ex: Aluguel):');
    const value = parseFloat(prompt('Valor Mensal (R$):'));
    if (name && value) {
        const settings = Store.getSettings();
        settings.fixedCosts.push({ name, value });
        Store.save();
        renderSettings();
    }
}

function removeFixedCost(i) {
    const settings = Store.getSettings();
    settings.fixedCosts.splice(i, 1);
    Store.save();
    renderSettings();
}

function updateLaborRate() {
    const salary = parseFloat(document.getElementById('cfg-salary').value) || 3000;
    const hours = parseFloat(document.getElementById('cfg-hours-month').value) || 160;
    
    const settings = Store.getSettings();
    settings.salary = salary;
    settings.hours = hours;
    Store.save();

    const rate = salary / hours;
    document.getElementById('display-labor-rate').innerText = formatCurrency(rate);
}

// --- ADMIN PANEL ---
function renderAdminPanel() {
    const tbody = document.getElementById('admin-users-table');
    tbody.innerHTML = '';
    
    Store.db.users.forEach(user => {
        if (user.role === 'admin') return;
        tbody.innerHTML += `
            <tr class="border-b border-gray-50 dark:border-zinc-800">
                <td class="p-4">
                    <p class="font-bold">${user.name}</p>
                    <p class="text-xs text-gray-400">${user.email}</p>
                </td>
                <td class="p-4">
                    <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase ${user.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}">
                        ${user.status}
                    </span>
                </td>
                <td class="p-4 text-xs">
                    ${user.expiresAt ? new Date(user.expiresAt).toLocaleDateString() : 'Ilimitado'}
                </td>
                <td class="p-4 text-right">
                    <button onclick="adminAction('${user.id}', 'toggleStatus')" class="text-accent mr-3"><i class="fas ${user.status === 'active' ? 'fa-user-slash' : 'fa-user-check'}"></i></button>
                    <button onclick="adminAction('${user.id}', 'setExpiry')" class="text-gray-400 mr-3"><i class="fas fa-clock"></i></button>
                    <button onclick="adminAction('${user.id}', 'delete')" class="text-red-500"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

function adminAction(userId, action) {
    const user = Store.db.users.find(u => u.id === userId);
    if (!user) return;

    if (action === 'toggleStatus') {
        user.status = user.status === 'active' ? 'blocked' : 'active';
    } else if (action === 'delete') {
        if (!confirm('Excluir este usuário permanentemente?')) return;
        Store.db.users = Store.db.users.filter(u => u.id !== userId);
    } else if (action === 'setExpiry') {
        const days = prompt('Dias de acesso (0 para ilimitado):', '30');
        if (days === '0') {
            user.expiresAt = null;
        } else {
            const date = new Date();
            date.setDate(date.getDate() + parseInt(days));
            user.expiresAt = date.toISOString();
        }
    }
    Store.save();
    renderAdminPanel();
}

// --- EXPORTS & REPORTS ---
async function generateFullReport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const recipes = Store.getUserData('recipes');
    
    doc.setFontSize(20);
    doc.text('Relatório Preço Certo', 15, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 15, 28);
    
    const tableData = recipes.map(r => [
        r.title, 
        r.yield, 
        formatCurrency(r.unitCost), 
        formatCurrency(r.salePrice), 
        r.profitMargin + '%'
    ]);

    doc.autoTable({
        startY: 35,
        head: [['Receita', 'Rendimento', 'Custo Un.', 'Venda Un.', 'Margem']],
        body: tableData,
    });

    doc.save('Relatorio_PrecoCerto.pdf');
}

function exportToExcel() {
    const recipes = Store.getUserData('recipes');
    const ingredients = Store.getUserData('ingredients');
    
    const wb = XLSX.utils.book_new();
    
    const wsRecipes = XLSX.utils.json_to_sheet(recipes.map(r => ({
        Nome: r.title,
        Rendimento: r.yield,
        Custo_Unitario: r.unitCost,
        Preco_Venda: r.salePrice,
        Lucro_Valor: r.profitValue,
        Margem_Porcentagem: r.profitMargin
    })));
    XLSX.utils.book_append_sheet(wb, wsRecipes, "Receitas");
    
    const wsIng = XLSX.utils.json_to_sheet(ingredients.map(i => ({
        Nome: i.name,
        Qtd: i.qty,
        Unidade: i.unit,
        Preco: i.price,
        Custo_Base: i.costPerBaseUnit
    })));
    XLSX.utils.book_append_sheet(wb, wsIng, "Ingredientes");

    XLSX.writeFile(wb, "Dados_PrecoCerto.xlsx");
}

function exportBackup() {
    const data = JSON.stringify(Store.db);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_precocerto_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.users) {
                Store.db = data;
                Store.save();
                showToast('Backup restaurado com sucesso!');
                setTimeout(() => location.reload(), 1000);
            }
        } catch (err) {
            showToast('Arquivo de backup inválido', 'error');
        }
    };
    reader.readAsText(file);
}

// --- TUTORIAL ---
let currentTutorialStep = 0;
const tutorialSteps = [
    { title: 'Passo 1: Insumos', text: 'Cadastre seus ingredientes e embalagens aqui. Informe marca, preço pago e quantidade.', icon: 'fa-egg' },
    { title: 'Passo 2: Receitas', text: 'Crie suas receitas. Você pode criar quantas quiser!', icon: 'fa-utensils' },
    { title: 'Passo 3: Adicionar Itens', text: 'Dentro da receita, adicione os ingredientes. Nós fazemos as conversões automáticas (kg para g, l para ml)!', icon: 'fa-plus-circle' },
    { title: 'Passo 4: Mão de Obra', text: 'Informe o tempo gasto. Calculamos o custo da sua hora automaticamente!', icon: 'fa-clock' },
    { title: 'Passo 5: Planilhas e PDF', text: 'Gere relatórios profissionais em PDF ou Excel para controle total do seu negócio.', icon: 'fa-file-excel' },
    { title: 'Passo 6: Instale o App', text: 'Clique em "Instalar App" para ter o Preço Certo na sua tela inicial e usar offline.', icon: 'fa-mobile-alt' }
];

function startTutorial() {
    currentTutorialStep = 0;
    showTutorialStep();
    document.getElementById('tutorial-overlay').classList.remove('hidden');
}

function showTutorialStep() {
    const step = tutorialSteps[currentTutorialStep];
    document.getElementById('tutorial-step-icon').innerHTML = `<i class="fas ${step.icon}"></i>`;
    document.getElementById('tutorial-step-title').innerText = step.title;
    document.getElementById('tutorial-step-text').innerText = step.text;
    
    const dots = document.getElementById('tutorial-dots');
    dots.innerHTML = tutorialSteps.map((_, i) => `
        <div class="h-1.5 w-1.5 rounded-full ${i === currentTutorialStep ? 'bg-primary w-4' : 'bg-gray-300'} transition-all"></div>
    `).join('');

    document.getElementById('tutorial-next-btn').innerText = currentTutorialStep === tutorialSteps.length - 1 ? 'Começar Agora!' : 'Próximo';
}

function nextTutorialStep() {
    if (currentTutorialStep < tutorialSteps.length - 1) {
        currentTutorialStep++;
        showTutorialStep();
    } else {
        skipTutorial();
    }
}

function skipTutorial() {
    document.getElementById('tutorial-overlay').classList.add('hidden');
    Store.db.tutorialCompleted[Store.db.currentUser.id] = true;
    Store.save();
}

function resetTutorial() {
    Store.db.tutorialCompleted[Store.db.currentUser.id] = false;
    Store.save();
    location.reload();
}

// --- UTILS ---
function formatCurrency(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toast-message');
    const iconEl = document.getElementById('toast-icon');
    
    msgEl.innerText = msg;
    toast.style.borderColor = type === 'success' ? '#E53935' : (type === 'error' ? '#EF4444' : '#1976D2');
    iconEl.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle')}"></i>`;
    iconEl.style.color = toast.style.borderColor;
    
    toast.classList.remove('hidden');
    setTimeout(() => closeToast(), 4000);
}

function closeToast() {
    document.getElementById('toast').classList.add('hidden');
}

function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
}

function toggleUserMenu() {
    document.getElementById('user-menu').classList.toggle('hidden');
}

// --- PWA INSTALL ---
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('install-container').classList.remove('hidden');
});

document.getElementById('install-btn').addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            document.getElementById('install-container').classList.add('hidden');
        }
        deferredPrompt = null;
    }
});

// START
Store.load();
initApp();

// REGISTER SERVICE WORKER
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            console.log('Service Worker registrado!', reg);
        }).catch(err => {
            console.log('Erro ao registrar SW:', err);
        });
    });
}
