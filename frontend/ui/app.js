const SERVER_IP = window.location.hostname;
const API_BASE = `http://${SERVER_IP}:5000/api`;
const API_BASE = '/api';
let currentData = null;
let chartInstance = null;
let scenarios = [];
let currentScenarioId = 'base';
let selectedCenters = [];
let localOverrides = [];
let centerConfigs = {}; // Estructura: { "CentroID": { shifts: 8|16|24 } }
let updateTimeout;
let isComparisonMode = false;
let comparisonData = null;
function debounce(func, wait) {
    return function (...args) {
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(() => func.apply(this, args), wait);
    };
}
function setLoading(isLoading) {
    const main = document.querySelector('main');
    if (!main) return;
    if (isLoading) {
        main.classList.add('loading');
    } else {
        main.classList.remove('loading');
    }
}
document.addEventListener('DOMContentLoaded', () => {
    console.log("App iniciada. Configurando listeners...");
    setupEventListeners();
    initApp();
});
async function initApp() {
    isComparisonMode = false;
    const compBox = document.getElementById('comparison-controls');
    if (compBox) compBox.style.display = 'none';
    await loadScenarios();
    await loadSimulation('base');
}
async function loadScenarios() {
    try {
        const response = await fetch(`${API_BASE}/scenarios`);
        scenarios = await response.json();
        const compareA = document.getElementById('compare-a');
        const compareB = document.getElementById('compare-b');
        if (compareA && compareB) {
            const options = ['<option value="base">Base</option>', ...scenarios.map(s => `<option value="${s.id}">${s.name}</option>`)];
            compareA.innerHTML = options.join('');
            compareB.innerHTML = options.join('');
        }
    } catch (error) {
        console.error('Error loading scenarios:', error);
    }
}
async function loadSimulation(scenarioId) {
    const days = document.getElementById('work-days').value || 238;
    const shifts = document.getElementById('work-shifts').value || 16;
    if (scenarioId !== 'base') {
        localOverrides = [];
        centerConfigs = {};
    }
    const url = scenarioId === 'base'
        ? `${API_BASE}/simulate/base?dias_laborales=${days}&horas_turno=${shifts}`
        : `${API_BASE}/simulate/${scenarioId}?dias_laborales=${days}&horas_turno=${shifts}`;
    document.getElementById('current-scenario-name').innerText = 'Cargando datos...';
    setLoading(true);
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        currentData = await response.json();
        currentScenarioId = scenarioId;
        const sName = scenarioId === 'base' ? 'Escenario Base' : scenarios.find(s => s.id == scenarioId)?.name || 'Escenario';
        document.getElementById('current-scenario-name').innerText = sName;
        if (scenarioId !== 'base' && currentData.meta) {
            document.getElementById('work-days').value = currentData.meta.dias_laborales || 238;
            document.getElementById('work-shifts').value = currentData.meta.horas_turno_global || 16;
            centerConfigs = currentData.meta.center_configs || {};
        }
        populateWorkCenters();
        updateNavItemActive(scenarioId);
        updateUI();
    } catch (error) {
        console.error('Error loading simulation:', error);
        document.getElementById('current-scenario-name').innerText = 'Error de conexión';
    } finally {
        setLoading(false);
    }
}
function updateNavItemActive(id) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    if (id === 'base') {
        document.getElementById('btn-base')?.classList.add('active');
    } else {
        document.getElementById('btn-manage')?.classList.add('active');
    }
}
function updateUI() {
    if (isComparisonMode) {
        renderComparisonDashboard();
        return;
    }
    if (!currentData || !currentData.summary || currentData.summary.length === 0) {
        document.getElementById('summary-stats').innerHTML = '<div class="stat-item">No hay datos</div>';
        return;
    }
    let filteredSummary = [...currentData.summary];
    let filteredDetail = [...currentData.detail];
    const isFiltered = selectedCenters.length > 0 && !selectedCenters.includes('all');
    if (isFiltered) {
        const selectedSet = new Set(selectedCenters.map(val => String(val).trim()));
        filteredSummary = currentData.summary.filter(s => selectedSet.has(String(s.Centro).trim()));
        filteredDetail = currentData.detail.filter(d => selectedSet.has(String(d.Centro).trim()));
    }
    renderChart(filteredSummary);
    renderSummary(filteredSummary, isFiltered);
    renderTable(filteredDetail);
}
function renderChart(summary) {
    const ctx = document.getElementById('saturationChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: summary.map(s => s.Centro),
            datasets: [{
                label: '% Saturación Media',
                data: summary.map(s => (s.Saturacion * 100).toFixed(1)),
                backgroundColor: summary.map(s => s.Saturacion > 0.85 ? '#dc3545' : (s.Saturacion > 0.7 ? '#ffc107' : '#28a745')),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#2d2d35' }, ticks: { color: '#a0a0a0' } },
                x: { grid: { display: false }, ticks: { color: '#a0a0a0' } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}
function renderSummary(summary, isFiltered) {
    const container = document.getElementById('summary-stats');
    if (!summary || summary.length === 0) {
        container.innerHTML = '<div class="stat-item">No hay datos</div>';
        return;
    }
    const avgSat = (summary.reduce((acc, current) => acc + (current.Saturacion || 0), 0) / summary.length * 100).toFixed(1);
    const totalDemanda = summary.reduce((acc, current) => acc + (current['Volumen anual'] || 0), 0).toLocaleString();
    container.innerHTML = `
        <div class="stat-item">
            <div class="stat-val ${avgSat > 85 ? 'rpk-red-text' : ''}">${avgSat}%</div>
            <div class="stat-label">Saturación Media ${isFiltered ? '(Sectores)' : ''}</div>
        </div>
        <div class="stat-item">
            <div class="stat-val">${summary.length}</div>
            <div class="stat-label">Centros ${isFiltered ? 'Filtrados' : 'Totales'}</div>
        </div>
        <div class="stat-item">
            <div class="stat-val">${totalDemanda}</div>
            <div class="stat-label">Demanda Total (pzs)</div>
        </div>
    `;
}
function renderTable(detail) {
    const body = document.getElementById('table-body');
    const search = document.getElementById('table-search').value.toLowerCase();
    const totalGroupDemand = detail.reduce((acc, d) => acc + (d['Volumen anual'] || 0), 0);
    let filtered = detail;
    if (search) filtered = filtered.filter(d => d.Articulo.toString().toLowerCase().includes(search));
    body.innerHTML = filtered.slice(0, 100).map(d => {
        const sat = (d.Saturacion * 100).toFixed(1);
        const satClass = sat > 85 ? 'pill-high' : (sat > 70 ? 'pill-mid' : 'pill-low');
        const impact = totalGroupDemand > 0 ? ((d['Volumen anual'] / totalGroupDemand) * 100).toFixed(1) : 0;
        const globalShifts = document.getElementById('work-shifts').value || 16;
        const centerSpecificShift = centerConfigs[d.Centro]?.shifts;
        const shifts = d.horas_turno_override || centerSpecificShift || globalShifts;
        return `
            <tr>
                <td><strong>${d.Articulo}</strong></td>
                <td class="text-center">
                    <span class="center-tag">${d.Centro}</span>
                </td>
                <td class="text-right">${d['Volumen anual'].toLocaleString()}</td>
                <td class="text-right">${Math.round(d['Piezas por minuto'])}</td>
                <td class="text-right">${(d['%OEE'] * 100).toFixed(1)}%</td>
                <td class="text-center">
                    <span class="saturation-pill ${satClass}">${sat}%</span>
                </td>
                <td class="text-right">
                    <div class="impact-bar-container">
                        <div class="impact-bar" style="width: ${impact}%"></div>
                    </div>
                    <span style="font-size:0.75rem; color:var(--text-muted)">${impact}%</span>
                </td>
                <td class="text-center">
                    <button class="btn btn-secondary btn-simular" 
                        style="padding: 0.3rem 0.6rem; font-size: 0.7rem;"
                        data-articulo="${d.Articulo}" 
                        data-centro="${d.Centro}">Ajustar</button>
                </td>
            </tr>
        `;
    }).join('');
}
function populateWorkCenters() {
    const select = document.getElementById('work-center');
    if (!select || !currentData.detail) return;
    const centers = [...new Set(currentData.detail.map(d => d.Centro))].sort();
    const options = [`<option value="all" ${selectedCenters.includes('all') ? 'selected' : ''}>-- Todos los Centros --</option>`];
    centers.forEach(c => {
        const isSelected = selectedCenters.includes(String(c));
        options.push(`<option value="${c}" ${isSelected ? 'selected' : ''}>${c}</option>`);
    });
    select.innerHTML = options.join('');
}
function setupEventListeners() {
    document.getElementById('table-body').onclick = (e) => {
        if (e.target.classList.contains('btn-simular')) {
            openEditModal(e.target.getAttribute('data-articulo'), e.target.getAttribute('data-centro'));
        }
    };
    document.getElementById('btn-base').onclick = () => {
        localOverrides = [];
        centerConfigs = {};
        currentScenarioId = 'base';
        loadSimulation('base');
    };
    document.getElementById('work-days').oninput = debounce(() => updatePreviewSimulation(), 500);
    document.getElementById('work-shifts').onchange = () => updatePreviewSimulation();
    document.getElementById('btn-apply-filter').onclick = () => {
        const select = document.getElementById('work-center');
        selectedCenters = Array.from(select.options).filter(o => o.selected).map(o => o.value);
        updateUI();
    };
    document.getElementById('btn-clear-filter').onclick = () => {
        const select = document.getElementById('work-center');
        Array.from(select.options).forEach(o => o.selected = false);
        selectedCenters = [];
        updateUI();
    };
    document.getElementById('table-search').oninput = () => updateUI();
    const editForm = document.getElementById('edit-form');
    if (editForm) {
        editForm.onsubmit = async (e) => {
            e.preventDefault();
            const articulo = document.getElementById('edit-articulo').value;
            const centroBase = document.getElementById('edit-centro').value;
            const oee = parseFloat(document.getElementById('edit-oee').value) / 100 || 0;
            const ppm = parseFloat(document.getElementById('edit-ppm').value) || 0;
            const demanda = parseFloat(document.getElementById('edit-demanda').value) || 0;
            const new_centro = document.getElementById('edit-new-centro').value;
            const shifts = document.getElementById('edit-shifts').value;
            const override = {
                articulo,
                centro: centroBase,
                oee_override: oee,
                ppm_override: ppm,
                demanda_override: demanda,
                new_centro: new_centro,
                horas_turno_override: shifts ? parseInt(shifts) : null
            };
            const idx = localOverrides.findIndex(o => o.articulo == articulo && o.centro == centroBase);
            if (idx >= 0) localOverrides[idx] = override;
            else localOverrides.push(override);
            document.getElementById('edit-modal').style.display = 'none';
            await updatePreviewSimulation();
        };
    }
    document.getElementById('cancel-edit').onclick = () => {
        document.getElementById('edit-modal').style.display = 'none';
    };
    document.getElementById('btn-new').onclick = async () => {
        const name = prompt("Nombre del nuevo escenario:");
        if (!name) return;
        const days = parseInt(document.getElementById('work-days').value);
        const shifts = parseInt(document.getElementById('work-shifts').value);
        try {
            const res = await fetch(`${API_BASE}/scenarios`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    dias_laborales: days,
                    horas_turno_global: shifts,
                    center_configs: centerConfigs,
                    overrides: localOverrides
                })
            });
            if (res.ok) {
                alert("Escenario guardado!");
                await loadScenarios();
                const s = await res.json();
                loadSimulation(s.id);
            } else {
                const error = await res.json();
                alert(error.detail || "Error al guardar!");
            }
        } catch (e) { console.error(e); }
    };
    document.getElementById('btn-compare').onclick = () => document.getElementById('compare-modal').style.display = 'block';
    document.getElementById('run-compare').onclick = runCompare;
    document.getElementById('btn-exit-compare').onclick = exitComparisonMode;
    document.getElementById('btn-manage').onclick = () => { renderManageList(); document.getElementById('manage-modal').style.display = 'block'; };
    const closeHandlers = document.querySelectorAll('.close, .close-manage');
    closeHandlers.forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        };
    });
    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };
}
async function updatePreviewSimulation() {
    const days = document.getElementById('work-days').value || 238;
    const shifts = document.getElementById('work-shifts').value || 16;
    setLoading(true);
    try {
        const res = await fetch(`${API_BASE}/simulate/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                overrides: localOverrides,
                dias_laborales: parseInt(days),
                horas_turno: parseInt(shifts),
                center_configs: centerConfigs
            })
        });
        currentData = await res.json();
        updateUI();
    } catch (e) { console.error(e); }
    finally {
        setLoading(false);
    }
}
function openEditModal(articulo, centro) {
    const d = currentData.detail.find(item => item.Articulo == articulo && item.Centro == centro);
    if (!d) return;
    document.getElementById('edit-articulo').value = articulo;
    document.getElementById('edit-centro').value = centro;
    document.getElementById('display-articulo').innerText = articulo;
    document.getElementById('edit-oee').value = (d['%OEE'] * 100).toFixed(2);
    document.getElementById('edit-ppm').value = Math.round(d['Piezas por minuto']);
    document.getElementById('edit-demanda').value = Math.round(d['Volumen anual']);
    document.getElementById('edit-shifts').value = d.horas_turno_override || "";
    const centers = [...new Set(currentData.detail.map(item => item.Centro))].sort();
    document.getElementById('edit-new-centro').innerHTML = centers.map(c => `<option value="${c}" ${c == centro ? 'selected' : ''}>${c}</option>`).join('');
    document.getElementById('edit-modal').style.display = 'block';
}
function renderManageList() {
    const container = document.getElementById('manage-list-container');
    container.innerHTML = scenarios.map(s => `
        <div class="card" style="margin-bottom: 0.5rem; padding: 1rem; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 600;">${s.name}</span>
            <div style="display: flex; gap: 8px;">
                <button class="btn btn-primary" onclick="loadAndClose(${s.id})" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">Cargar</button>
                <button class="btn btn-secondary" onclick="deleteScenarioInline(${s.id})" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; color: #ff4444;">Borrar</button>
            </div>
        </div>
    `).join('');
}
window.deleteScenarioInline = async (id) => {
    if (!confirm("¿Borrar escenario?")) return;
    try {
        const res = await fetch(`${API_BASE}/scenarios/${id}`, { method: 'DELETE' });
        if (res.ok) {
            await loadScenarios();
            renderManageList();
            if (currentScenarioId == id) loadSimulation('base');
        }
    } catch (e) { alert("Error al eliminar"); }
};
window.loadAndClose = (id) => {
    loadSimulation(id);
    document.getElementById('manage-modal').style.display = 'none';
};
async function runCompare() {
    const scA = document.getElementById('compare-a').value;
    const scB = document.getElementById('compare-b').value;
    try {
        const resA = await fetch(`${API_BASE}/simulate/${scA === 'base' ? 'base' : scA}`);
        const resB = await fetch(`${API_BASE}/simulate/${scB === 'base' ? 'base' : scB}`);
        comparisonData = {
            nameA: scA === 'base' ? 'Base' : scenarios.find(s => s.id == scA).name,
            nameB: scB === 'base' ? 'Base' : scenarios.find(s => s.id == scB).name,
            dataA: await resA.json(),
            dataB: await resB.json()
        };
        isComparisonMode = true;
        document.getElementById('compare-modal').style.display = 'none';
        enterComparisonMode();
    } catch (e) { console.error(e); }
}
function enterComparisonMode() {
    document.getElementById('comparison-controls').style.display = 'flex';
    renderComparisonDashboard();
}
function exitComparisonMode() {
    isComparisonMode = false;
    document.getElementById('comparison-controls').style.display = 'none';
    updateUI();
}
function renderComparisonDashboard() {
    const ctx = document.getElementById('saturationChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: comparisonData.dataA.summary.map(s => s.Centro),
            datasets: [
                { label: comparisonData.nameA, data: comparisonData.dataA.summary.map(s => (s.Saturacion * 100).toFixed(1)), backgroundColor: '#444' },
                { label: comparisonData.nameB, data: comparisonData.dataB.summary.map(s => (s.Saturacion * 100).toFixed(1)), backgroundColor: '#E30613' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#2d2d35' }, ticks: { color: '#a0a0a0' } },
                x: { grid: { display: false }, ticks: { color: '#a0a0a0' } }
            }
        }
    });
    renderComparisonSummary();
}
function renderComparisonSummary() {
    const container = document.getElementById('summary-stats');
    const avgA = (comparisonData.dataA.summary.reduce((acc, s) => acc + s.Saturacion, 0) / comparisonData.dataA.summary.length * 100).toFixed(1);
    const avgB = (comparisonData.dataB.summary.reduce((acc, s) => acc + s.Saturacion, 0) / comparisonData.dataB.summary.length * 100).toFixed(1);
    container.innerHTML = `
        <div class="stat-item">
            <div class="stat-val">${avgA}%</div>
            <div class="stat-label">Saturación Media (${comparisonData.nameA})</div>
        </div>
        <div class="stat-item" style="border-left-color: var(--rpk-red)">
            <div class="stat-val">${avgB}%</div>
            <div class="stat-label">Saturación Media (${comparisonData.nameB})</div>
        </div>
    `;
}