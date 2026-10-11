(() => {const id=window.__installStreetWindowId;if(!id)return;const pending=new Map(),listeners=new Map();let seq=1;
const ipcRenderer={invoke(channel,...args){const requestId=seq++;return new Promise((resolve,reject)=>{pending.set(requestId,{resolve,reject});window.chrome.webview.postMessage({id:requestId,channel,args});});},on(channel,cb){if(!listeners.has(channel))listeners.set(channel,new Set());listeners.get(channel).add(cb);},removeListener(channel,cb){listeners.get(channel)?.delete(cb);}};
window.chrome.webview.addEventListener('message',e=>{const m=typeof e.data==='string'?JSON.parse(e.data):e.data;if(m.type==='result'){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(m.error)):p.resolve(m.value);}}if(m.type==='event')for(const cb of listeners.get(m.channel)||[])cb(null,m.value);});
const contextBridge={exposeInMainWorld:(name,value)=>Object.defineProperty(window,name,{value:Object.freeze(value),writable:false,configurable:false})};
contextBridge.exposeInMainWorld('installstreet', {
  start: (mode, identity, tasks) => ipcRenderer.invoke('setup:start', mode, identity, tasks),
  cancelSetup: () => ipcRenderer.invoke('setup:cancel'),
  presets: (action, value, id) => ipcRenderer.invoke('presets', action, value, id),
  buildMedia: value => ipcRenderer.invoke('media:build', value),
  flashMedia: () => ipcRenderer.invoke('media:flash'),
  gitStatus: () => ipcRenderer.invoke('setup:git-status'),
  updateSettings: () => ipcRenderer.invoke('updates:settings'),
  saveUpdateSettings: value => ipcRenderer.invoke('updates:save',value),
  checkUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  onUpdateState: callback => {const listener=(_event,value)=>callback(value);ipcRenderer.on('updates:state',listener);return ()=>ipcRenderer.removeListener('updates:state',listener);},
  openStorage: () => ipcRenderer.invoke('storage:open'),
  openIcons8: () => ipcRenderer.invoke('brand:icons8'),
  closeSetup: () => ipcRenderer.invoke('setup:close'),
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

})();
