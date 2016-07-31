'use strict';

const {ipcMain} = require('electron').remote;

angular
  .module('MainView', ['Utils'])
  .controller('MainCtrl', ['Storage', '$scope', function(Storage, scope) {
    let vm = this;
    vm.testcases = null;

    Storage
      .init('TestCase')
      .then((db) => {
        vm.testcases = db.getAll();
        ipcMain.on('update-main-view', () => {
          db.reload()
            .then(() => {
              vm.testcases = db.getAll();
            });
        });
      });
  }]);
