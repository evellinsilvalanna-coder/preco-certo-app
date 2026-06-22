// Restore app.js with PWA logic

const Store = {
    data: { insumos: [], receitas: [], fixedCosts: [] },
    load() { const saved = localStorage.getItem('precocerto_data'); if(saved) this.data = JSON.parse(saved); },
    save() { localStorage.setItem('precocerto_data', JSON.stringify(this.data)); }
};

function initApp() { 
    showView('dashboard');
    updateStats();
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-' + viewId).classList.remove('hidden');
}

function updateStats() {
    document.getElementById('stat-recipes').innerText = Store.data.receitas.length;
    document.getElementById('stat-ingredients').innerText = Store.data.insumos.length;
}

// PWA Installation
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const container = document.getElementById('install-container');
    if (container) {
        container.classList.remove('hidden');
        container.style.display = 'flex';
    }
});

document.getElementById('install-btn')?.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            document.getElementById('install-container')?.classList.add('hidden');
        }
        deferredPrompt = null;
    }
});

Store.load();
initApp();
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('./sw.js'); }