const API_BASE = '/api';
let currentData = null;
let baseData = null;
let chartInstance = null;
let scenarios = [];
let currentScenarioId = 'base';
let selectedCenters = [];
let localOverrides = [];
let centerConfigs = {};
let updateTimeout;
let isComparisonMode = false;
let comparisonData = null;
let comparisonViewMode = 'absolute'; // 'absolute' or 'delta'

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
        if (scenarioId === 'base') baseData = currentData;

        currentScenarioId = scenarioId;
        const sName = scenarioId === 'base' ? 'Escenario Base' : scenarios.find(s => s.id == scenarioId)?.name || 'Escenario';
        document.getElementById('current-scenario-name').innerText = sName;

        if (scenarioId !== 'base' && currentData.meta) {
            document.getElementById('work-days').value = currentData.meta.dias_laborales || 238;
            document.getElementById('work-shifts').value = currentData.meta.horas_turno_global || 16;
            centerConfigs = currentData.meta.center_configs || {};
            localOverrides = currentData.meta.applied_overrides || [];

            // Map original values from baseData for diff visualization
            localOverrides.forEach(ov => {
                const baseItem = baseData?.detail.find(d => d.Articulo == ov.articulo && d.Centro == ov.centro);
                if (baseItem) {
                    ov.original_oee = baseItem['%OEE'];
                    ov.original_ppm = baseItem['Piezas por minuto'];
                    ov.original_demanda = baseItem['Volumen anual'];
                    ov.original_shifts = baseItem['horas_turno'] || 16;
                    ov.original_mod = baseItem['Ratio_MOD'] || 1.0;
                }
            });
        }

        renderLocalOverrides();
        if (scenarioId !== 'base') {
            loadScenarioHistory(scenarioId);
        } else {
            const histList = document.getElementById('history-list');
            if (histList) histList.innerHTML = '<p class="empty-msg">No hay histórico para Base</p>';
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
    document.querySelectorAll('.nav-tab').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    if (id === 'base') {
        document.getElementById('btn-base')?.classList.add('active');
    } else {
        // En Gestionar no lo activamos directamente sino al cargar
    }
}

function updateUI() {
    if (isComparisonMode) {
        renderComparisonDashboard();
        renderComparisonTable();
        return;
    }

    if (!currentData || !currentData.summary) return;

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
                label: '% Saturación',
                data: summary.map(s => (s.Saturacion * 100).toFixed(1)),
                backgroundColor: summary.map(s => s.Saturacion > 0.85 ? '#E30613' : (s.Saturacion > 0.7 ? '#feca57' : '#1dd1a1')),
                borderRadius: 4,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: Math.max(100, ...summary.map(s => s.Saturacion * 100)) + 10,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#a0a0a0', font: { size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#a0a0a0', font: { size: 10 } }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a1a20',
                    titleColor: '#fff',
                    bodyColor: '#a0a0a0',
                    borderColor: '#444',
                    borderWidth: 1
                }
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

    const totalHorasH = summary.reduce((acc, current) => acc + (current.Horas_Hombre || 0), 0);
    const avgSat = (summary.reduce((acc, current) => acc + (current.Saturacion || 0), 0) / summary.length * 100).toFixed(1);
    const totalDemanda = summary.reduce((acc, current) => acc + (current['Volumen anual'] || 0), 0);

    // FTE Calculation: Total Horas / (dias * 8h)
    const days = document.getElementById('work-days').value || 238;
    const fte = (totalHorasH / (days * 8)).toFixed(1);

    container.innerHTML = `
        <div class="stat-item">
            <div class="stat-val ${avgSat > 85 ? 'rpk-red-text' : ''}">${avgSat}%</div>
            <div class="stat-label">Saturación Media</div>
        </div>
        <div class="stat-item">
            <div class="stat-val">${fte}</div>
            <div class="stat-label">Headcount (FTE)</div>
        </div>
        <div class="stat-item">
            <div class="stat-val">${totalDemanda.toLocaleString()}</div>
            <div class="stat-label">Demanda Total (pzs)</div>
        </div>
    `;
}

function renderTable(detail) {
    const body = document.getElementById('table-body');
    if (!body) return;
    const search = document.getElementById('table-search').value.toLowerCase();

    const totalGroupDemand = detail.reduce((acc, d) => acc + (d['Volumen anual'] || 0), 0);

    let filtered = detail;
    if (search) {
        filtered = filtered.filter(d =>
            d.Articulo.toString().toLowerCase().includes(search) ||
            d.Centro.toString().toLowerCase().includes(search)
        );
    }

    body.innerHTML = filtered.slice(0, 100).map(d => {
        const sat = (d.Saturacion * 100).toFixed(1);
        const satClass = sat > 85 ? 'pill-high' : (sat > 70 ? 'pill-mid' : 'pill-low');
        const impact = totalGroupDemand > 0 ? ((d['Volumen anual'] / totalGroupDemand) * 100).toFixed(1) : 0;

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
                    ${(d.Ratio_MOD || 1.0).toFixed(1)}
                </td>
                <td class="text-right">
                    <span style="font-size:0.75rem; color:var(--text-muted)">${impact}%</span>
                </td>
                <td class="text-center">
                    <button class="action-btn small btn-simular" 
                        data-articulo="${d.Articulo}" 
                        data-centro="${d.Centro}">Ajustar</button>
                </td>
            </tr>
        `;
    }).join('');
}

function populateWorkCenters() {
    const list = document.getElementById('work-center-options');
    if (!list) return; // For root frontend might be different
    if (!currentData.detail) return;

    const centers = [...new Set(currentData.detail.map(d => d.Centro))].sort();

    let html = `
        <div class="checkbox-item">
            <input type="checkbox" id="cb-all" onchange="toggleSelectAll()" ${selectedCenters.length === 0 || selectedCenters.includes('all') ? 'checked' : ''}>
            <span style="margin-left:8px;">-- Todos los Centros --</span>
        </div>
    `;

    centers.forEach(c => {
        const isChecked = selectedCenters.includes(String(c)) && !selectedCenters.includes('all');
        const config = centerConfigs[String(c)] || {};
        const activeShift = config.shifts || 16;

        html += `
            <div class="checkbox-item work-center-row">
                <div class="wc-check-part">
                    <input type="checkbox" id="cb-${c}" onchange="toggleOption('${c}')" ${isChecked ? 'checked' : ''}>
                    <span class="wc-label">${c}</span>
                </div>
                <div class="wc-shifts-part">
                    <button class="shift-btn ${activeShift == 8 ? 'active shadow-lg border-white' : ''}" onclick="setCenterShift('${c}', 8, event)">1T</button>
                    <button class="shift-btn ${activeShift == 16 ? 'active shadow-lg border-white' : ''}" onclick="setCenterShift('${c}', 16, event)">2T</button>
                    <button class="shift-btn ${activeShift == 24 ? 'active shadow-lg border-white' : ''}" onclick="setCenterShift('${c}', 24, event)">3T</button>
                </div>
            </div>
        `;
    });

    list.innerHTML = html;
}

async function setCenterShift(centro, shifts, event) {
    if (event) event.stopPropagation();
    if (!centerConfigs[String(centro)]) centerConfigs[String(centro)] = {};
    centerConfigs[String(centro)].shifts = shifts;
    populateWorkCenters();
    await updatePreviewSimulation();
}

function setupEventListeners() {
    const tableBody = document.getElementById('table-body');
    if (tableBody) {
        tableBody.onclick = (e) => {
            if (e.target.classList.contains('btn-simular')) {
                openEditModal(e.target.getAttribute('data-articulo'), e.target.getAttribute('data-centro'));
            }
        };
    }

    document.getElementById('btn-base').onclick = () => {
        localOverrides = [];
        centerConfigs = {};
        currentScenarioId = 'base';
        loadSimulation('base');
    };

    document.getElementById('work-days').oninput = debounce(() => updatePreviewSimulation(), 500);
    document.getElementById('work-shifts').onchange = () => updatePreviewSimulation();

    const applyFilter = document.getElementById('btn-apply-filter');
    if (applyFilter) applyFilter.onclick = () => updateUI();

    document.getElementById('btn-clear-filter').onclick = () => {
        selectedCenters = ['all'];
        populateWorkCenters();
        updateUI();
    };

    document.getElementById('table-search').oninput = () => updateUI();

    const editForm = document.getElementById('edit-form');
    if (editForm) {
        editForm.onsubmit = async (e) => {
            e.preventDefault();
            const articulo = document.getElementById('edit-articulo').value;
            const centroBase = document.getElementById('edit-centro').value;
            const oee = parseFloat(document.getElementById('edit-oee').value) / 100 || null;
            const ppm = parseFloat(document.getElementById('edit-ppm').value) || null;
            const demanda = parseFloat(document.getElementById('edit-demanda').value) || null;
            const new_centro = document.getElementById('edit-new-centro').value;
            const shifts = document.getElementById('edit-shifts').value;
            const setup = parseFloat(document.getElementById('edit-setup').value) || null;
            const mod = parseFloat(document.getElementById('edit-mod').value) || null;

            const override = {
                articulo,
                centro: centroBase,
                oee_override: oee,
                ppm_override: ppm,
                demanda_override: demanda,
                new_centro: new_centro || null,
                horas_turno_override: shifts ? parseInt(shifts) : null,
                setup_time_override: setup,
                personnel_ratio_override: mod
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

    document.getElementById('btn-new').onclick = () => {
        document.getElementById('new-scenario-name').value = '';
        document.getElementById('save-modal').style.display = 'flex';
    };

    document.getElementById('btn-save-new-confirm').onclick = async () => {
        const name = document.getElementById('new-scenario-name').value;
        if (!name) return alert("Indica un nombre");

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
                document.getElementById('save-modal').style.display = 'none';
                await loadScenarios();
                const s = await res.json();
                loadSimulation(s.id);
            } else {
                const error = await res.json();
                alert(error.detail || "Error al guardar");
            }
        } catch (e) { console.error(e); }
    };

    document.getElementById('btn-compare').onclick = () => {
        document.getElementById('compare-modal').style.display = 'flex';
    };

    document.getElementById('run-compare').onclick = runCompare;

    const exitCompare = document.getElementById('btn-exit-compare');
    if (exitCompare) exitCompare.onclick = exitComparisonMode;

    document.getElementById('btn-manage').onclick = () => {
        renderManageList();
        document.getElementById('manage-modal').style.display = 'flex';
    };

    document.querySelectorAll('.close, .close-manage').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        };
    });
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
        renderLocalOverrides();
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

    const existingOverride = localOverrides.find(o => o.articulo == articulo && o.centro == centro);
    document.getElementById('edit-shifts').value = (existingOverride && existingOverride.horas_turno_override) ? existingOverride.horas_turno_override : "";
    document.getElementById('edit-setup').value = (existingOverride && existingOverride.setup_time_override !== undefined) ? existingOverride.setup_time_override : (d['Setup (h)'] || 0);
    document.getElementById('edit-mod').value = (existingOverride && existingOverride.personnel_ratio_override) ? existingOverride.personnel_ratio_override : (d.Ratio_MOD || 1.0);

    const centers = [...new Set(currentData.detail.map(item => item.Centro))].sort();
    document.getElementById('edit-new-centro').innerHTML = centers.map(c => `<option value="${c}" ${c == centro ? 'selected' : ''}>${c}</option>`).join('');

    document.getElementById('edit-modal').style.display = 'flex';
}

function renderManageList() {
    const container = document.getElementById('manage-list-container');
    if (!container) return;
    container.innerHTML = scenarios.map(s => `
        <div class="card" style="margin-bottom: 0.5rem; padding: 1rem; display: flex; justify-content: space-between; align-items: center; background: var(--dark-surface-2)">
            <span style="font-weight: 600;">${s.name}</span>
            <div style="display: flex; gap: 8px;">
                <button class="action-btn small" onclick="loadAndClose(${s.id})">Cargar</button>
                <button class="action-btn small secondary" onclick="deleteScenarioInline(${s.id})" style="color: #ff4444;">Borrar</button>
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
    const banner = document.getElementById('comparison-controls');
    if (banner) banner.style.display = 'flex';
    renderComparisonDashboard();
    renderComparisonTable();
}

function exitComparisonMode() {
    isComparisonMode = false;
    document.getElementById('comparison-controls').style.display = 'none';
    updateUI();
}

function renderComparisonDashboard() {
    const ctx = document.getElementById('saturationChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const summaryA = comparisonData.dataA.summary;
    const summaryB = comparisonData.dataB.summary;
    const labels = summaryA.map(s => s.Centro);

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: comparisonData.nameA,
                    data: summaryA.map(s => (s.Saturacion * 100).toFixed(1)),
                    backgroundColor: '#666'
                },
                {
                    label: comparisonData.nameB,
                    data: summaryB.map(s => (s.Saturacion * 100).toFixed(1)),
                    backgroundColor: '#E30613'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderComparisonTable() {
    const body = document.getElementById('table-body');
    if (!body) return;

    const detailA = comparisonData.dataA.detail;
    const detailB = comparisonData.dataB.detail;

    body.innerHTML = detailB.slice(0, 100).map(dB => {
        const dA = detailA.find(item => item.Articulo == dB.Articulo && item.Centro == dB.Centro) || {};
        const sat = (dB.Saturacion * 100).toFixed(1);
        const satClass = sat > 85 ? 'pill-high' : (sat > 70 ? 'pill-mid' : 'pill-low');

        return `
            <tr>
                <td><strong>${dB.Articulo}</strong></td>
                <td class="text-center">${dB.Centro}</td>
                <td class="text-right">${dB['Volumen anual'].toLocaleString()}</td>
                <td class="text-right">${Math.round(dB['Piezas por minuto'])}</td>
                <td class="text-right">${((dB['%OEE'] || 0) * 100).toFixed(1)}%</td>
                <td class="text-center">
                    <span class="saturation-pill ${satClass}">${sat}%</span>
                </td>
                <td class="text-right">${(dB.Ratio_MOD || 1.0).toFixed(1)}</td>
                <td class="text-center">--</td>
            </tr>
        `;
    }).join('');
}

function renderLocalOverrides() {
    const list = document.getElementById('overrides-list');
    if (!list) return;
    list.innerHTML = localOverrides.map(ov => `
        <div class="override-item">
            <strong>${ov.articulo}</strong>: ${ov.new_centro || ov.centro}
        </div>
    `).join('') || '<p class="empty-state">No hay cambios aplicados</p>';
}

function renderScenarioHistory(id) { }