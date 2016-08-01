'use strict';

const {ipcMain} = require('electron').remote;
const childProcess = require('child_process');

angular
  .module('MainView', ['Utils'])
  .controller('MainCtrl', ['Storage', 'TouchRawEventHelper', '$scope', function(Storage, TouchRawEventHelper, $scope) {
    let vm = this;
    vm.state = {recording:false};
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

    let recordingProcess;
    vm.cookedEvents = [];
    vm.record = function() {
      vm.state.recording = true;
      recordingProcess = childProcess.execFile('adb', ['shell', 'getevent', '-lt' ]);
      recordingProcess.stdout.on('data', function(data) { 
        TouchRawEventHelper
          .chopRawEvents(data.toString(), function(e) {
            TouchRawEventHelper.receiveChoppedEvent(e, handleCookedEvent);
        });
      });
    };

    vm.stop = function() {
      vm.state.recording = false;
      recordingProcess && recordingProcess.kill();
    };

    function handleCookedEvent(e) {
      console.log(e);
      switch(e.state){
        case 'power_button_up':
          vm.cookedEvents.push('Power Pressed');
          break;
        case 'touch_finished':
          if(Object.keys(e.touchCoordinates).length > 1){
            vm.cookedEvents.push('Multi-Touch');
          }else if(e.touchCoordinates.length > 2 &&
            (e.touchCoordinates[e.touchCoordinates.length-1].x - e.touchCoordinates[0].x) > 10 ||
            (e.touchCoordinates[e.touchCoordinates.length-1].y - e.touchCoordinates[0].y) > 10
            ){
            vm.cookedEvents.push('Swipe');
          }else if(e.touchCoordinates.length > 2 &&
            (e.touchCoordinates[e.touchCoordinates.length-1].t - e.touchCoordinates[0].t) > 1000
            ){
            vm.cookedEvents.push('Long Press');
          }else{
            vm.cookedEvents.push('Touch');
          }
          break;
        default:
          console.log(e);
      }
      $scope.$apply();
    }

  }]);
