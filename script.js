// --- GLOBAL STATE ---
let globalData = [];
let displayedData = [];
let inventoryMap = new Map(); // Added explicit global
let sortState = { key: '', order: 'asc' };
let validationErrors = [];
let duplicateSerials = [];
let totalSysItemsInitial = 0; // Fixed: Promoted to global scope
let MATERIAL_MASTER = {}; // { 'code': 'Description' }
let CUSTOMER_MASTER = {}; // { 'code': 'Customer Name' }
const CURRENT_VERSION = "2.1";

// Default Column Visibility
// Index matches th order in HTML
const TABLE_COLUMNS = [
    "Status", "Logic", "Material", "Description", "Customer Name", "Customer Code",
    "Plant", "S.Loc", "Phy Batch", "Phy Serial", "Sys Batch", "Sys Serial",
    "Condition", "Expiry Date", "Sys Expiry", "Days Left", "Stock Status", "Comment", "Scan String"
];
// Load hidden cols from storage
let hiddenColumns = JSON.parse(localStorage.getItem('sapVal_hiddenCols') || '[]');


// --- INIT ---
window.onload = async function () {
    checkVersion();
    applyColumnVisibility(); // Apply on load
    await loadSavedDataForMHPL(); // Restore Persistence
};

// --- PERSISTENCE LOAD ---
async function loadSavedDataForMHPL() {
    try {
        const saved = await loadUserData('MHPL');
        if (saved && saved.globalData) {
            globalData = saved.globalData;
            displayedData = [...globalData];

            // Restore KPIs
            document.getElementById('kpi-sys-total').innerText = saved.kpis.sysTotal || 0;
            document.getElementById('kpi-total').innerText = saved.kpis.tot || 0;
            document.getElementById('kpi-serial').innerText = saved.kpis.s || 0;
            document.getElementById('kpi-batch').innerText = saved.kpis.b || 0;
            document.getElementById('kpi-mat').innerText = saved.kpis.m || 0;
            document.getElementById('kpi-var').innerText = saved.kpis.v || 0;
            document.getElementById('kpi-remain').innerText = saved.kpis.remain || 0;

            // Show Dashboard
            document.getElementById('dashboard').classList.remove('hidden');
            document.getElementById('btnRun').innerHTML = '<i class="fas fa-history mr-2"></i> RESTORED SESSION';

            // Render
            sortBy('statusPriority');
            console.log("Restored MHP Session from Supabase");
        }
    } catch (e) {
        console.error("Failed to load saved session:", e);
    }
}

function checkVersion() {
    const lastVer = localStorage.getItem('sapVal_version');
    if (lastVer !== CURRENT_VERSION) {
        document.getElementById('updatesModal').classList.remove('hidden');
        localStorage.setItem('sapVal_version', CURRENT_VERSION);
    }
}

function closeUpdates() {
    document.getElementById('updatesModal').classList.add('hidden');
}

function showAbout() {
    document.getElementById('aboutModal').classList.remove('hidden');
}

// --- COLUMN VISIBILITY LOGIC ---
function openColVis() {
    // Get current table headers dynamically
    const headers = Array.from(document.querySelectorAll('thead th')).map(th => {
        // Extract text content, removing sort icon
        const text = th.textContent.trim();
        return text.replace(/[\u00A0\s]+$/, ''); // Remove trailing spaces and icons
    });

    const list = document.getElementById('colVisList');
    list.innerHTML = headers.map((col, index) => {
        const isHidden = hiddenColumns.includes(index);
        return `
                    <label class="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer border border-transparent hover:border-gray-200">
                        <input type="checkbox" onchange="toggleColumn(${index})" ${!isHidden ? 'checked' : ''} class="w-4 h-4 text-blue-600 rounded">
                        <span class="text-sm font-medium ${isHidden ? 'text-gray-400' : 'text-gray-800'}">${col}</span>
                    </label>
                `;
    }).join('');
    document.getElementById('colVisModal').classList.remove('hidden');
}

function toggleColumn(index) {
    if (hiddenColumns.includes(index)) {
        hiddenColumns = hiddenColumns.filter(i => i !== index);
    } else {
        hiddenColumns.push(index);
    }
    localStorage.setItem('sapVal_hiddenCols', JSON.stringify(hiddenColumns));
    applyColumnVisibility();
    // Re-render list to update styles
    openColVis();
}

function applyColumnVisibility() {
    const styleTag = document.getElementById('columnVisibilityStyles');
    if (hiddenColumns.length === 0) {
        styleTag.innerHTML = "";
        return;
    }
    // Generate CSS to hide specific nth-child
    // nth-child is 1-based
    const rules = hiddenColumns.map(i => {
        const n = i + 1;
        return `#tableBody tr td:nth-child(${n}), thead th:nth-child(${n}) { display: none; }`;
    }).join('\n');
    styleTag.innerHTML = rules;
}


// --- UTILS ---
function toggleSettingsPage() {
    const settings = document.getElementById('settingsPage');
    const dashboard = document.getElementById('dashboard');
    const landing = document.getElementById('preValidationModal').parentNode.querySelector('.w-full.max-w-\\[99\\%\\]'); // Main container
    const runBtn = document.getElementById('btnRun');
    const fileInputs = document.getElementById('btnRun').previousElementSibling; // The div containing file inputs

    if (settings.classList.contains('hidden')) {
        // Show Settings
        settings.classList.remove('hidden');
        // Hide other main elements safely
        document.querySelectorAll('.w-full.max-w-\\[99\\%\\] > div:not(#settingsPage):not(header)').forEach(el => el.classList.add('hidden'));
        runBtn.classList.add('hidden');
    } else {
        // Hide Settings
        settings.classList.add('hidden');
        // Restore main elements
        document.querySelectorAll('.w-full.max-w-\\[99\\%\\] > div:not(#settingsPage):not(header)').forEach(el => {
            if (el.id !== 'dashboard' && el.id !== 'errorPanel' && el.id !== 'duplicateWarning' && el.id !== 'progressContainer' && el.id !== 'statusLog' && el.id !== 'summaryStats') {
                el.classList.remove('hidden');
            }
        });

        // Only show dashboard if we have data
        if (displayedData.length > 0) document.getElementById('dashboard').classList.remove('hidden');

        runBtn.classList.remove('hidden');
    }
}

async function loadCustomerData() {
    const f = document.getElementById('fileCustomer').files[0];
    if (!f) return;
    try {
        const data = await readXlsx(f);
        if (data.length < 2) throw new Error("File too short"); // Need header + data
        // Look for header row (e.g. Row 0 or 1)
        // We'll just assume Row 1 (index 1) has data if Row 0 is header
        // Or just try to find "Customer" key in Row 0
        const headers = data[0].map(x => String(x).toLowerCase());
        const iCust = headers.findIndex(h => h.includes('customer') || h.includes('name'));
        const iProj = headers.findIndex(h => h.includes('project') || h.includes('site') || h.includes('location'));

        if ((iCust > -1 || iProj > -1) && data.length > 1) {
            const row = data[1]; // Take first data row
            if (iCust > -1) document.getElementById('custName').value = row[iCust] || '';
            if (iProj > -1) document.getElementById('custProject').value = row[iProj] || '';
            saveSettings(); // Auto-save
            alert("Customer data loaded!");
        } else {
            throw new Error("Could not find Customer/Project columns in Row 1");
        }
    } catch (e) {
        alert("Customer Data Error: " + e.message);
    }
}

async function loadMasterData() {
    const f = document.getElementById('fileMaster').files[0];
    if (!f) return;

    try {
        const data = await readXlsx(f);
        if (data.length < 1) throw new Error("Empty file");

        // Find headers
        const headers = data[0].map(x => String(x).toLowerCase());
        const iMat = headers.findIndex(h => h.includes('material') || h.includes('code') || h.includes('item') || h.includes('part') || h.includes('product') || h.includes('sku'));
        const iDesc = headers.findIndex(h => h.includes('desc') || h.includes('name') || h.includes('text') || h.includes('detail') || h.includes('spec') || h.includes('title'));

        if (iMat === -1 || iDesc === -1) throw new Error("Could not find 'Material' and 'Description' columns.");

        let count = 0;
        MATERIAL_MASTER = {};
        const listEl = document.getElementById('masterList');
        listEl.innerHTML = "";

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (row[iMat]) {
                const m = clean(row[iMat]);
                const d = String(row[iDesc] || '').trim();
                MATERIAL_MASTER[m] = d;
                count++;
                if (count <= 10) {
                    listEl.innerHTML += `<li class="truncate"><b>${m}</b>: ${d}</li>`;
                }
            }
        }
        if (count > 10) listEl.innerHTML += `<li class="italic text-gray-400">...and ${count - 10} more</li>`;
        document.getElementById('masterCount').innerText = count;

        // SAVE TO LOCAL STORAGE
        saveSettings();
        saveToDB('materialMaster', MATERIAL_MASTER);

        alert(`Successfully loaded ${count} materials.`);

    } catch (e) {
        alert("Master Data Error: " + e.message);
    }
}

async function loadCustomerMasterData() {
    const f = document.getElementById('fileCustomerMaster').files[0];
    if (!f) return;

    try {
        const data = await readXlsx(f);
        if (data.length < 1) throw new Error("Empty file");

        // Find headers
        const headers = data[0].map(x => String(x).toLowerCase());
        const iCode = headers.findIndex(h => h.includes('code') || h.includes('id') || h.includes('no') || h.includes('customer'));
        const iName = headers.findIndex(h => h.includes('name') || h.includes('desc') || h.includes('customer'));

        // Basic validation strictly for Code and Name columns if they are distinct
        // If "Customer" matches both, we might have issues, so let's refine:
        // iCode: prefer 'code', 'id', 'no'
        // iName: prefer 'name', 'text'

        if (iCode === -1 || iName === -1) throw new Error("Could not find 'Customer Code' and 'Customer Name' columns.");

        let count = 0;
        CUSTOMER_MASTER = {};
        const listEl = document.getElementById('custMasterList');
        listEl.innerHTML = "";

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (row[iCode]) {
                const c = clean(row[iCode]);
                const n = String(row[iName] || '').trim();
                if (c && n) {
                    CUSTOMER_MASTER[c] = n;

                    // Alias for numeric mismatch (e.g. '00123' -> '123')
                    // If Code is numeric, store the number version too
                    if (!isNaN(parseFloat(c))) {
                        const numC = String(parseFloat(c));
                        if (numC !== c) {
                            CUSTOMER_MASTER[numC] = n;
                        }
                    }

                    count++;
                    if (count <= 10) {
                        listEl.innerHTML += `<li class="truncate"><b>${c}</b>: ${n}</li>`;
                    }
                }
            }
        }
        if (count > 10) listEl.innerHTML += `<li class="italic text-gray-400">...and ${count - 10} more</li>`;
        document.getElementById('custMasterCount').innerText = count;

        // SAVE TO LOCAL STORAGE
        saveSettings();
        saveToDB('customerMaster', CUSTOMER_MASTER);

        alert(`Successfully loaded ${count} customers.`);

    } catch (e) {
        alert("Customer Master Error: " + e.message);
    }
}

// --- PERSISTENCE (IndexedDB + LocalStorage) ---
let db;
const initDB = () => {
    const req = indexedDB.open("ValToolDB", 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore("store");
    req.onsuccess = e => {
        db = e.target.result;
        loadFromDB("materialMaster", v => {
            if (v) { MATERIAL_MASTER = v; updateMasterList(v, 'masterList', 'masterCount'); }
        });
        loadFromDB("customerMaster", v => {
            if (v) { CUSTOMER_MASTER = v; updateMasterList(v, 'custMasterList', 'custMasterCount'); }
        });
    };
};
const saveToDB = (k, v) => {
    if (db) db.transaction(["store"], "readwrite").objectStore("store").put(v, k);
};
const loadFromDB = (k, cb) => {
    if (db) db.transaction(["store"]).objectStore("store").get(k).onsuccess = e => cb(e.target.result);
};
const updateMasterList = (data, listId, countId) => {
    const list = document.getElementById(listId);
    list.innerHTML = "";
    let c = 0;
    for (let k in data) {
        if (c++ < 10) list.innerHTML += `<li class="truncate"><b>${k}</b>: ${data[k]}</li>`;
    }
    if (c > 10) list.innerHTML += `<li class="italic text-gray-400">...and ${c - 10} more</li>`;
    document.getElementById(countId).innerText = c + " (cached)";
};

function saveSettings() {
    const settings = {
        custName: document.getElementById('custName').value,
        custProject: document.getElementById('custProject').value,
        aiMaterial: document.getElementById('aiMaterial').value,
        aiBatch: document.getElementById('aiBatch').value,
        aiSerial: document.getElementById('aiSerial').value,
        enableConcat: document.getElementById('enableConcat').checked,
        concatDelimiter: document.getElementById('concatDelimiter').value,
        nearExpiryMonths: document.getElementById('nearExpiryMonths').value,
        shortExpiryMonths: document.getElementById('shortExpiryMonths').value,
        txtMatch: document.getElementById('txtMatch').value,
        txtBatch: document.getElementById('txtBatch').value,
        txtMat: document.getElementById('txtMat').value,
        txtVar: document.getElementById('txtVar').value,
        exportLayout: document.getElementById('exportLayout').value,
        plantPriority: document.getElementById('plantPriority').value,
        goodSloc: document.getElementById('txtGoodSloc').value,
        dmgSloc: document.getElementById('txtDmgSloc').value,
        // --- [UPDATED LOGIC] ---
        smartZero: document.getElementById('smartZero').checked,
        useScanQty: document.getElementById('useScanQty').checked,
        autoSloc: document.getElementById('autoSloc').checked
    };
    try {
        localStorage.setItem('sapVal_settings_v12', JSON.stringify(settings));
        // Optional: visual feedback?
    } catch (e) {
        console.warn("Storage quota exceeded or error", e);
    }
}

function loadSettings() {
    try {
        const raw = localStorage.getItem('sapVal_settings_v12');
        if (!raw) return;
        const s = JSON.parse(raw);

        if (s.custName) document.getElementById('custName').value = s.custName;
        if (s.custProject) document.getElementById('custProject').value = s.custProject;
        if (s.aiMaterial) document.getElementById('aiMaterial').value = s.aiMaterial;
        if (s.aiBatch) document.getElementById('aiBatch').value = s.aiBatch;
        if (s.aiSerial) document.getElementById('aiSerial').value = s.aiSerial;

        if (s.enableConcat !== undefined) document.getElementById('enableConcat').checked = s.enableConcat;
        if (s.concatDelimiter) document.getElementById('concatDelimiter').value = s.concatDelimiter;

        if (s.nearExpiryMonths) document.getElementById('nearExpiryMonths').value = s.nearExpiryMonths;
        if (s.shortExpiryMonths) document.getElementById('shortExpiryMonths').value = s.shortExpiryMonths;

        if (s.txtMatch) document.getElementById('txtMatch').value = s.txtMatch;
        if (s.txtBatch) document.getElementById('txtBatch').value = s.txtBatch;
        if (s.txtMat) document.getElementById('txtMat').value = s.txtMat;
        if (s.txtVar) document.getElementById('txtVar').value = s.txtVar;

        // V13 Enhancements
        if (s.plantPriority) document.getElementById('plantPriority').value = s.plantPriority;

        // Storage Location Settings
        if (s.goodSloc) document.getElementById('txtGoodSloc').value = s.goodSloc;
        if (s.dmgSloc) document.getElementById('txtDmgSloc').value = s.dmgSloc;

        // --- [UPDATED LOGIC] ---
        if (s.smartZero !== undefined) document.getElementById('smartZero').checked = s.smartZero;
        if (s.useScanQty !== undefined) document.getElementById('useScanQty').checked = s.useScanQty;
        if (s.autoSloc !== undefined) document.getElementById('autoSloc').checked = s.autoSloc;
        // ---

        if (s.exportLayout) {
            document.getElementById('exportLayout').value = s.exportLayout;
        } else {
            // Default Layout
            document.getElementById('exportLayout').value = "Status, Logic, Material, Description, Customer, P_ID, S.Loc, Plant, Phy Batch, Phy Serial, Sys Batch, Sys Serial, Condition, Expiry Date, Sys Expiry, Days Left, Stock Status, Comment";
        }

        if (s.materialMaster && Object.keys(s.materialMaster).length > 0) {
            MATERIAL_MASTER = s.materialMaster;
            const count = Object.keys(MATERIAL_MASTER).length;
            const listEl = document.getElementById('masterList');
            listEl.innerHTML = "";
            let shown = 0;
            for (let k in MATERIAL_MASTER) {
                if (shown < 10) listEl.innerHTML += `<li class="truncate"><b>${k}</b>: ${MATERIAL_MASTER[k]}</li>`;
                shown++;
            }
            if (count > 10) listEl.innerHTML += `<li class="italic text-gray-400">...and ${count - 10} more</li>`;
            document.getElementById('masterCount').innerText = `${count} (cached)`;
        }

        if (s.customerMaster && Object.keys(s.customerMaster).length > 0) {
            CUSTOMER_MASTER = s.customerMaster;
            const count = Object.keys(CUSTOMER_MASTER).length;
            const listEl = document.getElementById('custMasterList');
            listEl.innerHTML = "";
            let shown = 0;
            for (let k in CUSTOMER_MASTER) {
                if (shown < 10) listEl.innerHTML += `<li class="truncate"><b>${k}</b>: ${CUSTOMER_MASTER[k]}</li>`;
                shown++;
            }
            if (count > 10) listEl.innerHTML += `<li class="italic text-gray-400">...and ${count - 10} more</li>`;
            document.getElementById('custMasterCount').innerText = `${count} (cached)`;
        }

    } catch (e) {
        console.error("Error loading settings", e);
    }
}

// Init
document.addEventListener('DOMContentLoaded', loadSettings);

const log = (msg) => {
    const el = document.getElementById('statusLog');
    el.classList.remove('hidden');
    el.innerHTML += `> ${msg}<br>`;
    el.scrollTop = el.scrollHeight;
};
// Helper to clean strings (now preserves 0)
const clean = (val) => String(val !== null && val !== undefined ? val : '').trim().toUpperCase();

const addError = (row, message, severity = 'error') => {
    validationErrors.push({ row, message, severity });
};

const showErrorPanel = () => {
    if (validationErrors.length === 0) return;
    const panel = document.getElementById('errorPanel');
    const list = document.getElementById('errorList');

    const errorHtml = validationErrors.map(e => {
        const icon = e.severity === 'warning' ? 'fa-exclamation-triangle text-yellow-600' : 'fa-times-circle text-red-600';
        return `<div class="flex items-start"><i class="fas ${icon} mr-2 mt-0.5"></i><span><strong>Row ${e.row}:</strong> ${e.message}</span></div>`;
    }).join('');

    list.innerHTML = errorHtml;
    panel.classList.remove('hidden');
};

const downloadErrorLog = () => {
    const csv = 'Row,Severity,Message\n' + validationErrors.map(e =>
        `${e.row},${e.severity},"${e.message}"`
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'validation_errors.csv';
    a.click();
};

const showDuplicateDetails = () => {
    if (duplicateSerials.length === 0) return;
    const lines = duplicateSerials.map(d =>
        `${d.mat}\t${d.batch}\t${d.ser}\t(Count: ${d.count})`
    ).join('\n');

    document.getElementById('txtDuplicateDetails').value =
        "Material\tBatch\tSerial\tCount\n" + lines;

    document.getElementById('duplicateDetailsModal').classList.remove('hidden');
};

const copyDuplicateDetails = () => {
    const txt = document.getElementById('txtDuplicateDetails');
    txt.select();
    document.execCommand('copy'); // Fallback for older browsers
    // Modern way: navigator.clipboard.writeText(txt.value);
    alert("Copied to clipboard!");
};

const exportDuplicateCSV = () => {
    if (duplicateSerials.length === 0) return;
    let csv = "Material,Batch,Serial,Count\n";
    duplicateSerials.forEach(d => {
        csv += `"${d.mat}","${d.batch}","${d.ser}",${d.count}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'duplicate_serials_report.csv';
    a.click();
};

// --- PROGRESS TRACKING ---
const updateProgress = (percent, status) => {
    const container = document.getElementById('progressContainer');
    const bar = document.getElementById('progressBar');
    const percentText = document.getElementById('progressPercent');
    const statusText = document.getElementById('progressStatus');

    container.classList.remove('hidden');
    bar.style.width = percent + '%';
    percentText.innerText = Math.round(percent) + '%';
    statusText.innerText = status;
};

const hideProgress = () => {
    document.getElementById('progressContainer').classList.add('hidden');
};

// --- SUMMARY STATISTICS ---
const updateSummaryStats = (stats, totalScans, processingTime, scanFileName, sapFileName) => {
    const summaryPanel = document.getElementById('summaryStats');

    // Calculate match rate
    const matched = stats.s + stats.b + stats.m;
    const matchRate = totalScans > 0 ? ((matched / totalScans) * 100).toFixed(1) : 0;

    document.getElementById('stat-match-rate').innerText = matchRate + '%';
    document.getElementById('stat-match-detail').innerText = `${matched} of ${totalScans} matched`;

    // Processing time
    const timeInSec = (processingTime / 1000).toFixed(2);
    document.getElementById('stat-process-time').innerText = timeInSec + 's';

    // Speed
    const speed = processingTime > 0 ? Math.round(totalScans / (processingTime / 1000)) : 0;
    document.getElementById('stat-speed').innerText = speed + ' items/sec';

    // File names
    document.getElementById('stat-scan-file').innerText = scanFileName || '-';
    document.getElementById('stat-sap-file').innerText = sapFileName || '-';

    // Top 3 variance materials
    const varianceMaterials = {};
    globalData.forEach(row => {
        if (row.status === 'Variance' || row.status === 'Error') {
            varianceMaterials[row.mat] = (varianceMaterials[row.mat] || 0) + 1;
        }
    });

    const topVariance = Object.entries(varianceMaterials)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    if (topVariance.length > 0) {
        const varianceHtml = topVariance.map(([mat, count]) =>
            `<div class="flex justify-between items-center py-1 border-b border-gray-100">
                        <span class="font-mono text-xs">${mat}</span>
                        <span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">${count} items</span>
                    </div>`
        ).join('');
        document.getElementById('stat-top-variance').innerHTML = varianceHtml;
    } else {
        document.getElementById('stat-top-variance').innerText = 'No variance detected ✓';
    }

    summaryPanel.classList.remove('hidden');
};

// --- PRE-VALIDATION ---
let preValidationPassed = false;

const validateFileExtension = (file) => {
    const validExtensions = ['.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    return validExtensions.some(ext => fileName.endsWith(ext));
};

const preValidateFiles = async (scanFile, sapFile) => {
    const checks = [];
    let allPassed = true;

    // Check 1: Scan file extension
    const scanExtValid = validateFileExtension(scanFile);
    checks.push({
        name: 'Scan File Extension',
        passed: scanExtValid,
        message: scanExtValid ? `Valid format: ${scanFile.name}` : `Invalid format: ${scanFile.name}. Expected .xlsx or .xls`
    });
    if (!scanExtValid) allPassed = false;

    // Check 2: SAP file extension
    const sapExtValid = validateFileExtension(sapFile);
    checks.push({
        name: 'SAP File Extension',
        passed: sapExtValid,
        message: sapExtValid ? `Valid format: ${sapFile.name}` : `Invalid format: ${sapFile.name}. Expected .xlsx or .xls`
    });
    if (!sapExtValid) allPassed = false;

    // Check 3: Read SAP file and validate columns
    try {
        const sapData = await readXlsx(sapFile);

        // Allow flexible header names for Material (Enhanced)
        const validMatTerms = ['material', 'mat', 'matnr', 'article', 'product', 'item', 'sku', 'part', 'code', 'model', 'identifier'];

        let headerRow = sapData.findIndex(row => {
            const rowStr = row.join(" ").toLowerCase();
            return validMatTerms.some(term => rowStr.includes(term));
        });

        // Fallback: search for Batch+Serial if Material not found
        if (headerRow === -1) {
            headerRow = sapData.findIndex(row => {
                const s = row.join(" ").toLowerCase();
                return (s.includes('batch') || s.includes('lot')) && (s.includes('serial') || s.includes('sno'));
            });
        }

        if (headerRow === -1) {
            checks.push({
                name: 'SAP File Columns',
                passed: false,
                message: 'Missing required "Material" column header (Checked for: Material, Matnr, Part, Batch+Serial, etc.)'
            });
            allPassed = false;
        } else {
            const headers = sapData[headerRow].map(h => String(h).toLowerCase());
            let hasMaterial = headers.some(h => validMatTerms.some(term => h.includes(term)));
            if (headerRow > -1 && !hasMaterial) hasMaterial = true;
            const hasBatch = headers.some(h => h.includes("batch") || h.includes("lot"));
            const hasSerial = headers.some(h => h.includes("serial") || h.includes("sno"));

            if (hasMaterial && hasBatch && hasSerial) {
                checks.push({
                    name: 'SAP File Columns',
                    passed: true,
                    message: 'All required columns found (Material, Batch, Serial)'
                });
            } else {
                const missing = [];
                if (!hasMaterial) missing.push('Material');
                if (!hasBatch) missing.push('Batch');
                if (!hasSerial) missing.push('Serial');
                checks.push({
                    name: 'SAP File Columns',
                    passed: false,
                    message: `Missing columns: ${missing.join(', ')}`
                });
                allPassed = false;
            }
        }
    } catch (e) {
        checks.push({
            name: 'SAP File Readable',
            passed: false,
            message: `Error reading file: ${e.message}`
        });
        allPassed = false;
    }

    // Check 4: Read scan file
    try {
        const scanData = await readXlsx(scanFile);
        if (scanData.length === 0) {
            checks.push({
                name: 'Scan File Data',
                passed: false,
                message: 'Scan file is empty'
            });
            allPassed = false;
        } else {
            checks.push({
                name: 'Scan File Data',
                passed: true,
                message: `Found ${scanData.length} rows`
            });
        }
    } catch (e) {
        checks.push({
            name: 'Scan File Readable',
            passed: false,
            message: `Error reading file: ${e.message}`
        });
        allPassed = false;
    }

    return { checks, allPassed };
};

const showPreValidationReport = (checks, allPassed) => {
    const checksContainer = document.getElementById('preValidationChecks');
    const modal = document.getElementById('preValidationModal');
    const proceedBtn = document.getElementById('btnProceed');

    const checksHtml = checks.map(check => {
        const icon = check.passed ?
            '<i class="fas fa-check-circle text-green-600"></i>' :
            '<i class="fas fa-times-circle text-red-600"></i>';
        const bgColor = check.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';

        return `
                    <div class="${bgColor} border-l-4 p-3 rounded">
                        <div class="flex items-start gap-2">
                            <div class="text-xl">${icon}</div>
                            <div class="flex-1">
                                <div class="font-bold text-sm">${check.name}</div>
                                <div class="text-xs text-gray-600 mt-1">${check.message}</div>
                            </div>
                        </div>
                    </div>
                `;
    }).join('');

    checksContainer.innerHTML = checksHtml;

    if (allPassed) {
        proceedBtn.innerHTML = '<i class="fas fa-play mr-2"></i> Start Validation';
        proceedBtn.className = 'px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold';
    } else {
        proceedBtn.innerHTML = '<i class="fas fa-exclamation-triangle mr-2"></i> Proceed Anyway';
        proceedBtn.className = 'px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded font-bold';
    }

    modal.classList.remove('hidden');
};

const closePreValidation = () => {
    document.getElementById('preValidationModal').classList.add('hidden');
    preValidationPassed = false;
    const btn = document.getElementById('btnRun');
    btn.innerHTML = 'START VALIDATION';
    btn.disabled = false;
};

const proceedWithValidation = () => {
    preValidationPassed = true;
    document.getElementById('preValidationModal').classList.add('hidden');
    actualValidation();
};

// --- SESSION HISTORY ---
const saveToHistory = (validationData) => {
    try {
        let history = JSON.parse(localStorage.getItem('validationHistory') || '[]');
        history.unshift({
            id: Date.now(),
            timestamp: new Date().toLocaleString(),
            scanFile: validationData.scanFile,
            sapFile: validationData.sapFile,
            totalScanned: validationData.totalScanned,
            matched: validationData.matched,
            matchRate: validationData.matchRate,
            processingTime: validationData.processingTime,
            data: validationData.data.slice(0, 1000) // Limit to 1000 rows for storage
        });
        history = history.slice(0, 5); // Keep last 5
        localStorage.setItem('validationHistory', JSON.stringify(history));
        loadHistory();
    } catch (e) {
        console.error('Failed to save history:', e);
    }
};

const loadHistory = () => {
    try {
        const history = JSON.parse(localStorage.getItem('validationHistory') || '[]');
        const historyList = document.getElementById('historyList');

        if (history.length === 0) {
            historyList.innerHTML = '<div class="text-sm text-gray-500 italic text-center py-4">No validation history yet</div>';
            return;
        }

        const historyHtml = history.map((item, index) => {
            const matchRateColor = parseFloat(item.matchRate) >= 90 ? 'text-green-600' :
                parseFloat(item.matchRate) >= 70 ? 'text-yellow-600' : 'text-red-600';

            return `
                        <div class="bg-white p-3 rounded shadow-sm border border-indigo-100 hover:border-indigo-300 transition">
                            <div class="flex items-center justify-between">
                                <div class="flex-1">
                                    <div class="text-xs text-gray-500 mb-1">
                                        <i class="fas fa-clock mr-1"></i> ${item.timestamp}
                                    </div>
                                    <div class="text-xs font-mono text-gray-700">
                                        <i class="fas fa-barcode mr-1"></i> ${item.scanFile}
                                    </div>
                                    <div class="flex items-center gap-3 mt-2">
                                        <span class="text-xs"><strong>${item.totalScanned}</strong> scanned</span>
                                        <span class="text-xs ${matchRateColor} font-bold">${item.matchRate}% match</span>
                                        <span class="text-xs text-gray-500">${item.processingTime}</span>
                                    </div>
                                </div>
                                <div class="flex gap-2">
                                    <button onclick="loadFromHistory(${item.id})" 
                                        class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold"
                                        title="Reload this validation">
                                        <i class="fas fa-redo"></i>
                                    </button>
                                    <button onclick="deleteHistoryItem(${item.id})" 
                                        class="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-bold"
                                        title="Delete">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
        }).join('');

        historyList.innerHTML = historyHtml;
    } catch (e) {
        console.error('Failed to load history:', e);
    }
};

const loadFromHistory = (id) => {
    try {
        const history = JSON.parse(localStorage.getItem('validationHistory') || '[]');
        const item = history.find(h => h.id === id);

        if (!item) {
            alert('History item not found');
            return;
        }

        // Restore global data
        globalData = item.data;
        displayedData = [...globalData];

        // Show dashboard
        document.getElementById('dashboard').classList.remove('hidden');

        // Update KPIs (approximate from stored data)
        const stats = {
            tot: item.totalScanned,
            s: globalData.filter(r => r.status === 'Matched').length,
            b: globalData.filter(r => r.status === 'Partial').length,
            m: globalData.filter(r => r.status === 'Warning').length,
            v: globalData.filter(r => r.status === 'Variance' || r.status === 'Error').length
        };

        document.getElementById('kpi-total').innerText = stats.tot;
        document.getElementById('kpi-serial').innerText = stats.s;
        document.getElementById('kpi-batch').innerText = stats.b;
        document.getElementById('kpi-mat').innerText = stats.m;
        document.getElementById('kpi-var').innerText = stats.v;

        // Render table
        sortBy('statusPriority');

        // Show loaded indicator
        const btn = document.getElementById('btnRun');
        btn.innerHTML = '<i class="fas fa-history mr-2"></i> LOADED FROM HISTORY';

        alert(`Loaded validation from ${item.timestamp}`);
    } catch (e) {
        alert('Failed to load history: ' + e.message);
    }
};

const deleteHistoryItem = (id) => {
    if (!confirm('Delete this history item?')) return;

    try {
        let history = JSON.parse(localStorage.getItem('validationHistory') || '[]');
        history = history.filter(h => h.id !== id);
        localStorage.setItem('validationHistory', JSON.stringify(history));
        loadHistory();
    } catch (e) {
        alert('Failed to delete history: ' + e.message);
    }
};

const clearHistory = () => {
    if (!confirm('Clear all validation history?')) return;

    try {
        localStorage.removeItem('validationHistory');
        loadHistory();
    } catch (e) {
        alert('Failed to clear history: ' + e.message);
    }
};

// Load history on page load
window.addEventListener('DOMContentLoaded', loadHistory);

// --- EXPIRY SETTINGS ---
const saveExpirySettings = () => {
    try {
        const settings = {
            nearExpiryMonths: parseInt(document.getElementById('nearExpiryMonths').value) || 5,
            shortExpiryMonths: parseInt(document.getElementById('shortExpiryMonths').value) || 12
        };
        localStorage.setItem('expirySettings', JSON.stringify(settings));
        log(`Expiry settings saved: Near=${settings.nearExpiryMonths}mo, Short=${settings.shortExpiryMonths}mo`);
    } catch (e) {
        console.error('Failed to save expiry settings:', e);
    }
};

const loadExpirySettings = () => {
    try {
        const settings = JSON.parse(localStorage.getItem('expirySettings') || '{"nearExpiryMonths":5,"shortExpiryMonths":12}');
        document.getElementById('nearExpiryMonths').value = settings.nearExpiryMonths;
        document.getElementById('shortExpiryMonths').value = settings.shortExpiryMonths;
        return settings;
    } catch (e) {
        console.error('Failed to load expiry settings:', e);
        return { nearExpiryMonths: 5, shortExpiryMonths: 12 };
    }
};

// Load expiry settings on page load
window.addEventListener('DOMContentLoaded', loadExpirySettings);

// --- GS1 EXPIRY PARSER ---
const parseGS1Expiry = (barcode) => {
    if (!barcode) return null;

    // Extract (17)YYMMDD from barcode
    const expiryMatch = barcode.match(/\(17\)(\d{6})/);
    if (!expiryMatch) return null;

    const yymmdd = expiryMatch[1];
    const yy = parseInt(yymmdd.substring(0, 2));
    const mm = parseInt(yymmdd.substring(2, 4));
    const dd = parseInt(yymmdd.substring(4, 6));

    // Assume 20xx for years (2000-2099)
    const year = 2000 + yy;

    // Validate month and day
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) {
        console.warn(`Invalid expiry date in barcode: ${yymmdd}`);
        return null;
    }

    // Create date object (month is 0-indexed in JavaScript)
    const expiryDate = new Date(year, mm - 1, dd);

    return expiryDate;
};

// --- STATUS CLASSIFICATION ---
const classifyMaterialStatus = (condition, expiryDate, settings) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to midnight for accurate comparison

    // Priority 1: DAMAGE (highest priority)
    if (condition && condition.toLowerCase().trim() === 'damage') {
        return {
            status: 'DAMAGE',
            css: 'bg-red-100 text-red-900 border-red-300',
            icon: '🔴',
            priority: 1,
            daysLeft: null
        };
    }

    // No expiry data
    if (!expiryDate) {
        return {
            status: 'NO EXPIRY',
            css: 'bg-gray-100 text-gray-600',
            icon: '⚪',
            priority: 6,
            daysLeft: null
        };
    }

    // Calculate days to expiry
    const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
    const monthsLeft = daysLeft / 30; // Approximate months

    // Priority 2: EXPIRED
    if (daysLeft < 0) {
        return {
            status: 'EXPIRED',
            css: 'bg-gray-800 text-white border-gray-900',
            icon: '⚫',
            priority: 2,
            daysLeft: daysLeft
        };
    }

    // Priority 3: NEAR EXPIRY (0 to nearExpiryMonths)
    if (monthsLeft <= settings.nearExpiryMonths) {
        return {
            status: 'NEAR EXPIRY',
            css: 'bg-orange-100 text-orange-900 border-orange-300',
            icon: '🟠',
            priority: 3,
            daysLeft: daysLeft
        };
    }

    // Priority 4: SHORT EXPIRY (nearExpiryMonths to shortExpiryMonths)
    if (monthsLeft <= settings.shortExpiryMonths) {
        return {
            status: 'SHORT EXPIRY',
            css: 'bg-yellow-100 text-yellow-900 border-yellow-300',
            icon: '🟡',
            priority: 4,
            daysLeft: daysLeft
        };
    }

    // Priority 5: GOOD STOCK (>shortExpiryMonths)
    return {
        status: 'GOOD STOCK',
        css: 'bg-green-100 text-green-900 border-green-300',
        icon: '🟢',
        priority: 5,
        daysLeft: daysLeft
    };
};
// --- EXCEL ---
const readXlsx = (file) => {
    if (file && file.isMock) return Promise.resolve(file.data);

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                resolve(XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }));
            } catch (err) { reject(err); }
        };
        reader.readAsArrayBuffer(file);
    });
};

// --- ENHANCED GS1 PARSER ---
const parseGS1 = (raw, rowNum = 0) => {
    let s = clean(raw).replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
    let res = { mat: "", batch: "", ser: "", isDefaultSer: false, isValid: true, error: "" };

    // Get AI codes from settings
    const aiMat = document.getElementById('aiMaterial')?.value || '240';
    const aiBatch = document.getElementById('aiBatch')?.value || '10';
    const aiSer = document.getElementById('aiSerial')?.value || '21';

    // Validate GS1 format
    if (!s.includes('(')) {
        res.isValid = false;
        res.error = 'Invalid GS1 format: No AI codes found';
        addError(rowNum, `Invalid GS1 barcode: "${raw.substring(0, 50)}..."`, 'error');
        return res;
    }

    // Extract Material
    const matRegex = new RegExp(`\\(${aiMat}\\)([^()]+)`);
    let m = s.match(matRegex);
    if (m) {
        res.mat = clean(m[1]);
    } else {
        res.isValid = false;
        res.error = `Missing Material AI (${aiMat})`;
        addError(rowNum, `Missing Material code (${aiMat}) in barcode`, 'warning');
    }

    // Extract Batch
    const batchRegex = new RegExp(`\\(${aiBatch}\\)([^()]+)`);
    let b = s.match(batchRegex);
    if (b) {
        res.batch = clean(b[1]);
    } else {
        addError(rowNum, `Missing Batch code (${aiBatch}) in barcode`, 'warning');
    }

    // Extract Serial
    const serRegex = new RegExp(`\\(${aiSer}\\)([^()]+)`);
    let sr = s.match(serRegex);
    if (sr) {
        res.ser = clean(sr[1]);
    } else {
        res.ser = "001";
        res.isDefaultSer = true;
    }

    return res;
};



// --- SORT ---
function sortBy(key, forceOrder = null) {
    if (forceOrder) {
        sortState.key = key;
        sortState.order = forceOrder;
    } else {
        if (sortState.key === key) sortState.order = sortState.order === 'asc' ? 'desc' : 'asc';
        else { sortState.key = key; sortState.order = 'asc'; }
    }

    document.querySelectorAll('.fa-sort').forEach(i => i.className = 'fas fa-sort text-gray-400 ml-1');
    const icon = document.getElementById(`icon-${key}`);
    if (icon) icon.className = `fas fa-sort-${sortState.order === 'asc' ? 'up' : 'down'} text-blue-600 ml-1`;

    displayedData.sort((a, b) => {
        let valA = a[key], valB = b[key];
        // Stock Status Sort Logic
        if (key === 'statusPriority') return (a.stockStatus?.priority || 99) - (b.stockStatus?.priority || 99) * (sortState.order === 'asc' ? 1 : -1);

        let numA = parseFloat(valA), numB = parseFloat(valB);
        if (!isNaN(numA) && !isNaN(numB) && key !== 'mat' && key !== 'custCode') { valA = numA; valB = numB; }
        else { valA = String(valA || "").toLowerCase(); valB = String(valB || "").toLowerCase(); }
        return (valA < valB ? -1 : (valA > valB ? 1 : 0)) * (sortState.order === 'asc' ? 1 : -1);
    });
    renderTable(displayedData);
}

// --- DATA LOADING ---
async function loadSystemInventory(file) {
    if (!file) return;

    try {
        const rawSys = await readXlsx(file);

        // Map System with progress tracking
        // Allow flexible header names for Material
        const validMatTerms = ['material', 'mat', 'matnr', 'article', 'product', 'item', 'sku', 'part', 'code', 'model', 'identifier'];

        // Strict Header Detection: Material AND (Batch OR Qty OR Desc OR Billing)
        // This prevents picking up Title rows like "Material Report"
        let sysHeadRow = rawSys.findIndex(row => {
            const rowStr = row.join(" ").toLowerCase();
            const hasMat = validMatTerms.some(term => rowStr.includes(term));
            if (!hasMat) return false;

            const hasOther = rowStr.includes("batch") || rowStr.includes("qty") || rowStr.includes("quantity") ||
                rowStr.includes("desc") || rowStr.includes("plant") || rowStr.includes("billing");
            return hasOther;
        });

        // Fallback: Loose Detection (Old Logic) - Just Material
        // This ensures we support simple files that might be missing other columns
        if (sysHeadRow === -1) {
            sysHeadRow = rawSys.findIndex(row => {
                const rowStr = row.join(" ").toLowerCase();
                return validMatTerms.some(term => rowStr.includes(term));
            });
            if (sysHeadRow > -1) console.warn("Loose Header Detection used (only Material found).");
        }

        // Fallback: If no Material found, look for Batch + Serial together
        if (sysHeadRow === -1) {
            sysHeadRow = rawSys.findIndex(row => {
                const s = row.join(" ").toLowerCase();
                return (s.includes('batch') || s.includes('lot')) && (s.includes('serial') || s.includes('sno') || s.includes('ser'));
            });
            if (sysHeadRow > -1) console.warn("Using Fallback Header Row detection (Batch+Serial found)");
        }

        if (sysHeadRow === -1) {
            console.error("System file missing 'Material' header.");
            return;
        }
        const sysHeaders = rawSys[sysHeadRow].map(h => String(h).toLowerCase());

        let idxMat = sysHeaders.findIndex(h => validMatTerms.some(term => h.includes(term)));

        // Fallback: If no explicit Material col, assume Column A (Index 0)
        if (idxMat === -1) {
            idxMat = 0;
            console.warn("No explicit Material column matched. Defaulting to Column A.");
        }
        const idxBatch = sysHeaders.findIndex(h => h.includes("batch") || h.includes("lot"));
        const idxSer = sysHeaders.findIndex(h => h.includes("serial") || h.includes("sno"));
        const idxQty = sysHeaders.findIndex(h => h.includes("qty") || h.includes("count") || h.includes("unrestricted"));
        const idxPlant = sysHeaders.findIndex(h => h.includes("plant") || h.includes("werks") || h.includes("site"));
        const idxSloc = sysHeaders.findIndex(h => h.includes("sloc") || h.includes("loc"));
        const idxExpiry = sysHeaders.findIndex(h => h.includes("sled") || h.includes("bbd") || h.includes("expiry"));

        const idxBillDoc = sysHeaders.findIndex(h => h.includes("billing document") || h.includes("billing doc") || h.includes("bill. doc") || h.includes("bill doc"));
        const idxBillDate = sysHeaders.findIndex(h => h.includes("billing date") || h.includes("billing dt") || h.includes("bill. date") || h.includes("bill date"));

        console.log("SAP Headers Detected:", sysHeaders);
        console.log("Indices:", { idxMat, idxBatch, idxBillDoc, idxBillDate });
        const idxAge = sysHeaders.findIndex(h => h.includes("ageing") || h.includes("aging") || h.includes("inv. age"));

        // V13: Helper indices
        const idxMatchDesc = sysHeaders.findIndex(h => h.includes("desc") || h.includes("text") || h.includes("material description"));
        const idxDesc = idxMatchDesc > -1 ? idxMatchDesc : sysHeaders.findIndex(h => h.includes("name")); // Fallback

        // Enhanced Customer Detection
        const idxCustName = sysHeaders.findIndex(h => h.includes("name") || (h.includes("cust") && h.includes("desc")));
        const idxCustCode = sysHeaders.findIndex(h =>
            (h.includes("cust") && (h.includes("code") || h.includes("id") || h.includes("no") || h.includes("num"))) ||
            h.includes("sold-to") || h.includes("ship-to") || h.includes("payer") || h.includes("party") || h.includes("kunnr") ||
            (h.includes("customer") && !h.includes("name"))
        );

        // Build Map-based inventory for O(1) lookups
        inventoryMap = new Map(); // Global
        totalSysItemsInitial = 0; // Use global variable

        const smartZero = document.getElementById('smartZero')?.checked || false;

        for (let i = sysHeadRow + 1; i < rawSys.length; i++) {
            const row = rawSys[i];
            if (!row[idxMat]) continue;

            const item = {
                mat: clean(row[idxMat]),
                batch: clean(row[idxBatch]),
                ser: idxSer > -1 ? clean(row[idxSer]) : "",
                qty: idxQty > -1 ? (parseFloat(row[idxQty]) || 1) : 1,
                plant: idxPlant > -1 ? clean(row[idxPlant]) : "-",
                sloc: idxSloc > -1 ? clean(row[idxSloc]) : "-",
                expiry: idxExpiry > -1 ? clean(row[idxExpiry]) : "-",
                age: idxAge > -1 ? clean(row[idxAge]) : "-",
                desc: idxDesc > -1 ? clean(row[idxDesc]) : "",
                custName: idxCustName > -1 ? clean(row[idxCustName]) : "",
                custCode: idxCustCode > -1 ? clean(row[idxCustCode]) : "",
                billDoc: idxBillDoc > -1 ? clean(row[idxBillDoc]) : "",
                billDate: idxBillDate > -1 ? clean(row[idxBillDate]) : "",
                used: 0
            };

            totalSysItemsInitial += item.qty;

            // Create multiple lookup keys for different match levels
            // Key format: "material|batch|serial"
            const fullKey = `${item.mat}|${item.batch}|${item.ser}`;
            const batchKey = `${item.mat}|${item.batch}|`;
            const matKey = `${item.mat}||`;

            // Store with full key as primary
            if (!inventoryMap.has(fullKey)) inventoryMap.set(fullKey, []);
            inventoryMap.get(fullKey).push(item);

            // Also index by batch and material for fallback matching
            if (!inventoryMap.has(batchKey)) inventoryMap.set(batchKey, []);
            inventoryMap.get(batchKey).push(item);

            if (!inventoryMap.has(matKey)) inventoryMap.set(matKey, []);
            inventoryMap.get(matKey).push(item);

            // Smart Zero Alias Keys
            if (smartZero) {
                const shortMat = String(parseFloat(item.mat));
                if (shortMat !== item.mat && !isNaN(parseFloat(item.mat))) {
                    const fullKeyS = `${shortMat}|${item.batch}|${item.ser}`;
                    const batchKeyS = `${shortMat}|${item.batch}|`;
                    const matKeyS = `${shortMat}||`;

                    if (!inventoryMap.has(fullKeyS)) inventoryMap.set(fullKeyS, []);
                    inventoryMap.get(fullKeyS).push(item);
                    if (!inventoryMap.has(batchKeyS)) inventoryMap.set(batchKeyS, []);
                    inventoryMap.get(batchKeyS).push(item);
                    if (!inventoryMap.has(matKeyS)) inventoryMap.set(matKeyS, []);
                    inventoryMap.get(matKeyS).push(item);
                }
            }
        }

        console.log(`Auto-loaded ${inventoryMap.size} inventory keys.`);
    } catch (e) {
        console.error("Auto-load failed:", e);
    }
}

const getCustomAIs = () => ({
    mat: document.getElementById('aiMaterial')?.value || '240',
    batch: document.getElementById('aiBatch')?.value || '10',
    ser: document.getElementById('aiSerial')?.value || '21'
});

// --- PRO BARCODE PARSER (GS1-128, Bracketed & Fallback) ---
const parseProBarcode = (raw, rowNum = 0) => {
    if (!raw) return { mat: "", isValid: false, error: "Empty" };
    let s = String(raw).trim();
    const cf = getCustomAIs();
    let res = { mat: "", batch: "", ser: "", isDefaultSer: false, isValid: false, error: "", qty: null, expiryDate: null };

    // 1. BRACKETED FORMAT (e.g. (01)123(10)ABC)
    if (s.includes('(')) {
        s = s.replace(/[\u0000-\u001F]/g, ""); // Clean control chars

        const extract = (aiList) => {
            if (!Array.isArray(aiList)) aiList = [aiList];
            for (let ai of aiList) {
                const regex = new RegExp(`\\(${ai}\\)([^()]+)`);
                const m = s.match(regex);
                if (m) return m[1].trim();
            }
            return null;
        };

        let mat = extract([cf.mat, '01', '02', '240', '241']);
        let batch = extract([cf.batch, '10', '23', '310']);
        let ser = extract([cf.ser, '21', '250']);
        let qty = extract(['37', '30']);
        let expStr = extract(['17', '15']);

        if (mat) {
            res.mat = clean(mat);
            if (res.mat.length === 14 && res.mat.startsWith('00')) res.mat = res.mat.substring(2);
            res.isValid = true;
        } else {
            res.error = "Missing Material AI";
        }

        if (batch) res.batch = clean(batch);
        else { res.batch = "-"; }

        if (ser) res.ser = clean(ser);
        else { res.ser = "001"; res.isDefaultSer = true; }

        if (qty) {
            let q = parseFloat(qty);
            if (!isNaN(q)) res.qty = q;
        }

        if (expStr && expStr.length >= 6) {
            try {
                let dStr = expStr.substring(0, 6);
                const yy = parseInt(dStr.substring(0, 2));
                const mm = parseInt(dStr.substring(2, 4));
                const dd = parseInt(dStr.substring(4, 6));
                res.expiryDate = new Date(2000 + yy, mm - 1, dd);
            } catch (e) { }
        }

        return res;
    }

    // 2. RAW / FALLBACK (Material Only)
    if (s.length > 3) {
        res.mat = clean(s);
        res.batch = "-";
        res.ser = "001";
        res.isDefaultSer = true;
        res.isValid = true;
        res.error = "";
        return res;
    }

    return res;
};

// --- MAIN ---
async function runValidation() {
    // Trigger pre-validation first
    const fScan = document.getElementById('fileScan').files[0];
    const fSys = document.getElementById('fileSystem').files[0];

    if (!fScan || !fSys) {
        alert("Please upload both files.");
        return;
    }

    const btn = document.getElementById('btnRun');
    btn.innerHTML = `<div class="spinner"></div> CHECKING FILES...`;
    btn.disabled = true;

    try {
        const { checks, allPassed } = await preValidateFiles(fScan, fSys);
        showPreValidationReport(checks, allPassed);
    } catch (e) {
        alert("Pre-validation error: " + e.message);
        btn.innerHTML = 'START VALIDATION';
        btn.disabled = false;
    }
}

async function actualValidation() {
    const startTime = Date.now(); // Track processing time
    const btn = document.getElementById('btnRun');
    btn.innerHTML = `<div class="spinner"></div> PROCESSING...`;
    document.getElementById('statusLog').innerHTML = "";

    const msgMatch = document.getElementById('txtMatch').value;
    const msgBatch = document.getElementById('txtBatch').value;
    const msgMat = document.getElementById('txtMat').value;
    const msgVar = document.getElementById('txtVar').value;

    // Get S.Loc Settings
    const goodSlocCode = document.getElementById('txtGoodSloc')?.value || 'RT01';
    const dmgSlocCode = document.getElementById('txtDmgSloc')?.value || 'DMG1';

    // --- [UPDATED LOGIC]: Get new settings ---
    const smartZero = document.getElementById('smartZero').checked;
    const useScanQty = document.getElementById('useScanQty').checked;
    // ----------------------------------------

    // Reset error tracking
    validationErrors = [];
    duplicateSerials = [];
    document.getElementById('errorPanel').classList.add('hidden');
    document.getElementById('duplicateWarning').classList.add('hidden');
    document.getElementById('summaryStats').classList.add('hidden');

    try {
        const fScan = document.getElementById('fileScan').files[0];
        const fSys = document.getElementById('fileSystem').files[0];
        if (!fScan || !fSys) throw new Error("Please upload both files.");

        const scanFileName = fScan.name;
        const sapFileName = fSys.name;

        updateProgress(10, 'Reading files...');
        const [rawScan, rawSys] = await Promise.all([readXlsx(fScan), readXlsx(fSys)]);

        // Check if already loaded by auto-load
        if (inventoryMap.size === 0) {
            updateProgress(20, 'Parsing SAP system data...');
            await loadSystemInventory(fSys);
        }

        // KPI will be updated later after counting all items in the Map
        log(`Loaded ${inventoryMap.size} unique inventory keys`);

        // Reset usage counts for re-runs to prevents stale state
        const resetCache = new Set();
        inventoryMap.forEach(items => {
            items.forEach(item => {
                if (!resetCache.has(item)) {
                    item.used = 0;
                    resetCache.add(item);
                }
            });
        });

        // --- DUPLICATE DETECTION ---
        updateProgress(30, 'Checking for duplicate serials...');
        log("Checking for duplicate serials...");
        const serialMap = new Map();
        duplicateSerials = []; // Reset

        inventoryMap.forEach((items, key) => {
            if (key.includes('||')) return; // Skip batch/material-only keys
            if (items.length > 1 && items[0].ser) {
                const item = items[0];
                // check if true duplicates (same serial) not just aliased keys
                const uniqueItems = new Set(items);
                if (uniqueItems.size > 1) {
                    duplicateSerials.push({
                        mat: item.mat,
                        batch: item.batch,
                        ser: item.ser,
                        count: items.length
                    });
                }
            }
        });

        if (duplicateSerials.length > 0) {
            const dupWarning = document.getElementById('duplicateWarning');
            const dupMessage = document.getElementById('duplicateMessage');
            dupMessage.innerText = `Found ${duplicateSerials.length} duplicate serial(s) in SAP data. This may cause incorrect matching results.`;
            dupWarning.classList.remove('hidden');
            log(`⚠️ WARNING: ${duplicateSerials.length} duplicate serial(s) detected`);
        }

        // --- SMART SCAN DETECTION (HEADER vs NO HEADER) ---
        let scanHeadRow = rawScan.findIndex(row => row.join("").toLowerCase().includes("scan"));
        let scanCol = -1;
        let startRow = 0;
        let isNoHeader = false;

        // 1. Check Row 0 for actual Data (e.g. "(01)")
        if (rawScan.length > 0) {
            const row0 = rawScan[0];
            const row0Str = row0.join("");
            if (row0Str.includes("(01)") || row0Str.includes("(240)")) {
                isNoHeader = true;
                scanCol = 0; // Assume col A
                startRow = 0; // Start from A1
                log("Detected: File has NO Header. Starting from A1.");
            }
        }

        // 2. If Row 0 is NOT data, look for header
        if (!isNoHeader) {
            if (scanHeadRow > -1) {
                scanCol = rawScan[scanHeadRow].findIndex(c => String(c).toLowerCase().includes("scan"));
                startRow = scanHeadRow + 1;
                log("Detected: Header found at Row " + (scanHeadRow + 1));
            } else {
                // Fallback
                startRow = 0; scanCol = 0;
                log("Warning: No Header found, assuming A1 is data.");
            }
        }

        // --- SCAN HEADER PARSING ---
        let scanDescCol = -1;
        let scanCustCol = -1;
        let scanCustCodeCol = -1;
        // --- [UPDATED LOGIC]: Scan Qty Column ---
        let scanQtyCol = -1;

        if (scanHeadRow >= 0) {
            const row = rawScan[scanHeadRow].map(c => String(c).toLowerCase());
            scanDescCol = row.findIndex(c => c.includes('desc') || c.includes('text') || c.includes('material name') || c.includes('spec') || c.includes('detail') || c.includes('title'));
            scanCustCol = row.findIndex(c => c.includes('name') || c.includes('client') || c.includes('buyer') || c.includes('account'));
            scanCustCodeCol = row.findIndex(c => (c.includes('cust') && (c.includes('code') || c.includes('no') || c.includes('id'))) || c.includes('party') || c.includes('sold-to') || (c.includes('customer') && !c.includes('name')));
            // --- [UPDATED LOGIC] ---
            if (useScanQty) {
                scanQtyCol = row.findIndex(c => c.includes('qty') || c.includes('quantity') || c.includes('count'));
                if (scanQtyCol > -1) log(`✓ Scan Qty column detected at index ${scanQtyCol}`);
            }

            if (scanDescCol > -1) log(`✓ Scan Description column detected at index ${scanDescCol}`);
            if (scanCustCol > -1) log(`✓ Scan Customer Name column detected at index ${scanCustCol}`);
            if (scanCustCodeCol > -1) log(`✓ Scan Customer Code column detected at index ${scanCustCodeCol}`);
        }

        // --- COLUMN B CONDITION DETECTION ---
        let conditionCol = -1;
        if (scanCol >= 0) {
            // Check if Column B (next to scan column) exists
            if (scanHeadRow >= 0 && rawScan[scanHeadRow].length > scanCol + 1) {
                const nextHeader = rawScan[scanHeadRow][scanCol + 1]?.toString().toLowerCase();
                if (nextHeader.includes('condition') || nextHeader.includes('status')) {
                    conditionCol = scanCol + 1;
                    log(`✓ Condition column detected at index ${conditionCol} (${rawScan[scanHeadRow][conditionCol]})`);
                }
            }

            // If no header or header doesn't match, assume Column B is condition
            if (conditionCol === -1 && rawScan[0].length > scanCol + 1) {
                conditionCol = scanCol + 1;
                log(`Assuming Column B (index ${conditionCol}) is condition column`);
            }
        }

        globalData = [];
        let stats = { tot: 0, s: 0, b: 0, m: 0, v: 0 };

        // Stock status counters
        let stockStats = {
            damage: 0,
            expired: 0,
            nearExpiry: 0,
            shortExpiry: 0,
            goodStock: 0,
            noExpiry: 0
        };

        // Load expiry settings
        const expirySettings = loadExpirySettings();

        // Get concatenation settings
        const enableConcat = document.getElementById('enableConcat')?.checked ?? true;
        const concatDelimiter = document.getElementById('concatDelimiter')?.value ?? '';

        // Process scans with enhanced error handling and progress tracking
        updateProgress(40, 'Processing scanned items...');
        const totalScans = rawScan.length - startRow;

        // --- MULTI-PASS LOGIC (V13 Fix) ---
        // We must buffer all scans first, then run matching in priority order:
        // 1. MBS (Exact) -> 2. MB (Batch) -> 3. Mat (Material)

        let parsedScans = [];

        // PASS 0: PARSING & STATS
        for (let i = startRow; i < rawScan.length; i++) {
            const raw = rawScan[i][scanCol];
            if (!raw) continue;

            const actualRowNum = i + 1;
            const p = parseProBarcode(raw, actualRowNum);

            // Read Scan Quantity
            let currentScanQty = 1;
            if (p.qty) {
                currentScanQty = p.qty;
            } else if (scanQtyCol > -1) {
                let val = parseFloat(rawScan[i][scanQtyCol]);
                if (!isNaN(val) && val > 0) currentScanQty = val;
            }
            stats.tot += currentScanQty;

            // Parse other fields
            const condition = conditionCol >= 0 ? clean(rawScan[i][conditionCol]) : '';
            const expiryDate = p.expiryDate || parseGS1Expiry(raw);
            const stockStatus = classifyMaterialStatus(condition, expiryDate, expirySettings);

            // Update Stock Stats
            switch (stockStatus.status) {
                case 'DAMAGE': stockStats.damage++; break;
                case 'EXPIRED': stockStats.expired++; break;
                case 'NEAR EXPIRY': stockStats.nearExpiry++; break;
                case 'SHORT EXPIRY': stockStats.shortExpiry++; break;
                case 'GOOD STOCK': stockStats.goodStock++; break;
                case 'NO EXPIRY': stockStats.noExpiry++; break;
            }

            // Scan Metadata
            const scanDesc = scanDescCol > -1 ? clean(rawScan[i][scanDescCol]) : "";
            const scanCust = scanCustCol > -1 ? clean(rawScan[i][scanCustCol]) : "";
            const scanCustCode = scanCustCodeCol > -1 ? clean(rawScan[i][scanCustCodeCol]) : "";

            parsedScans.push({
                idx: i,
                p,
                qty: currentScanQty,
                condition,
                expiryDate,
                stockStatus,
                raw,
                scanDesc,
                scanCust,
                scanCustCode,
                matched: false,
                matchType: null, // "Exact", "Batch Match", "Material Only", "Concat"
                matchRef: null
            });
        }

        // MATCHING HELPERS
        const priorityList = (document.getElementById('plantPriority')?.value || "").split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
        const getBestMatch = (candidates) => {
            if (!candidates || candidates.length === 0) return null;
            // Only consider available inventory
            let available = candidates.filter(inv => inv.qty - inv.used > 0);
            if (available.length === 0) return null;

            if (priorityList.length > 0) {
                available.sort((a, b) => {
                    let pA = priorityList.indexOf(String(a.plant).toUpperCase());
                    let pB = priorityList.indexOf(String(b.plant).toUpperCase());
                    if (pA === -1) pA = 999;
                    if (pB === -1) pB = 999;
                    return pA - pB;
                });
            }
            return available[0];
        };

        const consume = (scan, match, type) => {
            let consumeAmount = Math.min(scan.qty, match.qty - match.used);
            match.used += consumeAmount;
            scan.matched = true;
            scan.matchRef = match;
            scan.matchType = type;
            scan.consumed = consumeAmount;

            if (type === 'Exact' || type === 'Concat') stats.s += consumeAmount;
            else if (type === 'Batch Match') stats.b += consumeAmount;
            else if (type === 'Material Only') stats.m += consumeAmount;
        };

        // PASS 1: EXACT MATCH (MBS)
        parsedScans.forEach(scan => {
            if (!scan.p.isValid || !scan.p.mat) return;

            // Try Exact
            const exactKey = `${scan.p.mat}|${scan.p.batch}|${scan.p.ser}`;
            let candidates = inventoryMap.get(exactKey);
            let match = getBestMatch(candidates);

            // Try Concat
            if (!match && enableConcat) {
                const longSerial = (scan.p.batch + concatDelimiter + scan.p.ser);
                if (longSerial) {
                    const concatKey = `${scan.p.mat}|${scan.p.batch}|${longSerial}`;
                    candidates = inventoryMap.get(concatKey);
                    if (candidates) match = getBestMatch(candidates);
                    if (match) { consume(scan, match, "Concat"); return; }
                }
            }

            if (match) { consume(scan, match, "Exact"); }
        });

        // PASS 2: BATCH MATCH (MB)
        parsedScans.forEach(scan => {
            if (scan.matched || !scan.p.isValid || !scan.p.mat) return;

            const batchKey = `${scan.p.mat}|${scan.p.batch}|`;
            let candidates = inventoryMap.get(batchKey);
            let match = getBestMatch(candidates);

            if (match) { consume(scan, match, "Batch Match"); }
        });

        // PASS 3: MATERIAL MATCH (M)
        parsedScans.forEach(scan => {
            if (scan.matched || !scan.p.isValid || !scan.p.mat) return;

            const matKey = `${scan.p.mat}||`;
            let candidates = inventoryMap.get(matKey);
            let match = getBestMatch(candidates);

            if (match) { consume(scan, match, "Material Only"); }
        });

        // FINAL PASS: BUILD GLOBAL DATA
        parsedScans.forEach(scan => {
            if (!scan.p.isValid || !scan.p.mat) {
                globalData.push({
                    status: 'Error',
                    css: 'bg-red-200 text-red-900',
                    statusPriority: -1,
                    logic: 'Parse Error',
                    detail: scan.p.error || 'Invalid barcode',
                    mat: scan.p.mat || '???',
                    phyBatch: scan.p.batch, phySer: scan.p.ser,
                    sysBatch: '-', sysSer: '-',
                    isDefaultSer: scan.p.isDefaultSer,
                    condition: scan.condition,
                    expiryDate: scan.expiryDate,
                    stockStatus: scan.stockStatus,
                    raw: scan.raw
                });
                stats.v++;
                return;
            }

            let status = "Variance";
            let css = "bg-red-100 text-red-800";
            let statusPriority = 0;
            let logic = "-";
            let detail = msgVar;

            const match = scan.matchRef;

            if (scan.matched) {
                const consumed = scan.consumed;
                const diff = scan.qty - consumed;

                if (diff > 0) {
                    stats.v += diff;
                    status = "Variance (Partial)";
                    css = "bg-red-50 text-red-900 border-l-4 border-red-500";
                    detail += ` | Stock Exhausted. Matched: ${consumed}, Variance: ${diff}`;
                    statusPriority = 4;
                } else {
                    if (scan.matchType === 'Exact' || scan.matchType === 'Concat') {
                        status = "Matched"; css = "bg-green-100 text-green-800"; statusPriority = 3;
                        detail = msgMatch;
                    } else if (scan.matchType === 'Batch Match') {
                        status = "Partial"; css = "bg-yellow-100 text-yellow-800"; detail = msgBatch; statusPriority = 2;
                    } else {
                        status = "Warning"; css = "bg-orange-100 text-orange-800"; detail = msgMat; statusPriority = 1;
                    }
                }
                logic = scan.matchType;
            } else {
                stats.v += scan.qty;
            }

            // Metadata Lookup
            let finalDesc = match ? (match.desc || scan.scanDesc || MATERIAL_MASTER[scan.p.mat] || "") : (scan.scanDesc || MATERIAL_MASTER[scan.p.mat] || "");
            let finalCustCode = scan.scanCustCode || (match ? match.custCode : "") || "";
            let masterCustName = CUSTOMER_MASTER[finalCustCode];
            if (!masterCustName && !isNaN(parseFloat(finalCustCode))) {
                masterCustName = CUSTOMER_MASTER[String(parseFloat(finalCustCode))];
            }
            masterCustName = masterCustName || "";
            let finalCust = match ? (match.custName || scan.scanCust || masterCustName || "") : (scan.scanCust || masterCustName || "");

            // S.Loc
            const enableAutoSloc = document.getElementById('autoSloc')?.checked ?? true;
            let finalSloc = enableAutoSloc ? ((scan.stockStatus.status === 'GOOD STOCK') ? goodSlocCode : dmgSlocCode) : (match ? (match.sloc || "-") : "");

            globalData.push({
                status, css, statusPriority, logic, detail,
                mat: scan.p.mat,
                desc: finalDesc,
                cust: finalCust,
                custCode: finalCustCode,
                phyBatch: scan.p.batch, phySer: scan.p.ser,
                sysBatch: match ? match.batch : '-',
                sysSer: match ? match.ser : '-',
                sysPlant: match ? (match.plant || '-') : '-',
                sysExpiry: match ? (match.expiry || '-') : '-',
                sysAge: match ? (match.age || "-") : "-",
                sysSloc: match ? (match.sloc || '-') : '-',
                billDoc: match ? (match.billDoc || '-') : '-',
                billDate: match ? (match.billDate || '-') : '-',
                sLoc: finalSloc,
                isDefaultSer: scan.p.isDefaultSer,
                condition: scan.condition,
                expiryDate: scan.expiryDate,
                stockStatus: scan.stockStatus,
                raw: scan.raw
            });
        });

        // CALC REMAINING with progress tracking
        updateProgress(85, 'Calculating remaining inventory...');
        let totalConsumedQty = 0;

        // --- [UPDATED LOGIC]: Count remaining qty ---
        const countedItems = new Set();
        inventoryMap.forEach((items) => {
            items.forEach(item => {
                // Need a unique ID for item object ref
                if (!countedItems.has(item)) {
                    totalConsumedQty += item.used;
                    countedItems.add(item);
                }
            });
        });

        let remaining = totalSysItemsInitial - totalConsumedQty;

        // UPDATE KPIS
        updateProgress(90, 'Updating dashboard...');
        document.getElementById('kpi-sys-total').innerText = totalSysItemsInitial; // Show total quantity
        document.getElementById('kpi-total').innerText = stats.tot; // Show total scanned quantity

        let scanInfoText = isNoHeader
            ? `(No Header Detected, Processed A1-End)`
            : `(Header Detected, Processed Data after header)`;
        document.getElementById('kpi-scan-info').innerText = scanInfoText;

        document.getElementById('kpi-serial').innerText = stats.s;
        document.getElementById('kpi-batch').innerText = stats.b;
        document.getElementById('kpi-mat').innerText = stats.m;
        document.getElementById('kpi-var').innerText = stats.v;
        document.getElementById('kpi-remain').innerText = remaining;

        // --- SAVE TO SUPABASE ---
        await saveUserData('MHPL', {
            globalData,
            kpis: {
                sysTotal: totalSysItemsInitial,
                tot: stats.tot,
                s: stats.s,
                b: stats.b,
                m: stats.m,
                v: stats.v,
                remain: remaining
            },
            timestamp: new Date().toISOString()
        });

        // Update stock status KPIs
        document.getElementById('kpi-damage').innerText = stockStats.damage;
        document.getElementById('kpi-expired').innerText = stockStats.expired;
        document.getElementById('kpi-near-expiry').innerText = stockStats.nearExpiry;
        document.getElementById('kpi-short-expiry').innerText = stockStats.shortExpiry;
        document.getElementById('kpi-good-stock').innerText = stockStats.goodStock;

        displayedData = [...globalData];
        updateProgress(95, 'Rendering results table...');
        sortBy('statusPriority');

        updateProgress(100, 'Validation complete!');
        document.getElementById('dashboard').classList.remove('hidden');

        // Show error panel if errors exist
        showErrorPanel();

        // Calculate and show summary statistics
        const processingTime = Date.now() - startTime;
        updateSummaryStats(stats, stats.tot, processingTime, scanFileName, sapFileName);

        // Save to history
        const matched = stats.s + stats.b + stats.m;
        const matchRate = stats.tot > 0 ? ((matched / stats.tot) * 100).toFixed(1) : '0';
        saveToHistory({
            scanFile: scanFileName,
            sapFile: sapFileName,
            totalScanned: stats.tot,
            matched: matched,
            matchRate: matchRate,
            processingTime: (processingTime / 1000).toFixed(2) + 's',
            data: globalData
        });

        // Enhanced completion message
        let completionMsg = `<i class="fas fa-check-circle mr-2"></i> VALIDATION COMPLETE`;
        if (validationErrors.length > 0) {
            completionMsg += ` (${validationErrors.length} warnings/errors)`;
        }
        btn.innerHTML = completionMsg;
        log("Validation Finished.");

        // Hide progress bar after 1 second
        setTimeout(hideProgress, 1000);

    } catch (e) {
        alert("Error: " + e.message);
        btn.innerHTML = "Try Again";
    }
}

function renderTable(data) {
    // Use active layout if available, otherwise fall back to all columns
    const layout = layouts[activeLayoutId];
    if (!layout) return;

    const tbody = document.getElementById('tableBody');
    const thead = document.querySelector('thead tr');

    // 1. Dynamic Headers
    if (thead) {
        thead.innerHTML = layout.columns.map(c => {
            const isFiltered = activeFilters && activeFilters[c.key];
            const iconClass = isFiltered
                ? "fas fa-filter text-blue-600 bg-blue-50 ml-2 cursor-pointer p-1 rounded active-filter-icon shadow-sm border border-blue-200"
                : "fas fa-filter text-gray-300 hover:text-blue-600 ml-2 cursor-pointer p-1 rounded hover:bg-gray-100 active-filter-icon";

            return `
                    <th class="px-4 py-3 border-b relative ${c.key.includes('phy') ? 'th-phy border-l' : ''} ${c.key.includes('sys') && c.key !== 'sysPlant' ? 'th-sys' : ''}">
                        <div class="flex items-center justify-between group">
                            <div class="flex items-center cursor-pointer flex-1 hover:text-blue-700" onclick="sortBy('${c.key}')">
                                ${c.header} <i id="icon-${c.key}" class="fas fa-sort text-gray-400 ml-1 opacity-50 group-hover:opacity-100"></i>
                            </div>
                            <i onclick="openSuperFilter('${c.key}', event)" class="${iconClass}" id="filter-icon-${c.key}" title="Filter ${c.header}"></i>
                        </div>
                        <div class="resizer"></div>
                    </th>
                `}).join('');
        // Reinitialize resize after header change
        setTimeout(initResize, 100);
    }

    // 2. Dynamic Rows
    tbody.innerHTML = data.map(r => {
        let cells = layout.columns.map(col => {
            let val = r[col.key] || '';
            let cellClass = 'px-4 py-3 text-xs';
            let content = '';

            // Special formatting for specific columns
            switch (col.key) {
                case 'status':
                    content = `<span class="px-2 py-1 rounded text-xs font-bold ${r.css}">${r.status}</span>`;
                    break;

                case 'logic':
                    cellClass += ' text-gray-500 font-mono';
                    content = r.logic;
                    break;

                case 'mat':
                    cellClass += ' font-medium';
                    content = r.mat;
                    break;

                case 'desc':
                    cellClass += ' text-gray-600 truncate max-w-xs';
                    content = `<span title="${r.desc}">${r.desc}</span>`;
                    break;

                case 'cust':
                case 'custCode':
                    cellClass += ' text-gray-700 font-mono';
                    content = val || '-';
                    break;

                case 'sysPlant':
                case 'sLoc':
                    cellClass += ' text-gray-700 font-mono text-center';
                    content = val || '-';
                    break;

                case 'phyBatch':
                    cellClass += ' text-gray-600 bg-blue-50 border-l border-blue-200';
                    content = r.phyBatch;
                    break;

                case 'phySer':
                    const serialClass = r.isDefaultSer ? 'default-serial px-4 py-3 text-xs border-r border-blue-200' : 'px-4 py-3 text-gray-600 text-xs border-r border-blue-200 bg-blue-50';
                    const serialIcon = r.isDefaultSer ? '<i class="fas fa-exclamation-triangle ml-1" title="Default 001"></i>' : '';
                    cellClass = serialClass;
                    content = r.phySer + serialIcon;
                    break;

                case 'sysBatch':
                    cellClass += ' text-green-800 bg-green-50 font-bold border-l border-green-200';
                    content = r.sysBatch;
                    break;

                case 'sysSer':
                    cellClass += ' text-green-800 bg-green-50 border-r border-green-200';
                    content = r.sysSer;
                    break;

                case 'condition':
                    cellClass += ' text-gray-700';
                    content = r.condition || '-';
                    break;

                case 'expiryDate':
                    cellClass += ' text-gray-700 font-mono';
                    content = r.expiryDate ? r.expiryDate.toLocaleDateString('en-GB') : '-';
                    break;

                case 'sysExpiry':
                    cellClass += ' text-green-700 font-mono';
                    content = r.sysExpiry || '-';
                    break;

                case 'billDoc':
                    cellClass += ' text-gray-700 font-mono';
                    content = r.billDoc || '-';
                    break;

                case 'billDate':
                    cellClass += ' text-gray-700';
                    content = r.billDate || '-';
                    break;

                case 'daysLeft':
                    cellClass += ' fw-bold text-right';
                    content = r.stockStatus?.daysLeft !== null && r.stockStatus?.daysLeft !== undefined ? r.stockStatus.daysLeft + 'd' : '-';
                    break;

                case 'stockStatus':
                    cellClass = 'px-4 py-3 text-xs';
                    content = `<span class="px-2 py-1 rounded border ${r.stockStatus?.css || 'bg-gray-100 text-gray-400'}">${r.stockStatus?.icon || ''} ${r.stockStatus?.status || '-'}</span>`;
                    break;

                case 'detail':
                    cellClass += ' text-gray-400 italic';
                    content = r.detail;
                    break;

                case 'raw':
                    cellClass += ' text-gray-400 font-mono truncate max-w-xs';
                    content = `<span title="${r.raw}">${r.raw}</span>`;
                    break;

                default:
                    content = val;
            }
            return `<td class="${cellClass}">${content}</td>`;
        }).join('');

        return `<tr class="hover:bg-gray-50 border-b border-gray-100 transition">${cells}</tr>`;
    }).join('');
}

// ==========================================
// SUPER FILTER LOGIC
// ==========================================
let activeFilters = {};

function openSuperFilter(key, event) {
    event.stopPropagation();
    const existing = document.querySelector('.super-filter-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.className = 'super-filter-panel animate-fade';

    // Positioning
    let left = event.pageX;
    if (left + 280 > window.innerWidth) left = window.innerWidth - 300;
    panel.style.left = `${left}px`;
    panel.style.top = `${event.pageY + 10}px`;

    // Data Analysis
    const counts = {};
    let isNumeric = true;
    let isDate = key.toLowerCase().includes('date') || key.toLowerCase().includes('expiry');

    globalData.forEach(r => {
        const v = r[key] || "(Blank)";
        counts[v] = (counts[v] || 0) + 1;
        // Check numeric
        if (isNumeric && v !== "(Blank)" && isNaN(parseFloat(v))) isNumeric = false;
    });
    const uniqueValues = Object.keys(counts).sort();

    // Active State
    const active = activeFilters[key] || { values: null, min: "", max: "" };
    const minVal = active.min || "";
    const maxVal = active.max || "";

    let html = `
                <div class="filter-header">
                    <span class="font-bold text-xs uppercase text-gray-500 tracking-wider">Filter: ${key}</span>
                    <button onclick="this.closest('.super-filter-panel').remove()" class="text-gray-400 hover:text-red-500"><i class="fas fa-times"></i></button>
                </div>
                
                <!-- SORT BUTTONS -->
                <div class="p-2 border-b bg-gray-50 flex gap-2">
                    <button onclick="sortBy('${key}', 'asc'); document.querySelector('.super-filter-panel').remove()" class="flex-1 bg-white border rounded p-1 text-xs hover:bg-blue-50 text-gray-600 flex items-center justify-center gap-1 shadow-sm"><i class="fas fa-arrow-down-a-z text-blue-500"></i> ${isNumeric ? 'Smallest' : 'Ascending'}</button>
                    <button onclick="sortBy('${key}', 'desc'); document.querySelector('.super-filter-panel').remove()" class="flex-1 bg-white border rounded p-1 text-xs hover:bg-blue-50 text-gray-600 flex items-center justify-center gap-1 shadow-sm"><i class="fas fa-arrow-down-z-a text-blue-500"></i> ${isNumeric ? 'Largest' : 'Descending'}</button>
                </div>

                <!-- RANGE / CONDITION FILTER -->
                <div class="p-2 border-b bg-white">
                    <div class="text-[10px] font-bold text-gray-400 uppercase mb-1">
                         ${isDate ? 'Date Range' : (isNumeric ? 'Number Range' : 'Text Search')}
                    </div>
            `;

    if (isNumeric || isDate) {
        html += `
                    <div class="flex gap-2 mb-2">
                        <input type="text" id="filter-min-${key}" value="${minVal}" placeholder="${isDate ? 'YYYY-MM-DD' : 'Min / >'}" class="w-1/2 text-xs p-1 border rounded focus:border-blue-500">
                        <input type="text" id="filter-max-${key}" value="${maxVal}" placeholder="${isDate ? 'YYYY-MM-DD' : 'Max / <'}" class="w-1/2 text-xs p-1 border rounded focus:border-blue-500">
                    </div>
                 `;
    }

    html += `
                    <input type="text" placeholder="Search List..." class="w-full text-xs p-2 border rounded bg-gray-50 focus:bg-white focus:outline-blue-500 transition" onkeyup="filterFilterList(this)">
                </div>
                
                <div class="filter-body text-left">
                    <label class="filter-row font-bold text-blue-600 border-b mb-1 pb-1">
                        <input type="checkbox" onchange="toggleAllFilters(this)" class="mr-2 rounded text-blue-600">
                        Select All
                    </label>
            `;

    uniqueValues.forEach(v => {
        const safeV = String(v).replace(/"/g, '&quot;');
        // Check logic: If filter is active, check if value in set. If NO filter active (new), keys checked? 
        // Usually "Select All". If active filter exists, use it.
        // If active.values is NULL, it means "All Selected" (implied) or range only.
        // If filter exists but values is null, assume all checked.
        const isChecked = (!activeFilters[key] || !activeFilters[key].values || activeFilters[key].values.has(v)) ? 'checked' : '';

        html += `
                    <label class="filter-row">
                        <input type="checkbox" value="${safeV}" ${isChecked} class="mr-2 rounded text-blue-600 filter-check">
                        <span class="text-xs truncate flex-1" title="${safeV}">${v}</span>
                        <span class="text-[10px] text-gray-400 bg-gray-100 px-1 rounded ml-1">${counts[v]}</span>
                    </label>
                `;
    });

    html += `</div>
                <div class="filter-footer">
                    <button onclick="clearFilter('${key}')" class="text-xs text-gray-500 font-bold hover:text-red-600 mr-auto">Clear</button>
                    <button onclick="applyFilter('${key}', this)" class="bg-blue-600 text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-blue-700 shadow-sm transition">APPLY</button>
                </div>
            `;

    panel.innerHTML = html;
    document.body.appendChild(panel);

    setTimeout(() => {
        const closer = (e) => {
            if (!panel.contains(e.target) && !e.target.closest('.active-filter-icon')) {
                panel.remove();
                document.removeEventListener('click', closer);
            }
        };
        document.addEventListener('click', closer);
    }, 100);
}

function filterFilterList(input) {
    const term = input.value.toLowerCase();
    const labels = input.parentElement.parentElement.querySelectorAll('.filter-body .filter-row:not(:first-child)'); // Adjusted selector
    labels.forEach(l => {
        const txt = l.querySelector('span').innerText.toLowerCase();
        l.style.display = txt.includes(term) ? 'flex' : 'none';
    });
}

function toggleAllFilters(source) {
    const inputs = source.closest('.filter-body').querySelectorAll('.filter-check');
    inputs.forEach(i => {
        if (i.parentElement.style.display !== 'none') i.checked = source.checked;
    });
}

function applyFilter(key, btn) {
    const panel = btn.closest('.super-filter-panel');
    const inputs = panel.querySelectorAll('.filter-check:checked');
    const totalInputs = panel.querySelectorAll('.filter-check').length;
    const values = new Set();
    inputs.forEach(i => values.add(i.value));

    // Logic: Is it a Subset?
    // If Checked < Total, we have a list filter.
    // OR if Range inputs have value.

    const minInput = document.getElementById(`filter-min-${key}`);
    const maxInput = document.getElementById(`filter-max-${key}`);
    const minVal = minInput ? minInput.value.trim() : "";
    const maxVal = maxInput ? maxInput.value.trim() : "";

    const hasRange = minVal !== "" || maxVal !== "";
    // Special Case: If ALL checked and NO range => No Filter.
    // If SOME checked OR Range => Filter Active.

    if (inputs.length === totalInputs && !hasRange) {
        // Clear Filter
        delete activeFilters[key];
        const icon = document.getElementById('filter-icon-' + key);
        if (icon) icon.className = 'fas fa-filter text-gray-300 hover:text-blue-600 ml-2 cursor-pointer p-1 rounded hover:bg-gray-100 active-filter-icon';
    } else {
        // Active Filter
        activeFilters[key] = {
            type: 'complex',
            values: inputs.length < totalInputs ? values : null, // Null means "All List Items" (checked)
            min: minVal,
            max: maxVal
        };
        const icon = document.getElementById('filter-icon-' + key);
        if (icon) icon.className = 'fas fa-filter text-blue-600 bg-blue-50 ml-2 cursor-pointer p-1 rounded active-filter-icon shadow-sm border border-blue-200';
    }

    if (panel) panel.remove();
    runSuperFilter();
}

function clearFilter(key) {
    delete activeFilters[key];
    const icon = document.getElementById('filter-icon-' + key);
    if (icon) icon.className = 'fas fa-filter text-gray-300 hover:text-blue-600 ml-2 cursor-pointer p-1 rounded hover:bg-gray-100 active-filter-icon';

    const panel = document.querySelector('.super-filter-panel');
    if (panel) panel.remove();

    runSuperFilter();
}

function runSuperFilter() {
    filterData();
}

function filterData() {
    const term = document.getElementById('searchBox').value.toLowerCase();

    displayedData = globalData.filter(r => {
        // 1. Global Search
        if (term) {
            const matchGlobal = Object.values(r).some(v => String(v).toLowerCase().includes(term));
            if (!matchGlobal) return false;
        }

        // 2. Super Filters
        for (const key in activeFilters) {
            const f = activeFilters[key];
            let val = r[key];

            // A) List Filter (Set) - Only if values is NOT null
            if (f.values) {
                const safeV = String(val || "(Blank)").replace(/"/g, '&quot;');
                if (!f.values.has(safeV)) return false;
            }

            // B) Range Filter (Min/Max)
            if (f.min || f.max) {
                let numVal = parseFloat(val);
                // Date parsing if key implies?
                if (key.toLowerCase().includes('date') || key.toLowerCase().includes('expiry')) {
                    // Attempt to parse Date
                    let d = new Date(val); // Assuming val is Date obj or string
                    if (val instanceof Date) d = val;
                    // Compare time?
                    if (f.min) {
                        let minD = new Date(f.min);
                        if (!isNaN(minD) && d < minD) return false;
                    }
                    if (f.max) {
                        let maxD = new Date(f.max);
                        if (!isNaN(maxD) && d > maxD) return false;
                    }
                } else if (!isNaN(numVal)) {
                    // Numeric
                    if (f.min !== "" && !isNaN(parseFloat(f.min)) && numVal < parseFloat(f.min)) return false;
                    if (f.max !== "" && !isNaN(parseFloat(f.max)) && numVal > parseFloat(f.max)) return false;
                }
            }
        }

        return true;
    });

    renderTable(displayedData);
    updateFilterChips();
}

function updateFilterChips() {
    const bar = document.getElementById('activeFiltersBar');
    if (!bar) return;

    if (Object.keys(activeFilters).length === 0) {
        bar.innerHTML = '';
        bar.classList.add('hidden');
        return;
    }

    bar.classList.remove('hidden');
    let html = '<span class="text-xs font-bold text-gray-400 mr-2 flex items-center uppercase tracking-wider"><i class="fas fa-filter mr-1"></i> Active:</span>';

    for (const key in activeFilters) {
        const f = activeFilters[key];
        // Lookup header label
        const layout = layouts[activeLayoutId];
        const colDef = layout.columns.find(c => c.key === key);
        const label = colDef ? colDef.header : key;

        let parts = [];
        // List Filter
        if (f.values) {
            const arr = [...f.values];
            // Unescape for display
            if (arr.length === 1) parts.push(arr[0].replace(/&quot;/g, '"'));
            else parts.push(`${arr.length} selected`);
        }

        // Range Filter
        if (f.min) parts.push(`≥ ${f.min}`);
        if (f.max) parts.push(`≤ ${f.max}`);

        if (parts.length === 0) parts.push("Active");

        html += `
                    <div class="filter-chip">
                        <span class="text-blue-800">${label}: <b class="text-black">${parts.join(' & ')}</b></span>
                        <button onclick="clearFilter('${key}')" class="hover:bg-blue-200 rounded-full w-4 h-4 flex items-center justify-center"><i class="fas fa-times text-[9px]"></i></button>
                    </div>
                `;
    }

    html += `<button onclick="clearAllFilters()" class="text-[10px] text-gray-500 hover:text-red-600 underline ml-2 font-bold decoration-dotted">CLEAR ALL</button>`;
    bar.innerHTML = html;
}

function clearAllFilters() {
    activeFilters = {};
    document.querySelectorAll('.active-filter-icon').forEach(i => i.className = 'fas fa-filter text-gray-300 hover:text-blue-600 ml-2 cursor-pointer p-1 rounded hover:bg-gray-100 active-filter-icon');
    filterData();
}

function exportResult() {
    if (globalData.length === 0) { alert("No data to export"); return; }
    const wb = XLSX.utils.book_new();

    // --- SHEET 1: Validation Results (Custom Layout & Style) ---
    let layoutStr = document.getElementById('exportLayout')?.value || "";
    if (!layoutStr.trim()) layoutStr = "Status, Logic, Material, Description, Customer Name, Customer Code, Plant, S.Loc, Phy Batch, Phy Serial, Sys Batch, Sys Serial, Condition, Expiry Date, Sys Expiry, Days Left, Stock Status, Comment";
    const keys = layoutStr.split(',').map(k => k.trim());

    const proData = [];
    // Header
    proData.push(keys.map(h => ({
        v: h, t: 's',
        s: { fill: { fgColor: { rgb: "4F81BD" } }, font: { color: { rgb: "FFFFFF" }, bold: true }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }, alignment: { horizontal: "center" } }
    })));

    // Rows
    globalData.forEach(item => {
        const row = keys.map(key => {
            let val = "";
            switch (key.toLowerCase()) {
                case 'status': val = item.status; break;
                case 'logic': val = item.logic; break;
                case 'material': val = item.mat; break;
                case 'description': val = item.desc; break;
                case 'customer':
                case 'customer name': val = item.cust; break;
                case 'customer code': val = item.custCode; break;
                case 'plant': val = item.sysPlant; break;
                case 's.loc': val = item.sLoc; break;
                case 'phy batch': val = item.phyBatch; break;
                case 'phy serial': val = item.phySer; break;
                case 'sys batch': val = item.sysBatch; break;
                case 'sys serial': val = item.sysSer; break;
                case 'condition': val = item.condition; break;
                case 'expiry date': val = item.expiryDate ? item.expiryDate.toLocaleDateString('en-GB') : ""; break;
                case 'sys expiry': val = item.sysExpiry; break;
                case 'ageing': val = item.sysAge; break;
                case 'days left': val = item.stockStatus?.daysLeft !== undefined && item.stockStatus?.daysLeft !== null ? item.stockStatus.daysLeft : ""; break;
                case 'stock status': val = item.stockStatus?.status || ""; break;
                case 'bill doc':
                case 'billing doc':
                case 'billing document': val = item.billDoc || ""; break;
                case 'bill date':
                case 'billing date': val = item.billDate || ""; break;
                case 'comment': val = item.detail; break;
                default: val = "";
            }
            return {
                v: val, t: 's',
                s: { border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } }
            };
        });
        proData.push(row);
    });

    const wsResults = XLSX.utils.aoa_to_sheet(proData);
    wsResults['!cols'] = keys.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, wsResults, "Validation Results");

    // --- AUX SHEETS ---
    const damageData = globalData.filter(r => r.stockStatus?.status === 'DAMAGE').map(r => ({ Material: r.mat, Batch: r.phyBatch, Serial: r.phySer, Link: r.detail }));
    if (damageData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(damageData), "Damage Report");

    const expiryData = globalData.filter(r => ['EXPIRED', 'NEAR EXPIRY'].includes(r.stockStatus?.status)).map(r => ({ Status: r.stockStatus?.status, Material: r.mat, Expiry: r.expiryDate }));
    if (expiryData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expiryData), "Expiry Report");

    const summaryData = [{ Property: 'Scan File', Value: document.getElementById('stat-scan-file')?.innerText || '-' }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Metadata");

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    XLSX.writeFile(wb, `ZCPU_Validation_v13_${timestamp}.xlsx`);
}

// --- RESIZE LOGIC (V13 - FIXED) ---
function initResize() {
    const cols = document.querySelectorAll('th');
    cols.forEach((col) => {
        const resizer = col.querySelector('.resizer');
        if (!resizer) return;
        let x = 0; let w = 0;

        const mouseDownHandler = (e) => {
            // STOP PROPAGATION HERE TO PREVENT SORT
            e.stopPropagation();
            e.preventDefault();

            x = e.clientX;
            const styles = window.getComputedStyle(col);
            w = parseInt(styles.width, 10);
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
            resizer.classList.add('resizing');
        };

        const mouseMoveHandler = (e) => {
            const dx = e.clientX - x;
            col.style.width = `${w + dx}px`;
        };

        const mouseUpHandler = () => {
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
            resizer.classList.remove('resizing');
        };

        // Add click listener to stop bubble on click too
        resizer.addEventListener('click', (e) => e.stopPropagation());
        resizer.addEventListener('mousedown', mouseDownHandler);
    });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    initDB();
    initResize();
    renderQuickExportButtons();
});

// ==========================================
// ADVANCED LAYOUT MANAGER LOGIC
// ==========================================

// 1. Define Columns (Ensure these keys match your data keys)
const ALL_COLUMNS = [
    { key: 'status', label: 'Match Status', default: true },
    { key: 'logic', label: 'Logic', default: true },
    { key: 'mat', label: 'Material', default: true },
    { key: 'desc', label: 'Description', default: true },
    { key: 'billDoc', label: 'Billing Doc', default: true },
    { key: 'billDate', label: 'Billing Date', default: true },
    { key: 'cust', label: 'Customer Name', default: true },
    { key: 'custCode', label: 'Customer Code', default: true },
    { key: 'sysPlant', label: 'Plant', default: true },
    { key: 'sLoc', label: 'Storage Loc', default: true },
    { key: 'phyBatch', label: 'Phy Batch', default: true },
    { key: 'phySer', label: 'Phy Serial', default: true },
    { key: 'sysBatch', label: 'Sys Batch', default: true },
    { key: 'sysSer', label: 'Sys Serial', default: true },
    { key: 'condition', label: 'Condition', default: true },
    { key: 'expiryDate', label: 'Expiry Date', default: false },
    { key: 'sysExpiry', label: 'Sys Expiry', default: false },
    { key: 'sysAge', label: 'Ageing', default: true },
    { key: 'stockStatus', label: 'Stock Status', default: true },
    { key: 'detail', label: 'Comment', default: true },
    { key: 'raw', label: 'Scan String', default: false }
];

let layouts = JSON.parse(localStorage.getItem('sapVal_layouts_v3') || '{}');
let activeLayoutId = 'standard';
let editingLayout = [];

// Initialize Default if empty
if (Object.keys(layouts).length === 0) {
    layouts['standard'] = {
        name: 'Standard View',
        columns: ALL_COLUMNS.filter(c => c.default).map(c => ({ ...c, header: c.label, width: 15 }))
    };
    layouts['simple'] = {
        name: 'Simple Check',
        columns: ALL_COLUMNS.filter(c => ['status', 'mat', 'phyBatch', 'phySer'].includes(c.key)).map(c => ({ ...c, header: c.label, width: 20 }))
    };
    localStorage.setItem('sapVal_layouts_v3', JSON.stringify(layouts));
}

// --- Functions ---

function renderSavedLayoutsList() {
    const list = document.getElementById('savedLayoutsList');
    list.innerHTML = '';
    Object.keys(layouts).forEach(id => {
        const div = document.createElement('div');
        div.className = `p-2 cursor-pointer hover:bg-blue-50 rounded flex justify-between items-center ${id === activeLayoutId ? 'bg-blue-100 border-l-4 border-blue-600' : ''}`;
        div.innerText = layouts[id].name;
        div.onclick = () => { activeLayoutId = id; renderSavedLayoutsList(); loadLayoutToEditor(id); };
        list.appendChild(div);
    });
}

function loadLayoutToEditor(id) {
    activeLayoutId = id;
    renderSavedLayoutsList();
    const layout = layouts[id];
    document.getElementById('layoutNameInput').value = layout.name;

    // Merge logic
    const enabledMap = new Map(layout.columns.map(c => [c.key, c]));
    editingLayout = [];
    layout.columns.forEach(c => editingLayout.push({ ...c, enabled: true }));
    ALL_COLUMNS.forEach(def => {
        if (!enabledMap.has(def.key)) {
            editingLayout.push({ key: def.key, label: def.label, header: def.label, width: 15, enabled: false });
        }
    });
    renderColumnEditor();
}

function renderColumnEditor() {
    const list = document.getElementById('columnEditorList');
    list.innerHTML = '';
    editingLayout.forEach((col, index) => {
        const div = document.createElement('div');
        div.className = `grid grid-cols-12 gap-2 p-2 items-center border-b ${col.enabled ? 'bg-white' : 'bg-gray-100 opacity-60'}`;
        div.innerHTML = `
                    <div class="col-span-1 text-center"><input type="checkbox" onchange="toggleCol(${index})" ${col.enabled ? 'checked' : ''}></div>
                    <div class="col-span-4 text-xs font-bold truncate">${col.label}</div>
                    <div class="col-span-4"><input type="text" value="${col.header}" onchange="editCol(${index}, 'header', this.value)" class="border p-1 w-full text-xs" ${!col.enabled ? 'disabled' : ''}></div>
                    <div class="col-span-1"><input type="number" value="${col.width}" onchange="editCol(${index}, 'width', this.value)" class="border p-1 w-full text-xs" ${!col.enabled ? 'disabled' : ''}></div>
                    <div class="col-span-2 text-center">
                        <button onclick="moveCol(${index}, -1)" class="text-blue-600 font-bold px-1">↑</button>
                        <button onclick="moveCol(${index}, 1)" class="text-blue-600 font-bold px-1">↓</button>
                    </div>
                `;
        list.appendChild(div);
    });
}

function toggleCol(i) { editingLayout[i].enabled = !editingLayout[i].enabled; renderColumnEditor(); }
function editCol(i, k, v) { editingLayout[i][k] = v; }
function moveCol(i, d) {
    const t = i + d;
    if (t >= 0 && t < editingLayout.length) {
        [editingLayout[i], editingLayout[t]] = [editingLayout[t], editingLayout[i]];
        renderColumnEditor();
    }
}

function createNewLayout() {
    const id = 'cust_' + Date.now();
    layouts[id] = { name: 'New Layout', columns: ALL_COLUMNS.filter(c => c.default).map(c => ({ ...c, header: c.label, width: 15 })) };
    loadLayoutToEditor(id);
}

function saveCurrentLayout() {
    const name = document.getElementById('layoutNameInput').value;
    if (!name) return alert("Name required");
    const finalCols = editingLayout.filter(c => c.enabled).map(c => ({ key: c.key, label: c.label, header: c.header, width: c.width }));
    layouts[activeLayoutId] = { name: name, columns: finalCols };
    localStorage.setItem('sapVal_layouts_v3', JSON.stringify(layouts));
    renderSavedLayoutsList();
    renderQuickExportButtons();
    alert("Layout Saved!");
}

function deleteCurrentLayout() {
    if (Object.keys(layouts).length <= 1) return alert("Keep at least one layout");
    delete layouts[activeLayoutId];
    activeLayoutId = Object.keys(layouts)[0];
    localStorage.setItem('sapVal_layouts_v3', JSON.stringify(layouts));
    loadLayoutToEditor(activeLayoutId);
    renderQuickExportButtons();
}

function renderQuickExportButtons() {
    const c = document.getElementById('quickExportButtons');
    if (!c) return;
    c.innerHTML = '';
    Object.keys(layouts).forEach(id => {
        const l = layouts[id];
        const isActive = id === activeLayoutId;
        const btn = document.createElement('div');
        btn.className = `cursor-pointer px-3 py-1 text-xs rounded flex items-center gap-2 border ${isActive ? 'bg-white text-black font-bold' : 'bg-gray-700 border-gray-600 hover:bg-gray-600'}`;
        btn.innerHTML = `
                    <span onclick="applyLayout('${id}')">${l.name}</span>
                    <i class="fas fa-file-excel hover:text-green-400 pl-2 border-l border-gray-500" onclick="exportFormatted('${id}')" title="Export"></i>
                `;
        c.appendChild(btn);
    });
}

function applyLayout(id) {
    activeLayoutId = id;
    renderQuickExportButtons();
    // Re-render table with new layout
    renderTable(displayedData.length > 0 ? displayedData : globalData);
}

// --- ADVANCED EXPORT ---
function exportFormatted(layoutId) {
    if (!globalData || !globalData.length) return alert("No data");
    const layout = layouts[layoutId];

    // Header
    const header = layout.columns.map(c => ({
        v: c.header, t: 's', s: { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "4472C4" } }, alignment: { horizontal: "center" } }
    }));

    // Data
    const rows = globalData.map((r, i) => {
        return layout.columns.map(c => {
            let val = r[c.key] || '';

            // Handle stock status object
            if (c.key === 'stockStatus' && typeof val === 'object') {
                val = val.status || '';
            }

            // Handle expiry date object
            if (c.key === 'expiryDate' && val instanceof Date) {
                val = val.toLocaleDateString();
            }
            // Strip HTML from any field
            if (typeof val === 'string' && val.includes('<')) val = val.replace(/<[^>]*>?/gm, '');

            let color = "000000";
            if (val === 'Matched') color = "008000";
            if (val === 'Variance' || val === 'Error') color = "FF0000";
            if (val === 'Partial') color = "FFA500";
            if (val === 'Warning') color = "FF8C00";

            return {
                v: val, t: 's',
                s: { fill: { fgColor: { rgb: i % 2 === 0 ? "FFFFFF" : "F2F2F2" } }, font: { color: { rgb: color } }, border: { bottom: { style: 'thin', color: { rgb: "CCCCCC" } } } }
            };
        });
    });

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws['!cols'] = layout.columns.map(c => ({ wch: parseInt(c.width) || 15 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    XLSX.writeFile(wb, `${layout.name}_Export_${timestamp}.xlsx`);
}

// ==========================================
// LIVE SCAN MODE LOGIC
// ==========================================

let liveSessionData = [];
let liveSessionStats = { matched: 0, variance: 0, duplicate: 0, total: 0 };
let liveScanActive = false;
let liveScanPaused = false;
let inventoryMapForLive = new Map(); // Deep copy for live consumption
let scannedSerials = new Set(); // For duplicate detection
let liveScanCondition = 'Good';

function setLiveCondition(cond) {
    liveScanCondition = cond;
    const btnGood = document.getElementById('btnCondGood');
    const btnDamage = document.getElementById('btnCondDamage');
    const header = document.querySelector('#liveScanModal > div:first-child');

    // Reset styles
    btnGood.className = 'px-6 py-2 rounded font-bold bg-transparent text-gray-300 hover:text-white transition';
    btnDamage.className = 'px-6 py-2 rounded font-bold bg-transparent text-gray-300 hover:text-white transition';

    if (cond === 'Good') {
        btnGood.className = 'px-6 py-2 rounded font-bold bg-green-500 text-white shadow ring-2 ring-white';
        header.className = 'bg-green-800 text-white p-4 flex justify-between items-center shadow-lg transition-colors duration-300';
    } else {
        btnDamage.className = 'px-6 py-2 rounded font-bold bg-red-600 text-white shadow ring-2 ring-white';
        header.className = 'bg-red-800 text-white p-4 flex justify-between items-center shadow-lg transition-colors duration-300';
    }
    document.getElementById('liveScanInput').focus();
}

// Sound Generation
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function playSound(type) {
    if (!audioCtx) audioCtx = new AudioContext();

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'success') {
        oscillator.frequency.value = 800;
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'error') {
        oscillator.frequency.value = 300;
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'duplicate') {
        // Double beep
        oscillator.frequency.value = 600;
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.15);

        setTimeout(() => {
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.frequency.value = 600;
            gain2.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
            osc2.start(audioCtx.currentTime);
            osc2.stop(audioCtx.currentTime + 0.15);
        }, 200);
    }
}

function enableBulkMode() {
    // Show bulk section immediately
    const bulkSection = document.getElementById('bulkUploadSection');
    bulkSection.classList.remove('hidden');

    // Scroll to it
    setTimeout(() => {
        bulkSection.scrollIntoView({ behavior: 'smooth' });
    }, 100);
}

function openLiveScanMode() {
    // Check if SAP file uploaded - warning only, don't block
    if (!inventoryMap || inventoryMap.size === 0) {
        console.warn("Live Scan started without SAP data");
        // Optional: alert("⚠️ Warning: No SAP file loaded. All scans will be 'Variance'.");
    }

    // Initialize session
    liveSessionData = [];
    liveSessionStats = { matched: 0, variance: 0, duplicate: 0, total: 0 };
    scannedSerials = new Set();
    liveScanActive = true;
    liveScanPaused = false;

    // Deep copy inventory map (Safely)
    inventoryMapForLive = new Map();
    const itemCache = new Map(); // Cache to preserve object references

    if (inventoryMap && inventoryMap.size > 0) {
        inventoryMap.forEach((items, key) => {
            const matchedItems = items.map(item => {
                if (!itemCache.has(item)) {
                    // Link new live item to original to preserve shared state logic in live map
                    itemCache.set(item, { ...item, used: item.used || 0 });
                }
                return itemCache.get(item);
            });
            inventoryMapForLive.set(key, matchedItems);
        });
    }

    // Show modal
    document.getElementById('liveScanModal').classList.remove('hidden');

    // Focus input
    setTimeout(() => {
        const input = document.getElementById('liveScanInput');
        input.value = '';
        input.focus();
    }, 100);

    updateLiveStats();
    renderLiveScansTable();
}

function closeLiveScanMode() {
    if (liveSessionData.length > 0) {
        if (!confirm("⚠️ Session data will be lost. Continue?")) return;
    }
    document.getElementById('liveScanModal').classList.add('hidden');
    liveScanActive = false;
}

function toggleLivePause() {
    liveScanPaused = !liveScanPaused;
    const btn = document.getElementById('livePauseBtn');
    const input = document.getElementById('liveScanInput');

    if (liveScanPaused) {
        btn.innerHTML = '<i class="fas fa-play mr-2"></i> RESUME';
        btn.className = 'bg-green-500 hover:bg-green-600 px-4 py-2 rounded font-bold';
        input.disabled = true;
        input.classList.add('opacity-50');
    } else {
        btn.innerHTML = '<i class="fas fa-pause mr-2"></i> PAUSE';
        btn.className = 'bg-yellow-500 hover:bg-yellow-600 px-4 py-2 rounded font-bold';
        input.disabled = false;
        input.classList.remove('opacity-50');
        input.focus();
    }
}

// Main validation function
function validateLiveScan(barcode) {
    if (liveScanPaused) return;

    const parsed = parseProBarcode(barcode.trim());
    if (!parsed || !parsed.mat) {
        showLiveStatus('error', 'INVALID BARCODE', 'Could not parse barcode');
        playSound('error');
        return;
    }

    const { mat, batch, ser } = parsed;
    let status = 'Variance';
    let detail = 'Not found in SAP';
    let matchType = 'Variance';
    let sysPlant = '-';
    let sysSloc = '-';

    // Check Duplicate
    const uniqueKey = `${mat}|${batch}|${ser}`;
    // If serial is present and not default "001" and already scanned
    if (ser && ser !== '001' && scannedSerials.has(uniqueKey)) {
        showLiveStatus('duplicate', 'DUPLICATE SCAN', `SN: ${ser} already scanned!`);
        playSound('duplicate');
        return; // Stop processing
    }

    // --- Matching Logic (Same priority as bulk) ---
    // 1. Exact Match
    // 2. Batch Match
    // 3. Material Match

    let match = null;

    // Priority List Support (if needed in future, adding basic support now)
    const getLiveMatch = (items) => items.find(i => (i.qty - i.used) > 0);
    // Deep priority logic omitted for speed, can add if requested.

    // 1. Exact
    const exactKey = `${mat}|${batch}|${ser}`;
    if (inventoryMapForLive.has(exactKey)) {
        match = getLiveMatch(inventoryMapForLive.get(exactKey));
        if (match) matchType = 'Exact';
    }

    // 2. Batch (if no exact)
    if (!match) {
        const batchKey = `${mat}|${batch}|`;
        if (inventoryMapForLive.has(batchKey)) {
            match = getLiveMatch(inventoryMapForLive.get(batchKey));
            if (match) matchType = 'Batch Match';
        }
    }

    // 3. Material (if no batch)
    if (!match) {
        const matKey = `${mat}||`;
        if (inventoryMapForLive.has(matKey)) {
            match = getLiveMatch(inventoryMapForLive.get(matKey));
            if (match) matchType = 'Material Match';
        }
    }

    // Update Status
    if (match) {
        status = 'Matched';
        detail = matchType;
        match.used++; // Consume 1 qty
        sysPlant = match.plant;
        sysSloc = match.sloc;
        playSound('success');
        showLiveStatus('success', 'MATCH CONFIRMED', `${matchType}: ${mat} / ${batch}`);
    } else {
        playSound('error');
        showLiveStatus('error', 'VARIANCE DETECTED', `Using scan data: ${mat}`);
    }

    // Add to session
    if (ser && ser !== '001') scannedSerials.add(uniqueKey);

    liveSessionData.unshift({
        id: Date.now(),
        img: liveScanCondition === 'Good' ? 'https://via.placeholder.com/40/22c55e/ffffff?text=OK' : 'https://via.placeholder.com/40/ef4444/ffffff?text=DMG',
        mat,
        desc: match ? match.desc : (MATERIAL_MASTER[mat] || "Unknown Material"),
        batch: batch || "-",
        ser: ser || "-",
        status: status,
        condition: liveScanCondition,
        plant: sysPlant,
        sloc: sysSloc,
        timestamp: new Date().toLocaleTimeString()
    });

    // Update Stats
    liveSessionStats.total++;
    if (status === 'Matched') liveSessionStats.matched++;
    else liveSessionStats.variance++;

    updateLiveStats();
    renderLiveScansTable();

    // Clear input
    document.getElementById('liveScanInput').value = '';
}

// Input Listener
document.getElementById('liveScanInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const val = e.target.value;
        if (val) validateLiveScan(val);
    }
});

function showLiveStatus(type, title, msg) {
    const el = document.getElementById('liveScanStatus');
    const color = type === 'success' ? 'bg-green-600' : (type === 'duplicate' ? 'bg-orange-500' : 'bg-red-600');
    el.className = `${color} text-white p-4 rounded mb-4 shadow-lg animate-fade`;
    el.innerHTML = `
                <div class="flex items-center">
                    <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'} text-3xl mr-4"></i>
                    <div>
                        <div class="font-bold text-lg">${title}</div>
                        <div class="text-sm opacity-90">${msg}</div>
                    </div>
                </div>
            `;
}

function updateLiveStats() {
    document.getElementById('liveStatMatched').innerText = liveSessionStats.matched;
    document.getElementById('liveStatVariance').innerText = liveSessionStats.variance;
    document.getElementById('liveStatTotal').innerText = liveSessionStats.total;
}

function renderLiveScansTable() {
    const tbody = document.getElementById('liveScanBody');
    tbody.innerHTML = liveSessionData.slice(0, 50).map(r => `
                <tr class="border-b hover:bg-gray-50 animate-fade">
                    <td class="p-2"><img src="${r.img}" class="w-8 h-8 rounded"></td>
                    <td class="p-2 text-xs font-mono font-bold">${r.mat}</td>
                    <td class="p-2 text-xs text-gray-600 truncate max-w-[150px]">${r.desc}</td>
                    <td class="p-2 text-xs text-center">${r.batch}<br><span class="text-[10px] text-gray-400">Batch</span></td>
                    <td class="p-2 text-xs text-center">${r.ser}<br><span class="text-[10px] text-gray-400">Serial</span></td>
                    <td class="p-2"><span class="px-2 py-1 rounded text-[10px] font-bold ${r.status === 'Matched' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${r.status}</span></td>
                    <td class="p-2 text-[10px] text-gray-400 text-right">${r.timestamp}</td>
                </tr>
            `).join('');
}

function finishLiveScan() {
    if (!confirm("Are you sure you want to finish this session? This will export the data.")) return;

    // Export to Excel
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(liveSessionData.map(r => ({
        Material: r.mat,
        Description: r.desc,
        Batch: r.batch,
        Serial: r.ser,
        Status: r.status,
        Condition: r.condition,
        Plant: r.plant,
        SLoc: r.sloc,
        Timestamp: r.timestamp
    })));

    XLSX.utils.book_append_sheet(wb, ws, "Live Scan Session");
    XLSX.writeFile(wb, `LiveScan_Session_${new Date().toISOString().slice(0, 10)}.xlsx`);

    closeLiveScanMode();
}

// Diagnostic Tool (Hidden Feature)
window.runDiagnostics = () => {
    console.log('--- DIAGNOSTICS ---');
    console.log('Inventory Keys:', inventoryMap.size);
    console.log('Global Data:', globalData.length);
    console.log('Memory Usage:', window.performance.memory ? window.performance.memory.usedJSHeapSize : 'N/A');
};

// Layout Compatibility Check
if (!localStorage.getItem('sapVal_layouts_v3')) {
    console.log("Migrating layouts to v3 (Advanced Fields)...");
    localStorage.removeItem('sapVal_layouts_v2'); // Clean up old
}

// Global Shortcuts
document.addEventListener('keydown', (e) => {
    // ALT+L for Live Scan
    if (e.altKey && e.key === 'l') {
        e.preventDefault();
        openLiveScanMode();
    }
});
