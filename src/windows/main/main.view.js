'use strict';

const fs = require('fs');
const {ipcMain, app} = require('electron').remote;
const TOUCH_WIDTH = 50;
angular
  .module('MainView', ['Utils', 'Filters'])
  .controller('MainCtrl', ['$scope','$timeout', 'Storage', 'DeviceEventHelper', 'ScreenDisplayHelper', 'adb', 'Generator', 
    function($scope, $timeout, Storage, DeviceEventHelper, ScreenDisplayHelper, adb, Generator) {
    let vm = this;
    vm.state = {recording:false};
    vm.testcases = null;
    vm.device = {};

    vm.reloadDevices = function() {
      adb.client.listDevices().then(function(devices) {
        console.log('all devices', devices);
        if(devices && devices.length == 1){
          vm.currentDeviceID = devices[0].id;
          adb.init(vm.currentDeviceID)
            .then(vm.setDeviceInfo);
        }
        vm.devices = devices;
        $scope.$apply();
      });
    };
    vm.reloadDevices();
    $timeout(function() {
      if(!vm.currentDeviceID){
        vm.reloadDevices();
      }
    }, 1000);

    vm.selectDevice = function(deviceID) {
      console.log('select ' + deviceID);
      vm.currentDeviceID = deviceID;
      adb.init(deviceID)
        .then(function(result) {
          console.log(result);
        });
    };

    vm.setDeviceInfo = function([touchScreenSize, displayScreenSize]) {
      console.log(touchScreenSize, displayScreenSize);
      vm.device.touchScreenSize = touchScreenSize;
      vm.device.displayScreenSize = displayScreenSize;
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
        rawEvents:[],
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
      console.log(vm.recordingID);
      console.log(vm.testCase);
    };


    vm.recordDeviceEvents = function() {
      let stepIndex = 0;
      recordingProcess = childProcess.execFile('adb', ['shell', 'getevent', '-lt']);
      recordingProcess.stdout.on('data', function(data) {
        DeviceEventHelper
          .chopRawEvents(data.toString(), function(e) {
            vm.testCase.rawEvents.push(e.raw);
            if(e.error) return

            DeviceEventHelper.handleChoppedEvent(e, function(es) {
              console.log(es.state);
              console.log(es.duration);
              const FIRST_TOUCH = 0;
              switch(es.state){
                case 'power_button_down':
                  vm.testCase.steps[stepIndex] = vm.testCase.steps[stepIndex] || {};
                  break;
                case 'power_button_up':
                  console.log('power up');
                  vm.testCase.steps[stepIndex].name = 'Power Pressed';
                  break;
                case 'touch_first':
                  console.log('touch first');
                  const screenshotFilename = Generator.uuid4() + '.png';
                  const testcasePath = path.resolve(app.getPath('userData'), 'Testcases', vm.recordingID);
                  vm.testCase.steps[stepIndex] = vm.testCase.steps[stepIndex] || {};
                  console.log('currentIndex ', stepIndex);
                  // console.log('testcasePath ', testcasePath);
                  const screenshotFilePath = path.resolve(testcasePath, screenshotFilename);
                  (function(stepIndex, screenshotFilePath){
                    adb.takeScreenshot(screenshotFilePath, function() {
                        console.log('update screenshot for step ', stepIndex);
                        vm.testCase.steps[stepIndex].touchDownScreen = screenshotFilename;
                        vm.testCase.steps[stepIndex].displayScreen = `file://${screenshotFilePath}`;
                        $scope.$apply();
                    });
                  })(stepIndex, screenshotFilePath);
                  break;
                case 'touch_finished':
                  console.log('touch finished', es.touchCoordinates);
                  if(Object.keys(es.touchCoordinates).length > 1){
                    vm.testCase.steps[stepIndex].name = 'Multi-Touch';
                    vm.testCase.steps[stepIndex].clip = ScreenDisplayHelper.multiTouchDisplay(vm.device, es.touchCoordinates, TOUCH_WIDTH);

                  }else if(es.touchCoordinates[FIRST_TOUCH] && es.touchCoordinates[FIRST_TOUCH].length > 1 &&
                    (Math.abs(es.touchCoordinates[FIRST_TOUCH][es.touchCoordinates[FIRST_TOUCH].length-1].x - 
                      es.touchCoordinates[FIRST_TOUCH][0].x)) > 10 ||
                    (Math.abs(es.touchCoordinates[FIRST_TOUCH][es.touchCoordinates[FIRST_TOUCH].length-1].y - 
                      es.touchCoordinates[FIRST_TOUCH][0].y)) > 10
                    ){
                    vm.testCase.steps[stepIndex].name = 'Swipe';
                    vm.testCase.steps[stepIndex].clip = ScreenDisplayHelper.swipeDisplay(vm.device, es.touchCoordinates, TOUCH_WIDTH);

                  }else if(es.touchCoordinates[FIRST_TOUCH] && (es.duration) > 1 ){

                    vm.testCase.steps[stepIndex].displayArea = {
                      x:es.touchCoordinates[FIRST_TOUCH][0].x,
                      y:es.touchCoordinates[FIRST_TOUCH][0].y
                    };
                    vm.testCase.steps[stepIndex].name = 'Long Press';
                    vm.testCase.steps[stepIndex].clip = ScreenDisplayHelper.touchDisplay(vm.device, es.touchCoordinates, TOUCH_WIDTH);
                  }else{
                    vm.testCase.steps[stepIndex].displayArea = {
                      x:es.touchCoordinates[FIRST_TOUCH][0].x,
                      y:es.touchCoordinates[FIRST_TOUCH][0].y
                    };
                    vm.testCase.steps[stepIndex].name = 'Touch';
                    vm.testCase.steps[stepIndex].clip = ScreenDisplayHelper.touchDisplay(vm.device, es.touchCoordinates, TOUCH_WIDTH);
                    
                  }
                  console.log(vm.testCase.steps[stepIndex]);
                  break;
                case 'none':
                  console.log('none');
                  //events finished, go back to none state
                  if(typeof es.eventsPack !== 'undefined'){
                    vm.testCase.steps[stepIndex] = vm.testCase.steps[stepIndex] || {};
                    vm.testCase.steps[stepIndex].eventsPack = es.eventsPack;
                  }
                  stepIndex++;
                  break;
                default:
                  // console.log(e);
              }
              $scope.$apply();
            });
        });
      });
    }

    

  }]);
