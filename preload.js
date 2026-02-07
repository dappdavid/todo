const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('todoStorage', {
  load: () => ipcRenderer.invoke('todos:load'),
  save: (todos) => ipcRenderer.invoke('todos:save', todos)
});
