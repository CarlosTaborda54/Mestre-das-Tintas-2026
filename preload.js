const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  exportPDF: (payload) => ipcRenderer.invoke('export-pdf', payload),
  importExcel: () => ipcRenderer.invoke('import-excel'),
  loadAppData: () => ipcRenderer.sendSync('load-app-data'),
  saveAppData: (data) => ipcRenderer.sendSync('save-app-data', data),
  saveBudgetAs: (data, filename, clientId) => ipcRenderer.invoke('save-budget-as', data, filename, clientId),
  saveFullBackup: (data, filename) => ipcRenderer.invoke('save-full-backup', data, filename),
  openWhatsapp: (url) => ipcRenderer.invoke('open-whatsapp', url),
  loadLastExternal: () => ipcRenderer.sendSync('load-last-external')
});
