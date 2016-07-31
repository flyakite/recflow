'use strict'

const {remote, ipcRenderer} = require('electron');
const {Menu} = remote;

module.exports = {
  create: ()=> {
    const appMenu = Menu.buildFromTemplate([
      {
        label: 'File',
        submenu: [
          {
            label: 'Quit',
            accelerator: 'CmdOrCtrl+Q',
            selector: 'terminate:' //osx only
          }
        ]
      }
    ]);
    Menu.setApplicationMenu(appMenu);
  }
};
