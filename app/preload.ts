import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("minitron", {
  getCoreUrl: () => ipcRenderer.invoke("core:url") as Promise<string>,
});

export {};
