const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('installstreet', {
  start: (mode, identity) => ipcRenderer.invoke('setup:start', mode, identity),
  gitStatus: () => ipcRenderer.invoke('setup:git-status'),
  openLogs: () => ipcRenderer.invoke('setup:logs'),
  onLog: callback => { const handler = (_event, text) => callback(text); ipcRenderer.on('setup:log', handler); return () => ipcRenderer.removeListener('setup:log', handler); },
  onState: callback => { const handler = (_event, state) => callback(state); ipcRenderer.on('setup:state', handler); return () => ipcRenderer.removeListener('setup:state', handler); }
});

