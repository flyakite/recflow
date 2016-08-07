'use strict';

const fs = require('fs');
const {ipcMain, app} = require('electron').remote;
const TOUCH_WIDTH = 50;
const TESTCASE_FOLDER = 'TestCases';
angular
  .module('MainView', ['Utils', 'Filters'])
  .controller('MainCtrl', ['$scope','$timeout', 'Storage', 'DeviceEventHelper', 'ScreenDisplayHelper', 'TestCaseSaver', 'ProjectHelper', 'adb', 'Generator', 
    function($scope, $timeout, Storage, DeviceEventHelper, ScreenDisplayHelper, TestCaseSaver, ProjectHelper, adb, Generator) {
    let vm = this;
    vm.state = {recording:false};
    vm.testcases = null;
    vm.device = {};
    vm.projectSettings = {};
    ProjectHelper.loadSettings({
        projectName: 'project1',
      }).then(function(settings) {
        console.log('loadSettings', settings);
        vm.projectSettings = settings;
    }, function(err) {
      ProjectHelper.createSettings({
        projectName: 'project1',
      }).then(function(settings) {
        console.log('createSettings', settings);
          vm.projectSettings = settings;
      });

    });

    vm.reloadDevices = function() {
      adb.client.listDevices().then(function(devices) {
        // console.log('all devices', devices);
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
    setInterval(function() {
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
      vm.testCase = {
        id: Generator.uuid4(),
        rawEvents:[],
        steps:[]
      };
      const testcasesDir = path.resolve(app.getPath('userData'), TESTCASE_FOLDER);
      try{
        const stat = fs.statSync(testcasesDir);
      }catch(e){
        console.error(e);
        fs.mkdirSync(testcasesDir);    
      }
      const testcasePath = path.resolve(app.getPath('userData'), TESTCASE_FOLDER, vm.testCase.id);
      console.log(testcasePath);
      vm.testCase.steps.push({
        name: 'Initialization',
        clip: ScreenDisplayHelper.fullDisplay(vm.device, TOUCH_WIDTH)
      });
      fs.mkdir(testcasePath, function() {
        console.log(testcasePath + ' created');
        vm.takeScreenShot({name:'init.png', stepIndex:0});
      });
      vm.recordDeviceEvents();
    };

    vm.stop = function() {
      //add final step
      vm.testCase.steps.push({
        name: 'End',
        clip: ScreenDisplayHelper.fullDisplay(vm.device, TOUCH_WIDTH)
      });
      vm.takeScreenShot({name:'end.png', stepIndex:vm.testCase.steps.length-1});
      vm.state.recording = false;
      recordingProcess && recordingProcess.kill(); //TODO
      console.log(vm.testCase);
      $('#save-testcase').openModal();
    };

    vm.saveTestCase = function() {
      console.log('saveTestCase ', vm.testCaseName);
      if(!vm.testCase || !vm.testCase.id){
        console.error('save error');
        return;
      }else if(vm.testCaseName.length === 0){
        console.error('no test case name');
        return;
      }
      vm.testCase.name = vm.testCaseName;
      TestCaseSaver.init(vm.testCase, {testCaseFolder:TESTCASE_FOLDER}).save();
      ProjectHelper.addTestCase(vm.projectSettings, vm.testCase).then(function(settings) {
        vm.projectSettings = settings;
      });
    };

    vm.takeScreenShot = function(option) {
      const screenshotFilename = option.name || Generator.uuid4() + '.png';
      const testcasePath = path.resolve(app.getPath('userData'), TESTCASE_FOLDER, vm.testCase.id);
      const screenshotFilePath = path.resolve(testcasePath, screenshotFilename);
      (function(stepIndex, screenshotFilePath){
        adb.takeScreenshot(screenshotFilePath, function() {
            console.log('update screenshot for step ', stepIndex);
            vm.testCase.steps[stepIndex].touchDownScreen = screenshotFilename;
            vm.testCase.steps[stepIndex].displayScreen = `file://${screenshotFilePath}`;
            $scope.$apply();
        });
      })(option.stepIndex, screenshotFilePath);
    };

    vm.recordDeviceEvents = function() {
      let stepIndex = 1; //start from 1 because 0 is for init step
      recordingProcess = childProcess.execFile('adb', ['shell', 'getevent', '-lt']);
      recordingProcess.stdout.on('data', function(data) {
        DeviceEventHelper
          .chopRawEvents(data.toString(), function(e) {
            vm.testCase.rawEvents.push(e.raw);
            if(e.error) return

            DeviceEventHelper.handleChoppedEvent(e, function(es) {
              console.log(es.state);
              const FIRST_TOUCH = 0;
              switch(es.state){
                case 'power_button_down':
                  vm.testCase.steps[stepIndex] = vm.testCase.steps[stepIndex] || {};
                  break;
                case 'power_button_up':
                  vm.testCase.steps[stepIndex].name = 'Power Pressed';
                  break;
                case 'touch_first':
                  vm.testCase.steps[stepIndex] = vm.testCase.steps[stepIndex] || {};
                  vm.takeScreenShot({stepIndex:stepIndex});
                  break;
                case 'touch_finished':
                  console.log('touch_finished touchCoordinates', es.touchCoordinates);
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

                    // vm.testCase.steps[stepIndex].displayArea = {
                    //   x:es.touchCoordinates[FIRST_TOUCH][0].x,
                    //   y:es.touchCoordinates[FIRST_TOUCH][0].y
                    // };
                    vm.testCase.steps[stepIndex].name = 'Long Press';
                    vm.testCase.steps[stepIndex].clip = ScreenDisplayHelper.touchDisplay(vm.device, es.touchCoordinates, TOUCH_WIDTH);
                  }else{
                    // vm.testCase.steps[stepIndex].displayArea = {
                    //   x:es.touchCoordinates[FIRST_TOUCH][0].x,
                    //   y:es.touchCoordinates[FIRST_TOUCH][0].y
                    // };
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
