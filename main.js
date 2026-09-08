const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');


const stateFile = () => path.join(app.getPath('userData'), 'mestre-das-tintas-data.json');
const lastPathsFile = () => path.join(app.getPath('userData'), 'mestre-das-tintas-lastpaths.json');

function readLastPaths() {
  try {
    const f = lastPathsFile();
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8')) || {};
  } catch (err) {}
  return {};
}

function writeLastPaths(obj) {
  try {
    const f = lastPathsFile();
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(obj || {}), 'utf8');
  } catch (err) {}
}

ipcMain.on('load-app-data', (event) => {
  try {
    const file = stateFile();
    if (fs.existsSync(file)) {
      event.returnValue = fs.readFileSync(file, 'utf8');
    } else {
      event.returnValue = '';
    }
  } catch (err) {
    event.returnValue = '';
  }
});

ipcMain.on('save-app-data', (event, data) => {
  try {
    const file = stateFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, String(data || ''), 'utf8');
    fs.renameSync(tmp, file);
    event.returnValue = true;
  } catch (err) {
    event.returnValue = false;
  }
});



ipcMain.handle('open-whatsapp', async (event, url) => {
  const raw = String(url || '').trim();
  if (!/^https:\/\/wa\.me\/\d{10,15}$/.test(raw)) return false;
  try {
    await shell.openExternal(raw);
    return true;
  } catch (err) {
    dialog.showErrorBox('Não foi possível abrir o WhatsApp', String(err && err.message ? err.message : err));
    return false;
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1050,
    minHeight: 720,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.ico'),
    backgroundColor: '#f4f7fb',
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.js') }
  });

  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://wa.me/')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

function normalizeImportKey(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const IMPORT_HEADER_HINTS = [
  'produto','item','descricao','nome do produto','material','equipamento',
  'fornecedor','fabricante','marca','nome fornecedor','razao social',
  'cliente','nome cliente','categoria','quantidade','qtd','preco','valor',
  'valor unitario','preco unitario','ipi','icms','frete','cnpj','telefone',
  'whatsapp','email','condicao','observacao','detalhes','endereco'
];

function findImportHeaderRow(matrix) {
  let bestIndex = -1, bestScore = 0;
  for (let i = 0; i < Math.min(matrix.length, 30); i++) {
    const cells = (matrix[i] || []).map(normalizeImportKey).filter(Boolean);
    if (!cells.length) continue;
    let score = 0;
    for (const cell of cells) {
      if (IMPORT_HEADER_HINTS.some(h => cell === h || cell.includes(h) || h.includes(cell))) score++;
    }
    if (score > bestScore) { bestScore = score; bestIndex = i; }
  }
  return bestScore >= 1 ? bestIndex : matrix.findIndex(r => (r || []).some(v => String(v ?? '').trim() !== ''));
}

function sheetMatrixToRows(matrix, sheetName) {
  const rows = Array.isArray(matrix) ? matrix : [];
  const headerIndex = findImportHeaderRow(rows);
  if (headerIndex < 0) return [];
  const rawHeaders = rows[headerIndex] || [];
  const headers = [];
  const used = new Map();
  rawHeaders.forEach((value, i) => {
    let h = String(value ?? '').trim();
    if (!h) h = `Coluna ${i + 1}`;
    const base = h;
    const n = used.get(base) || 0;
    used.set(base, n + 1);
    if (n) h = `${base} ${n + 1}`;
    headers.push(h);
  });
  const out = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const arr = rows[i] || [];
    if (!arr.some(v => String(v ?? '').trim() !== '')) continue;
    const row = {};
    headers.forEach((h, c) => { row[h] = arr[c] ?? ''; });
    if (Object.values(row).some(v => String(v ?? '').trim() !== '')) out.push({ sheet: sheetName, row });
  }
  return out;
}

ipcMain.handle('import-excel', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    title: 'Importar produtos, fornecedores, clientes e orçamento',
    properties: ['openFile'],
    filters: [{ name: 'Planilhas Excel', extensions: ['xlsx','xls','xlsm','xlsb','csv'] }]
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  try {
    const filePath = result.filePaths[0];
    const ext = path.extname(filePath).toLowerCase();
    const rows = [];
    if (ext === '.csv') {
      const wb = XLSX.readFile(filePath, { type: 'file', cellDates: true, raw: false, codepage: 65001 });
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        rows.push(...sheetMatrixToRows(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false }), sheetName));
      }
    } else {
      const wb = XLSX.readFile(filePath, { cellDates: true, raw: false });
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        rows.push(...sheetMatrixToRows(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false }), sheetName));
      }
    }
    return { canceled: false, filePath, rows };
  } catch (err) {
    dialog.showErrorBox('Erro ao importar Excel', String(err && err.message ? err.message : err));
    return { canceled: false, error: String(err && err.message ? err.message : err) };
  }
});


ipcMain.handle('save-budget-as', async (event, data, filename='orcamento.json', clientId=null) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const safeName = String(filename || 'orcamento.json').replace(/[\\/:*?"<>|]/g,'_');
  const result = await dialog.showSaveDialog(win, {
    title: 'Salvar orçamento como',
    defaultPath: path.join(app.getPath('documents'), safeName),
    filters: [{ name: 'Orçamento / Backup', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return false;
  try {
    fs.writeFileSync(result.filePath, String(data || ''), 'utf8');
    if (clientId) {
      const lp = readLastPaths();
      lp.budgets = lp.budgets || {};
      lp.budgets[clientId] = result.filePath;
      writeLastPaths(lp);
    }
    return true;
  }
  catch (err) { dialog.showErrorBox('Erro ao salvar orçamento', String(err && err.message ? err.message : err)); return false; }
});


ipcMain.handle('save-full-backup', async (event, data, filename='mestre-das-tintas-backup.json') => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const safeName = String(filename || 'mestre-das-tintas-backup.json').replace(/[\\/:*?"<>|]/g,'_');
  const result = await dialog.showSaveDialog(win, {
    title: 'Salvar tudo — escolha onde guardar o backup completo',
    defaultPath: path.join(app.getPath('documents'), safeName),
    filters: [{ name: 'Backup Mestre das Tintas', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return false;
  try {
    fs.writeFileSync(result.filePath, String(data || ''), 'utf8');
    const lp = readLastPaths();
    lp.fullBackup = result.filePath;
    writeLastPaths(lp);
    return true;
  } catch (err) {
    dialog.showErrorBox('Erro ao salvar tudo', String(err && err.message ? err.message : err));
    return false;
  }
});

ipcMain.on('load-last-external', (event) => {
  try {
    const lp = readLastPaths();
    const out = {};
    let changed = false;
    if (lp.fullBackup) {
      if (fs.existsSync(lp.fullBackup)) {
        try { out.fullBackup = JSON.parse(fs.readFileSync(lp.fullBackup, 'utf8')); }
        catch (err) {}
      } else { delete lp.fullBackup; changed = true; }
    }
    if (lp.budgets) {
      const budgetsOut = {};
      for (const [cid, p] of Object.entries(lp.budgets)) {
        if (fs.existsSync(p)) {
          try { budgetsOut[cid] = JSON.parse(fs.readFileSync(p, 'utf8')); }
          catch (err) {}
        } else { delete lp.budgets[cid]; changed = true; }
      }
      out.budgets = budgetsOut;
    }
    if (changed) writeLastPaths(lp);
    event.returnValue = JSON.stringify(out);
  } catch (err) {
    event.returnValue = '';
  }
});

ipcMain.handle('export-pdf', async (event, payload = {}) => {
  const parent = BrowserWindow.fromWebContents(event.sender);
  if (!parent) return false;
  const result = await dialog.showSaveDialog(parent, {
    title: 'Salvar orçamento em PDF',
    defaultPath: path.join(app.getPath('documents'), `orcamento_${String(payload.client?.name || 'cliente').replace(/[^a-z0-9]+/gi,'_')}.pdf`),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (result.canceled || !result.filePath) return false;

  const escHtml = (v) => String(v ?? '').replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]));
  const brl = (n) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
  const num = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
  const client = payload.client || {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  const freights = payload.supplierFreights || {};
  const productCalc = (x) => {
    const base=num(x.qty)*num(x.unit); const ipi=base*num(x.ipi)/100; const icms=base*num(x.icms)/100;
    return {base,ipi,icms,total:base+ipi+icms};
  };
  const visible = items;
  const sums = visible.reduce((a,x)=>{const p=productCalc(x);a.base+=p.base;a.ipi+=p.ipi;a.icms+=p.icms;a.total+=p.total;return a},{base:0,ipi:0,icms:0,total:0});
  const freightTotal = Object.values(freights).reduce((a,v)=>a+num(v),0);
  const grand = sums.total + freightTotal;
  const logo = path.join(__dirname,'app','logo-mark.png');
  const logoUrl = 'file:///' + logo.replace(/\\/g,'/').replace(/ /g,'%20');

  const rows = visible.map((x,i)=>{
    const p=productCalc(x);
    return `<tr>
      <td class="num">${i+1}</td>
      <td><strong>${escHtml(x.name)}</strong>${x.supplier?`<div class="muted">${escHtml(x.supplier)}</div>`:''}</td>
      <td class="center">${num(x.qty)}</td>
      <td class="money">${x.unit!=null?brl(x.unit):'A consultar'}</td>
      <td class="center">${num(x.ipi).toFixed(2)}%</td>
      <td class="center">${num(x.icms).toFixed(2)}%</td>
      <td class="money strong">${x.unit!=null?brl(p.total):'—'}</td>
      <td>${escHtml(x.obs||'')}</td>
    </tr>`;
  }).join('');

  const freightRows = Object.entries(freights).filter(([_,v])=>num(v)>0).map(([name,v])=>`<div class="freight-row"><span>${escHtml(name)}</span><strong>${brl(v)}</strong></div>`).join('');
  const address=[client.address,client.number,client.complement,client.neighborhood,client.city,client.state,client.cep].filter(Boolean).join(', ');
  const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
    @page{size:A4 landscape;margin:12mm 10mm 12mm 10mm}
    *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172033;margin:0;font-size:10px}
    .header{display:grid;grid-template-columns:180px 1fr 150px;align-items:center;border-bottom:3px solid #0b2fc4;padding:0 0 10px;margin-bottom:12px;column-gap:12px}
    .brand{display:flex;align-items:center;justify-content:flex-start}.brand img{width:165px;height:60px;object-fit:contain;object-position:left center;display:block}.title{text-align:center;font-size:22px;font-weight:900;color:#0b2fc4;margin:0;letter-spacing:.02em}.date{font-size:9px;color:#667085;text-align:right}
    .date{font-size:9px;color:#667085;text-align:right}.client{border:1px solid #dfe4ec;border-radius:8px;padding:10px 12px;background:#f8fafc;margin-bottom:12px;display:grid;grid-template-columns:1fr 1fr;gap:4px 18px}.client h2{grid-column:1/-1;margin:0 0 5px;font-size:13px;color:#0b2fc4}.client div{line-height:1.45}.label{font-weight:700;color:#475467}
    table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#0b2fc4;color:white;padding:7px 6px;font-size:9px;text-transform:uppercase}td{border-bottom:1px solid #e4e8f0;padding:6px 5px;vertical-align:top;word-wrap:break-word}th:nth-child(1){width:4%}th:nth-child(2){width:29%}th:nth-child(3){width:7%}th:nth-child(4){width:10%}th:nth-child(5){width:7%}th:nth-child(6){width:7%}th:nth-child(7){width:11%}th:nth-child(8){width:25%}.num{text-align:center;color:#667085}.center{text-align:center}.money{text-align:right}.strong{font-weight:800;color:#0b2fc4}.muted{font-size:8px;color:#667085;margin-top:2px}
    .bottom{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.box{border:1px solid #dfe4ec;border-radius:8px;padding:9px}.box h3{margin:0 0 7px;font-size:11px;color:#0b2fc4}.freight-row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed #dfe4ec}.totals{margin-top:10px;margin-left:auto;width:320px;border-top:2px solid #0b2fc4;padding-top:8px}.tline{display:flex;justify-content:space-between;padding:3px 0}.grand{font-size:15px;font-weight:900;color:#0b2fc4;border-top:1px solid #dfe4ec;padding-top:6px;margin-top:5px}.foot{margin-top:10px;text-align:center;font-size:8px;color:#98a2b3;border-top:1px solid #eef1f5;padding-top:6px}
  </style></head><body>
  <div class="header"><div class="brand"><img src="${logoUrl}" alt="Mestre das Tintas"></div><div class="title">Orçamento e Compras</div><div class="date">${new Date(payload.generatedAt||Date.now()).toLocaleString('pt-BR')}</div></div>
  <section class="client"><h2>Dados do cliente</h2><div><span class="label">Nome / Razão social:</span> ${escHtml(client.name||'')}</div><div><span class="label">CPF / CNPJ:</span> ${escHtml(client.doc||'')}</div><div><span class="label">Telefone:</span> ${escHtml(client.phone||'')}</div><div><span class="label">WhatsApp:</span> ${escHtml(client.whatsapp||'')}</div><div><span class="label">E-mail:</span> ${escHtml(client.email||'')}</div><div><span class="label">Endereço:</span> ${escHtml(address)}</div></section>
  <table><thead><tr><th>#</th><th>Produto / Equipamento</th><th>Qtd.</th><th>Valor unit.</th><th>IPI</th><th>ICMS</th><th>Total</th><th>Observações</th></tr></thead><tbody>${rows || '<tr><td colspan="8" style="text-align:center;padding:20px">Nenhum item no orçamento.</td></tr>'}</tbody></table>
  <div class="bottom"><div class="box"><h3>Frete por fornecedor</h3>${freightRows||'<div class="muted">Nenhum frete informado.</div>'}</div><div><div class="totals"><div class="tline"><span>Subtotal</span><strong>${brl(sums.base)}</strong></div><div class="tline"><span>IPI</span><strong>${brl(sums.ipi)}</strong></div><div class="tline"><span>ICMS</span><strong>${brl(sums.icms)}</strong></div><div class="tline"><span>Frete</span><strong>${brl(freightTotal)}</strong></div><div class="tline grand"><span>Total do orçamento</span><strong>${brl(grand)}</strong></div></div></div></div>
  <div class="foot">Mestre das Tintas · Orçamento exclusivo do cliente · App criado por Carlos Taborda</div>
  </body></html>`;

  const printWin = new BrowserWindow({show:false,width:1400,height:1000,webPreferences:{nodeIntegration:false,contextIsolation:true}});
  try {
    await printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    await new Promise(r=>setTimeout(r,350));
    const data = await printWin.webContents.printToPDF({printBackground:true,landscape:true,pageSize:'A4',margins:{marginType:'custom',top:0.28,bottom:0.28,left:0.28,right:0.28}});
    fs.writeFileSync(result.filePath,data);
    return true;
  } catch(err){
    dialog.showErrorBox('Erro ao exportar PDF',String(err&&err.message?err.message:err));
    return false;
  } finally { printWin.close(); }
});

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('br.com.mestredastintas.orcamentos');
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
