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
    const sidebars = document.querySelectorAll('.side-panel');
    if (isLoading) {
        if (main) main.classList.add('loading');
    } else {
        if (main) main.classList.remove('loading');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 RPK Simulator V3 Logic Initialized");
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
        : (scenarioId === 'actual'
            ? `${API_BASE}/simulate/actual?dias_laborales=${days}&horas_turno=${shifts}`
            : `${API_BASE}/simulate/${scenarioId}?dias_laborales=${days}&horas_turno=${shifts}`);

    document.getElementById('current-scenario-name').innerText = 'Cargando...';
    setLoading(true);

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        currentData = await response.json();
        if (scenarioId === 'base') baseData = currentData;

        currentScenarioId = scenarioId;
        const sName = scenarioId === 'base'
            ? 'Escenario Base'
            : (scenarioId === 'actual' ? 'Escenario Actual (Nexus v2)' : (scenarios.find(s => s.id == scenarioId)?.name || 'Escenario'));
        document.getElementById('current-scenario-name').innerText = sName;

        if (scenarioId !== 'base' && currentData.meta) {
            document.getElementById('work-days').value = currentData.meta.dias_laborales || 238;
            document.getElementById('work-shifts').value = currentData.meta.horas_turno_global || 16;
            centerConfigs = currentData.meta.center_configs || {};
            localOverrides = currentData.meta.applied_overrides || [];

            // Map original values from baseData for diff visualization
            localOverrides.forEach(ov => {
                const baseItem = baseData?.detail.find(d => d.Articulo == ov.articulo && d.Centro == (ov.centro_original || ov.centro));
                if (baseItem) {
                    ov.original_oee = baseItem['%OEE'];
                    ov.original_ppm = baseItem['Piezas por minuto'];
                    ov.original_demanda = baseItem['Volumen anual'];
                    ov.original_shifts = baseItem['horas_turno'] || 16;
                    ov.original_mod = baseItem['Ratio_MOD'] || 1.0;
                    ov.original_setup = baseItem['Setup (h)'] || 0;
                }
            });
        }

        renderLocalOverrides();
        if (scenarioId !== 'base') {
            loadScenarioHistory(scenarioId);
        } else {
            const historyContainer = document.getElementById('history-list');
            if (historyContainer) historyContainer.innerHTML = '<p class="empty-state">No hay histórico para Base</p>';
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
    if (isComparisonMode) {
        document.getElementById('btn-compare')?.classList.add('active');
    } else if (id === 'base') {
        document.getElementById('btn-base')?.classList.add('active');
    } else if (id === 'actual') {
        document.getElementById('btn-actual')?.classList.add('active');
    } else {
        document.getElementById('btn-manage')?.classList.add('active');
    }
}

function updateUI() {
    if (isComparisonMode) {
        if (currentData && comparisonData) {
            comparisonData.dataB = currentData;
        }
        renderComparisonDashboard();
        renderComparisonTable();
        renderExecutiveInsights();
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
                backgroundColor: summary.map(s => s.Saturacion > 0.85 ? '#E30613' : (s.Saturacion > 0.7 ? '#ffc107' : '#28a745')),
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
            plugins: { legend: { display: false } }
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
    const sumHH = summary.reduce((acc, c) => acc + (c.Horas_Hombre || 0), 0);
    const days = (currentData.meta ? currentData.meta.dias_laborales : 238) || 238;
    const fte = (sumHH / (days * 8)).toFixed(1);

    const sourceHtml = currentData.meta && currentData.meta.source_actual
        ? `<div style="font-size: 0.7rem; color: #ffc107; margin-bottom: 0.5rem; text-align: center; background: rgba(255,193,7,0.1); padding: 4px; border-radius: 4px;">📂 Fuente: ${currentData.meta.source_actual}</div>`
        : '';

    container.innerHTML = `
        ${sourceHtml}
        <div class="stat-item">
            <div class="stat-val ${avgSat > 85 ? 'rpk-red-text' : ''}">${avgSat}%</div>
            <div class="stat-label">Saturación Media ${isFiltered ? '(Sectores)' : ''}</div>
        </div>
        <div class="stat-item" style="border-left-color: #4facfe;">
            <div class="stat-val" style="color: #4facfe;">${fte}</div>
            <div class="stat-label">Operarios Necesarios (FTE)</div>
        </div>
        <div class="stat-item" style="border-left-color: #666;">
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
        const shifts = d.horas_turno || 16;

        return `
            <tr>
                <td><strong>${d.Articulo}</strong></td>
                <td class="text-center">
                    <div style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px; display: inline-block;">${d.Centro}</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">${shifts}h/día</div>
                </td>
                <td class="text-right">${d['Volumen anual'].toLocaleString()}</td>
                <td class="text-right">${Math.round(d['Piezas por minuto'])}</td>
                <td class="text-right">${(d['%OEE'] * 100).toFixed(1)}%</td>
                <td class="text-center">
                    <span class="saturation-pill ${satClass}">${sat}%</span>
                </td>
                <td class="text-right">${(d.Ratio_MOD || 1).toFixed(2)}</td>
                <td class="text-right">
                    <div class="impact-bar-container"><div class="impact-bar" style="width: ${impact}%"></div></div>
                    <span style="font-size:0.7rem; color: #a0a0a0">${impact}%</span>
                </td>
                <td class="text-center">
                    <button class="action-btn btn-simular" 
                        data-articulo="${d.Articulo}" 
                        data-centro="${d.Centro}" style="padding: 4px 10px;">Ajustar</button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderLocalOverrides() {
    const container = document.getElementById('overrides-list');
    if (!container) return;

    if (localOverrides.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay cambios aplicados</p>';
        return;
    }

    container.innerHTML = localOverrides.map((ov, idx) => {
        return `
            <div class="override-item">
                <span class="btn-remove-ov" onclick="removeOverride(${idx})">&times;</span>
                <div style="font-weight: 800; color: #fff; margin-bottom: 5px;">${ov.articulo}</div>
                <div class="override-info">
                    ${ov.new_centro ? `<div>Traslado: <b class="val-changed">${ov.new_centro}</b></div>` : ''}
                    ${ov.oee_override !== null ? `<div>OEE: <b class="val-changed">➜ ${(ov.oee_override * 100).toFixed(1)}%</b></div>` : ''}
                    ${ov.ppm_override !== null ? `<div>PPM: <b class="val-changed">➜ ${Math.round(ov.ppm_override)}</b></div>` : ''}
                    ${ov.demanda_override !== null ? `<div>Dem: <b class="val-changed">➜ ${Math.round(ov.demanda_override).toLocaleString()}</b></div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function removeOverride(i) {
    localOverrides.splice(i, 1);
    updatePreviewSimulation();
}

async function loadScenarioHistory(id) {
    try {
        const res = await fetch(`${API_BASE}/scenarios/${id}/history`);
        const history = await res.json();
        const container = document.getElementById('history-list');
        if (!container) return;

        if (!history || history.length === 0) {
            container.innerHTML = '<p class="empty-state">Sin registros previos</p>';
            return;
        }

        container.innerHTML = history.map(h => `
            <div class="history-item">
                <div class="history-header">
                    <div class="history-info">
                        <div class="history-time">${h.timestamp}</div>
                        <div class="history-name">${h.name}</div>
                    </div>
                </div>
                <div style="font-size: 0.75rem; color: #a0a0a0; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05);">
                    ${h.changes_count} ajustes realizados
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error("Error history:", e);
    }
}

/* --- DROPDOWN LOGIC --- */
function populateWorkCenters() {
    const list = document.getElementById('work-center-options');
    if (!list || !currentData || !currentData.detail) return;

    const centers = [...new Set(currentData.detail.map(d => d.Centro))].sort();

    let html = `
        <div class="checkbox-item" onclick="toggleSelectAll(event)">
            <input type="checkbox" id="cb-all" ${selectedCenters.includes('all') ? 'checked' : ''} onchange="event.preventDefault()">
            <span>-- Todos los Centros --</span>
        </div>
        <div style="border-bottom: 2px solid rgba(255,255,255,0.05); margin: 4px 0;"></div>
    `;

    centers.forEach(c => {
        const isChecked = selectedCenters.includes(String(c)) && !selectedCenters.includes('all');
        const config = centerConfigs[String(c)] || {};
        const activeShift = config.shifts || 16;

        html += `
            <div class="checkbox-item work-center-row" onclick="toggleOption('${c}', event)">
                <div class="wc-check-part">
                    <input type="checkbox" id="cb-${c}" ${isChecked ? 'checked' : ''} onchange="event.preventDefault()">
                    <span class="wc-label">${c}</span>
                </div>
                <div class="wc-shifts-part" onclick="event.stopPropagation()">
                    <button class="shift-btn ${activeShift == 8 ? 'active' : ''}" onclick="setCenterShift('${c}', 8)">8h</button>
                    <button class="shift-btn ${activeShift == 16 ? 'active' : ''}" onclick="setCenterShift('${c}', 16)">16h</button>
                    <button class="shift-btn ${activeShift == 24 ? 'active' : ''}" onclick="setCenterShift('${c}', 24)">24h</button>
                </div>
            </div>
        `;
    });

    list.innerHTML = html;
    updateDropdownText();
}

async function setCenterShift(centro, shifts) {
    if (!centerConfigs[String(centro)]) centerConfigs[String(centro)] = {};
    centerConfigs[String(centro)].shifts = shifts;
    populateWorkCenters();
    await updatePreviewSimulation();
}

function toggleDropdown() {
    document.getElementById('work-center-options').classList.toggle('show');
}

function toggleSelectAll(e) {
    e.stopPropagation();
    if (selectedCenters.includes('all')) {
        selectedCenters = [];
    } else {
        selectedCenters = ['all'];
    }
    populateWorkCenters();
}

function toggleOption(val, e) {
    e.stopPropagation();
    if (selectedCenters.includes('all')) selectedCenters = [];

    val = String(val);
    if (selectedCenters.includes(val)) {
        selectedCenters = selectedCenters.filter(c => c !== val);
    } else {
        selectedCenters.push(val);
    }

    if (selectedCenters.length === 0) selectedCenters = ['all'];
    populateWorkCenters();
}

function updateDropdownText() {
    const textSpan = document.getElementById('dropdown-text');
    if (selectedCenters.includes('all')) {
        textSpan.innerText = "-- Todos los Centros --";
    } else {
        textSpan.innerText = `${selectedCenters.length} Centros Seleccionados`;
    }
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

    document.getElementById('btn-actual').onclick = () => {
        localOverrides = [];
        centerConfigs = {};
        currentScenarioId = 'actual';
        loadSimulation('actual');
    };

    document.getElementById('work-days').oninput = debounce(() => updatePreviewSimulation(), 500);
    document.getElementById('work-shifts').onchange = () => updatePreviewSimulation();

    document.getElementById('btn-apply-filter').onclick = () => {
        updateUI();
        document.getElementById('work-center-options').classList.remove('show');
    };

    document.getElementById('btn-clear-filter').onclick = () => {
        selectedCenters = ['all'];
        populateWorkCenters();
        updateUI();
    };

    document.getElementById('table-search').oninput = () => updateUI();

    document.getElementById('edit-form').onsubmit = async (e) => {
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
            horas_turno_override: shifts ? parseInt(shifts) : null,
            personnel_ratio_override: parseFloat(document.getElementById('edit-mod').value) || null,
            setup_time_override: parseFloat(document.getElementById('edit-setup').value) || 0
        };

        const idx = localOverrides.findIndex(o => o.articulo == articulo && o.centro == centroBase);
        if (idx >= 0) localOverrides[idx] = override;
        else localOverrides.push(override);

        document.getElementById('edit-modal').style.display = 'none';
        await updatePreviewSimulation();
    };

    document.getElementById('cancel-edit').onclick = () => document.getElementById('edit-modal').style.display = 'none';

    document.getElementById('btn-new').onclick = () => {
        document.getElementById('new-scenario-name').value = '';
        document.getElementById('save-modal').style.display = 'flex';
    };

    document.getElementById('btn-save-new-confirm').onclick = async () => {
        const name = document.getElementById('new-scenario-name').value;
        if (!name) return alert("Ponga un nombre");
        await performSaveScenario(name);
        document.getElementById('save-modal').style.display = 'none';
    };

    document.getElementById('btn-compare').onclick = () => document.getElementById('compare-modal').style.display = 'flex';
    document.getElementById('run-compare').onclick = runCompare;

    document.getElementById('btn-manage').onclick = () => {
        renderManageList();
        document.getElementById('manage-modal').style.display = 'flex';
    };

    document.querySelectorAll('.close, .close-manage, .btn-secondary').forEach(btn => {
        btn.onclick = (e) => {
            if (e.target.closest('.modal')) e.target.closest('.modal').style.display = 'none';
        };
    });

    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) event.target.style.display = 'none';
        if (!event.target.closest('.custom-dropdown')) {
            const opts = document.getElementById('work-center-options');
            if (opts) opts.classList.remove('show');
        }
    };
}

async function performSaveScenario(name) {
    const days = parseInt(document.getElementById('work-days').value);
    const shifts = parseInt(document.getElementById('work-shifts').value);
    setLoading(true);
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
            await loadScenarios();
            initApp();
        }
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
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
    finally { setLoading(false); }
}

function openEditModal(articulo, centro) {
    const d = currentData.detail.find(item => item.Articulo == articulo && item.Centro == centro);
    if (!d) return;
    document.getElementById('edit-articulo').value = articulo;
    document.getElementById('edit-centro').value = centro;
    document.getElementById('display-articulo').innerText = articulo;
    document.getElementById('edit-oee').value = (d['%OEE'] * 100).toFixed(1);
    document.getElementById('edit-ppm').value = Math.round(d['Piezas por minuto']);
    document.getElementById('edit-demanda').value = Math.round(d['Volumen anual']);
    document.getElementById('edit-setup').value = (d['Setup (h)'] || 0).toFixed(1);
    document.getElementById('edit-mod').value = (d.Ratio_MOD || 1.0).toFixed(1);

    const centers = [...new Set(baseData.detail.map(item => item.Centro))].sort();
    document.getElementById('edit-new-centro').innerHTML = centers.map(c => `<option value="${c}" ${c == centro ? 'selected' : ''}>${c}</option>`).join('');
    document.getElementById('edit-modal').style.display = 'flex';
}

function renderManageList() {
    const container = document.getElementById('manage-list-container');
    container.innerHTML = scenarios.map(s => `
        <div style="background: rgba(255,255,255,0.02); margin-bottom: 8px; padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.05);">
            <span style="font-weight: 700; color: #fff;">${s.name}</span>
            <div style="display: flex; gap: 8px;">
                <button class="btn-primary" onclick="loadAndClose(${s.id})" style="padding: 4px 12px; font-size: 0.8rem;">Cargar</button>
                <button class="btn-secondary" onclick="deleteScenarioInline(${s.id})" style="padding: 4px 12px; font-size: 0.8rem; color: #ff4d4d;">Eliminar</button>
            </div>
        </div>
    `).join('');
}

window.loadAndClose = (id) => {
    loadSimulation(id);
    document.getElementById('manage-modal').style.display = 'none';
};

window.deleteScenarioInline = async (id) => {
    if (!confirm("¿Borrar definitivamente?")) return;
    await fetch(`${API_BASE}/scenarios/${id}`, { method: 'DELETE' });
    await loadScenarios();
    renderManageList();
};

async function runCompare() {
    const scA = document.getElementById('compare-a').value;
    const scB = document.getElementById('compare-b').value;
    setLoading(true);
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
    finally { setLoading(false); }
}

function enterComparisonMode() {
    const banner = document.getElementById('comparison-controls');
    banner.style.display = 'flex';
    banner.innerHTML = `
        <span>COMPARATIVA: ${comparisonData.nameA} vs ${comparisonData.nameB}</span>
        <button class="action-btn" onclick="exitComparisonMode()" style="background: #000; font-size: 0.75rem;">Cerrar</button>
    `;
    updateUI();
}

function exitComparisonMode() {
    isComparisonMode = false;
    document.getElementById('comparison-controls').style.display = 'none';
    updateUI();
}

function renderComparisonDashboard() {
    const ctx = document.getElementById('saturationChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const labels = [...new Set([...comparisonData.dataA.summary.map(s => s.Centro), ...comparisonData.dataB.summary.map(s => s.Centro)])].sort();

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: comparisonData.nameA,
                    data: labels.map(l => ((comparisonData.dataA.summary.find(s => s.Centro == l)?.Saturacion || 0) * 100).toFixed(1)),
                    backgroundColor: '#444'
                },
                {
                    label: comparisonData.nameB,
                    data: labels.map(l => ((comparisonData.dataB.summary.find(s => s.Centro == l)?.Saturacion || 0) * 100).toFixed(1)),
                    backgroundColor: '#E30613'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#2d2d35' }, ticks: { color: '#a0a0a0' } }
            },
            plugins: { legend: { labels: { color: '#fff' } } }
        }
    });
}

function renderComparisonTable() {
    // Basic reuse of table render for comparison if needed
    renderTable(comparisonData.dataB.detail);
}

function renderExecutiveInsights() {
    // Insights could be added to summary panel
}