// import.js — JSON backup import & CSV member import

App.registerPage('import', initImportPage);

function initImportPage() {
  setupDropZone('json-drop-zone', 'json-file-input', handleJSONImport);
  setupDropZone('csv-drop-zone', 'csv-file-input', handleCSVImport);
}

function setupDropZone(zoneId, inputId, handler) {
  const zone  = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  if (!zone || !input) return;
  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', e => { if (e.target.files[0]) handler(e.target.files[0]); });
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handler(e.dataTransfer.files[0]);
  });
}

async function handleJSONImport(file) {
  if (!file.name.endsWith('.json')) { App.toast('Select a .json file', 'error'); return; }
  const resultEl = document.getElementById('json-import-result');
  try {
    const text = await readFile(file);
    const data = JSON.parse(text);
    
    // Structure check
    const tables = data.tables || data;
    const metadata = data.metadata || { version: '1.0' };
    
    if (!tables.members && !tables.monthlyPayments) {
      App.toast('Invalid backup file structure', 'error'); return;
    }

    const mCount  = tables.members?.length || 0;
    const mpCount = tables.monthlyPayments?.length || 0;
    const mode    = document.getElementById('import-mode')?.value || 'replace';
    
    App.confirm('Import JSON Backup',
      `Backup Version: ${metadata.version || '1.0'}\nFound: ${mCount} members, ${mpCount} payments.\nMode: ${mode.toUpperCase()}\n\nWarning: This will sync your local database with this file. Continue?`,
      async () => {
        resultEl.innerHTML = `<div class="loading-inline">⏳ Importing data, please wait...</div>`;
        
        try {
          await DB.importFullBackup(data, mode, (status) => {
            resultEl.innerHTML = `<div style="font-size:0.85rem;color:var(--text-secondary);padding:8px">⌛ ${status}</div>`;
          });
          
          App.toast(`Import complete! ✅`, 'success');
          resultEl.innerHTML =
            `<div style="background:var(--success-bg);border:1px solid rgba(16,185,129,.3);color:var(--success);padding:14px;border-radius:var(--radius-sm);margin-top:12px">
              ✅ Import successful!<br>
              <small>Members: ${mCount} | Records: ${mpCount} | Version: ${metadata.version || '1.0'}</small>
             </div>`;
          
          // Refresh if on a data page
          if (['dashboard','members','monthly','history'].includes(App.currentPage)) {
            setTimeout(() => location.reload(), 1500);
          }
        } catch (err) {
          App.toast('Import failed: ' + err.message, 'error');
          resultEl.innerHTML = `<div class="badge badge-danger">❌ Import failed: ${err.message}</div>`;
        }
      }, false);
  } catch(e) { 
    App.toast('Parse error: ' + e.message, 'error');
    resultEl.innerHTML = `<div class="badge badge-danger">❌ Parse error: ${e.message}</div>`;
  }
}

async function handleCSVImport(file) {
  if (!file.name.endsWith('.csv')) { App.toast('Select a .csv file', 'error'); return; }
  try {
    const text = await readFile(file);
    const rows = parseCSV(text);
    if (rows.length < 2) { App.toast('CSV has no data rows', 'error'); return; }
    const headers = rows[0].map(h => h.trim().toLowerCase());
    const nameIdx = headers.findIndex(h => h.includes('name'));
    if (nameIdx === -1) { App.toast('CSV must have a "Name" column', 'error'); return; }
    const mobileIdx = headers.findIndex(h => h.includes('mobile'));
    const nidIdx    = headers.findIndex(h => h.includes('nid'));
    const dobIdx    = headers.findIndex(h => h.includes('dob') || h.includes('birth'));
    const addrIdx   = headers.findIndex(h => h.includes('address'));
    const joinIdx   = headers.findIndex(h => h.includes('join'));
    const members   = rows.slice(1).filter(r => r[nameIdx]?.trim()).map(r => ({
      fullName: r[nameIdx]?.trim(), mobile: r[mobileIdx]?.trim()||'',
      nid:      r[nidIdx]?.trim()||'', dob: r[dobIdx]?.trim()||'',
      address:  r[addrIdx]?.trim()||'', joinDate: r[joinIdx]?.trim() || new Date().toISOString().split('T')[0]
    }));
    App.confirm('Import Members from CSV',
      `Ready to import ${members.length} members. Continue?`,
      async () => {
        let count = 0;
        for (const m of members) { if (m.fullName) { await DB.addMember(m); count++; } }
        App.toast(`Imported ${count} members ✅`, 'success');
        document.getElementById('csv-import-result').innerHTML =
          `<div style="background:var(--success-bg);border:1px solid rgba(16,185,129,.3);color:var(--success);padding:14px;border-radius:var(--radius-sm);margin-top:12px">
            ✅ Imported ${count} members!
           </div>`;
      }, false);
  } catch(e) { App.toast('CSV error: ' + e.message, 'error'); }
}

function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = []; let cur = '', row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i+1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false; else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || (c === '\r' && text[i+1] === '\n')) {
        row.push(cur); cur = ''; rows.push(row); row = [];
        if (c === '\r') i++;
      } else cur += c;
    }
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}

function readFile(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload  = e => res(e.target.result);
    reader.onerror = () => rej(new Error('Failed to read file'));
    reader.readAsText(file, 'UTF-8');
  });
}
