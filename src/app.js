const {app, ipcMain, BrowserWindow} = require('electron');
require('electron-reload')(__dirname);

let mainWindow = null;


app.on('ready', () => {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768
  });

  mainWindow.loadURL(`file://${__dirname}/windows/main/main.html`);
  mainWindow.openDevTools();
});
