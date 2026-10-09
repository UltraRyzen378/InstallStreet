const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('installstreet', {
  start: (mode, identity) => ipcRenderer.invoke('setup:start', mode, identity),
  gitStatus: () => ipcRenderer.invoke('setup:git-status'),
  updateSettings: () => ipcRenderer.invoke('updates:settings'),
  saveUpdateSettings: value => ipcRenderer.invoke('updates:save',value),
  checkUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  onUpdateState: callback => {const listener=(_event,value)=>callback(value);ipcRenderer.on('updates:state',listener);return ()=>ipcRenderer.removeListener('updates:state',listener);},
  openStorage: () => ipcRenderer.invoke('storage:open'),
  maintenanceCatalog: () => ipcRenderer.invoke('maintenance:catalog'),
  maintenanceStart: id => ipcRenderer.invoke('maintenance:start',id),
  maintenanceOpen: id => ipcRenderer.invoke('maintenance:open',id),
  onMaintenanceLog: callback => { const listener=(_event,value)=>callback(value);ipcRenderer.on('maintenance:log',listener);return ()=>ipcRenderer.removeListener('maintenance:log',listener); },
  onMaintenanceState: callback => { const listener=(_event,value)=>callback(value);ipcRenderer.on('maintenance:state',listener);return ()=>ipcRenderer.removeListener('maintenance:state',listener); },
  onMaintenanceProgress: callback => { const listener=(_event,value)=>callback(value);ipcRenderer.on('maintenance:progress',listener);return ()=>ipcRenderer.removeListener('maintenance:progress',listener); },
  openLogs: () => ipcRenderer.invoke('setup:logs'),
  onLog: callback => { const handler = (_event, text) => callback(text); ipcRenderer.on('setup:log', handler); return () => ipcRenderer.removeListener('setup:log', handler); },
  onState: callback => { const handler = (_event, state) => callback(state); ipcRenderer.on('setup:state', handler); return () => ipcRenderer.removeListener('setup:state', handler); }
});
