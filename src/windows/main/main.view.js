'use strict';

const fs = require('fs');
const {ipcMain, app} = require('electron').remote;

angular
  .module('MainView', ['Utils'])
  .controller('MainCtrl', ['Storage', 'DeviceEventHelper', 'adb', 'Generator', '$scope', 
    function(Storage, DeviceEventHelper, adb, Generator, $scope) {
    let vm = this;
    vm.state = {recording:false};
    vm.testcases = null;

    vm.reloadDevices = function() {
      adb.client.listDevices().then(function(devices) {
        console.log('all devices', devices);
        if(devices && devices.length == 1){
          vm.currentDeviceID = devices[0].id;
          adb.init(vm.currentDeviceID);
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
      vm.recordingID = Generator.uuid4();
      console.log('recordingID ' + vm.recordingID);
      vm.testCase = {
        steps:[]
      };
      vm.testCase.recordingID = vm.recordingID;
      const testcasesDir = path.resolve(app.getPath('userData'), 'Testcases');
      try{
        const stat = fs.statSync(testcasesDir);
      }catch(e){
        console.error(e);
        fs.mkdirSync(testcasesDir);    
      }
      const testcasePath = path.resolve(app.getPath('userData'), 'Testcases', vm.recordingID);
      console.log(testcasePath);
      fs.mkdir(testcasePath, function() {
        console.log(testcasePath + ' created');
        adb.takeScreenshot(path.resolve(testcasePath, 'init.png'), function() {
          console.log('screenshot finished');
        });
      });
      vm.recordDeviceEvents();
    };

    vm.stop = function() {
      vm.state.recording = false;
      recordingProcess && recordingProcess.kill();
      console.log(msg);
      console.log(vm.recordingID);
      console.log(vm.testCase);
    };


    vm.recordDeviceEvents = function() {
      let stepIndex = 0;
      recordingProcess = childProcess.execFile('adb', ['shell', 'getevent', '-lt']);
      recordingProcess.stdout.on('data', function(data) {
        DeviceEventHelper
          .chopRawEvents(data.toString(), function(e) {
            vm.testCase.rawEvents.push(e);
            // console.log(e);
            DeviceEventHelper.handleChoppedEvent(e, function(es) {
              const FIRST_TOUCH = 0;
              switch(es.state){
                case 'power_button_down':
                  stepIndex++;
                  break;
                case 'power_button_up':
                  vm.cookedEvents.push('Power Pressed');
                  break;
                case 'touch_first':
                  const screenshotFilename = Generator.uuid4() + '.png';
                  stepIndex++;
                  const testcasePath = path.resolve(app.getPath('userData'), 'Testcases', vm.recordingID);
                  adb.takeScreenshot(path.resolve(testcasePath, screenshotName), function(stepIndex) {
                    vm.testCase.steps[stepIndex].tdScreen = screenshotNameFilename;
                  });
                  break;
                case 'touch_finished':
                  if(Object.keys(es.touchCoordinates).length > 1){
                    vm.cookedEvents.push('Multi-Touch');
                  }else if(es.touchCoordinates[FIRST_TOUCH] && es.touchCoordinates[FIRST_TOUCH].length > 1 &&
                    (es.touchCoordinates[FIRST_TOUCH][es.touchCoordinates[FIRST_TOUCH].length-1].x - 
                      es.touchCoordinates[FIRST_TOUCH][0].x) > 10 ||
                    (es.touchCoordinates[FIRST_TOUCH][es.touchCoordinates[FIRST_TOUCH].length-1].y - 
                      es.touchCoordinates[FIRST_TOUCH][0].y) > 10
                    ){
                    vm.cookedEvents.push('Swipe');
                  }else if(es.touchCoordinates[FIRST_TOUCH] && es.touchCoordinates[FIRST_TOUCH].length > 1 &&
                    (es.touchCoordinates[FIRST_TOUCH][es.touchCoordinates[FIRST_TOUCH].length-1].t - es.touchCoordinates[FIRST_TOUCH][0].t) > 1000
                    ){
                    vm.cookedEvents.push('Long Press');
                  }else{
                    vm.cookedEvents.push('Touch');
                  }
                  break;
                case 'none':
                  //events finished, go back to none state
                  if(typeof es.eventsPack !== 'undefined'){
                    vm.testCase.steps.push({
                      eventsPack: eventsPack
                    });
                  }
                  break;
                default:
                  console.log(e);
              }
              $scope.$apply();
            });
        });
      });
    }

    

  }]);
