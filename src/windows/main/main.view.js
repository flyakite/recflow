'use strict';

const fs = require('fs');
const {ipcMain, app} = require('electron').remote;

angular
  .module('MainView', ['Utils'])
  .controller('MainCtrl', ['Storage', 'TouchRawEventHelper', 'adb', 'Generator', '$scope', 
    function(Storage, TouchRawEventHelper, adb, Generator, $scope) {
    let vm = this;
    vm.state = {recording:false};
    vm.testcases = null;

    vm.reloadDevices = function() {
      adb.client.listDevices().then(function(devices) {
        console.log('all devices', devices);
        if(devices && devices.length == 1){
          vm.currentDeviceID = devices[0].id;
        }
        vm.devices = devices;
        $scope.$apply();
      });
    };
    vm.reloadDevices();

    vm.selectDevice = function(deviceID) {
      console.log('select ' + deviceID);
      vm.currentDeviceID = deviceID;
      adb.init(deviceID);
    };

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
      vm.recordingID = Generator.create();
      console.log('recordingID ' + vm.recordingID);
      const testcasesDir = path.resolve(app.getPath('userData'), 'Testcases');
      try{
        const stat = fs.statSync(testcasesDir);
      }catch(e){
        console.error(e);
        fs.mkdirSync(testcasesDir);    
      }
      const testcasePath = path.resolve(app.getPath('userData'), 'Testcases', vm.recordingID);
      // fs.mkdir(testcasePath, function() {
      //   console.log(testcasePath + ' created');
      //   ADB.takeScreenshot(path.resolve(testcasePath, 'init.png'), function() {
      //     console.log('screenshot finished');
      //   });
      // });
      recordingProcess = childProcess.execFile('adb', ['shell', 'getevent', '-lt' ]);
      recordingProcess.stdout.on('data', function(data) {
        TouchRawEventHelper
          .chopRawEvents(data.toString(), function(e) {
            console.log(e);
            TouchRawEventHelper.receiveChoppedEvent(e, handleCookedEvent);
        });
      });
    };

    vm.stop = function() {
      vm.state.recording = false;
      recordingProcess && recordingProcess.kill();
    };

    function handleCookedEvent(e) {
      const first_finger = 0;
      switch(e.state){
        case 'power_button_up':
          vm.cookedEvents.push('Power Pressed');
          break;
        case 'touch_finished':
          if(Object.keys(e.touchCoordinates).length > 1){
            vm.cookedEvents.push('Multi-Touch');
          }else if(e.touchCoordinates[first_finger] && e.touchCoordinates[first_finger].length > 1 &&
            (e.touchCoordinates[first_finger][e.touchCoordinates[first_finger].length-1].x - 
              e.touchCoordinates[first_finger][0].x) > 10 ||
            (e.touchCoordinates[first_finger][e.touchCoordinates[first_finger].length-1].y - 
              e.touchCoordinates[first_finger][0].y) > 10
            ){
            vm.cookedEvents.push('Swipe');
          }else if(e.touchCoordinates[first_finger] && e.touchCoordinates[first_finger].length > 1 &&
            (e.touchCoordinates[first_finger][e.touchCoordinates[first_finger].length-1].t - e.touchCoordinates[first_finger][0].t) > 1000
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
