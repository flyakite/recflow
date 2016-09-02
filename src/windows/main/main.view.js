'use strict';

const fs = require('fs');
const {ipcMain, app} = require('electron').remote;
const assert = require('assert');

const TOUCH_WIDTH = 50;
const TESTCASE_FOLDER = 'TestCases';
const TESTCASE = {
  classname: 'TestCase',
}
angular
  .module('MainView', ['Utils', 'Filters'])
  .controller('MainCtrl', ['$q', '$scope','$timeout', 'Pouch', 'DeviceEventHelper', 'ScreenDisplayHelper', 'TestCaseHelper', 'ProjectHelper', 'adb', 'Generator', 
    function($q, $scope, $timeout, Pouch, DeviceEventHelper, ScreenDisplayHelper, TestCaseHelper, ProjectHelper, adb, Generator) {
    let vm = this;
    vm.state = {recording:false};
    vm.testCases = null;
    vm.device = {};
    vm.projectSettings = {};

    ProjectHelper.loadSettings({
        projectName: 'project1',
      }).then(function(settings) {
        // console.log('ProjectSettings', settings);
        vm.projectSettings = settings;
        $timeout(function() {
          vm.testCaseDropdown();
        });
    }, function(err) {
      ProjectHelper.createSettings({
        projectName: 'project1',
      }).then(function(settings) {
        console.log('createSettings', settings);
        vm.projectSettings = settings;
        $timeout(function() {
          vm.testCaseDropdown();
        });
      });

    });
    
    vm.testCaseDropdown = function() {
      $('.dropdown-button').dropdown({
        hover:true,
        alignment:'right'
      });
    };

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

    // Storage
    //   .init()
    //   .then((db) => {
    //     vm.testCases = db.getAll('TestCase');
    //     // ipcMain.on('update-main-view', () => {
    //     //   db.reload()
    //     //     .then(() => {
    //     //       vm.testCases = db.getAll('TestCase');
    //     //     });
    //     // });
    //   });

    let recordingProcess;
    const newTestCase = {
      rawEvents:[],
      steps:[]
    };
    vm.cookedEvents = [];
    vm.record = function() {
      vm.state.recording = true;
      vm.testCase = angular.copy(newTestCase);
      const testCasesDir = path.resolve(app.getPath('userData'), TESTCASE_FOLDER);
      try{
        const stat = fs.statSync(testCasesDir);
      }catch(e){
        console.error(e);
        fs.mkdirSync(testCasesDir);    
      }
      const testCasePath = path.resolve(app.getPath('userData'), TESTCASE_FOLDER, vm.testCase.id);
      console.log(testCasePath);
      //add the initial step
      vm.testCase.steps.push({
        id: 'init',
        name: 'Initial Screen',
        clip: ScreenDisplayHelper.fullDisplay(vm.device, TOUCH_WIDTH)
      });
      fs.mkdir(testCasePath, function() {
        console.log(testCasePath + ' created');
        vm.takeScreenShot({name:'init.png', stepIndex:0});
      });
      vm.recordDeviceEvents();
    };

    vm.stop = function() {
      //add the final step
      vm.testCase.steps.push({
        id: 'end',
        name: 'End Screen',
        clip: ScreenDisplayHelper.fullDisplay(vm.device, TOUCH_WIDTH)
      });
      vm.takeScreenShot({name:'end.png', stepIndex:vm.testCase.steps.length-1});
      vm.state.recording = false;
      // recordingProcess && recordingProcess.kill(); //TODO
      adb.stopGetEvents();
      console.log(vm.testCase);
      $('#save-testcase').openModal();
    };

    vm.saveTestCase = function() {
      console.log('savetestCase ', vm.newTestCaseName);
      if(!vm.testCase){
        console.error('save error');
        return;
      }else if(vm.newTestCaseName.length === 0){
        console.error('no test case name');
        return;
      }
      vm.testCase.name = vm.newTestCaseName;
      // TestCaseHelper.save(vm.testCase, {testCaseFolder:TESTCASE_FOLDER});
      //TODO: remove id?
      // vm.testCases.insert(vm.testCase);
      Pouch.save(vm.testCase, 'TestCase');

      ProjectHelper.addTestCase(vm.projectSettings, vm.testCase).then(function(settings) {
        vm.projectSettings = settings;
        $timeout(function() {
          vm.testCaseDropdown();
        });
      });
    };

    vm.deleteTestCase = function(testCaseID) {
      ProjectHelper.deleteTestCase(vm.projectSettings, testCaseID).then(function(settings) {
        vm.projectSettings = settings;
        $timeout(function() {
          vm.testCaseDropdown();
        });
      });
    };

    vm.showTestCaseSteps = function(testCaseID) {
      const d = $q.defer();
      TestCaseHelper.load(testCaseID, {testCaseFolder:TESTCASE_FOLDER}).then(function(testCase) {
        vm.testCase = testCase;
        d.resolve(vm.testCase);
      });
      return d.promise;
    };

    vm.testCaseStepTimeouts = [];
    vm.playbackTestCase = function(testCaseID) {
      const d = $q.defer(), d2 = $q.defer();
      if(!vm.testCase || vm.testCase.id !== testCaseID){
        vm.showTestCaseSteps(testCaseID).then(function() {
          d.resolve();
        });
      }else{
        d.resolve();
      }
      $q.when(d.promise).then(function() {
        const s1e0 = vm.testCase.steps[1].eventsPack[0];
        let tcst, sie0, e, tcset;
        for(let i=0;i<vm.testCase.steps.length;i++){
          if(!vm.testCase.steps[i].eventsPack){
            //init or end
            //TODO: check screen
            // vm.testCase.steps[i].pass = true;
          }else{
            (function(i) {
              sie0 = vm.testCase.steps[i].eventsPack[0];
              tcst = setTimeout(function() {
                const e0 = vm.testCase.steps[i].eventsPack[0];
                for(let j=0;j<vm.testCase.steps[i].eventsPack.length;j++){
                  (function(i, j) {
                    e = vm.testCase.steps[i].eventsPack[j];
                    tcset = setTimeout(function() {
                      e = vm.testCase.steps[i].eventsPack[j]; //renew
                      // console.log(i,j,e);
                      // console.log('send ', e);
                      adb.sendEvent(e);
                    }, (e.time - e0.time)*1000);
                    vm.testCaseStepTimeouts.push(tcset);
                  })(i, j)
                }
              }, (sie0.time - s1e0.time)*1000);
              vm.testCaseStepTimeouts.push(tcst);
            })(i);
          }
        }
      });
    };

    vm.takeScreenShot = function(option) {
      const screenshotFilename = option.name || Generator.uuid4() + '.png';
      const testCasePath = path.resolve(app.getPath('userData'), TESTCASE_FOLDER, vm.testCase.id);
      const screenshotFilePath = path.resolve(testCasePath, screenshotFilename);
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
      // recordingProcess = childProcess.execFile('adb', ['shell', 'getevent', '-lt']);
      // recordingProcess.stdout.on('data', function(data) {
      DeviceEventHelper.init();
      adb.getEvents(function(data) {
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

    };

    //temp easy testing code
    vm.test = function() {
      console.log('test');
      let testCase = angular.copy(newTestCase);
      testCase.steps.push({
        sid: 'test',
        name: 'Initial Screen',
      });
      Pouch.save(testCase, TESTCASE.classname)
      .then(function(result) {
        console.log(result);
        return Pouch.get_by_id(result.id)
        .then(function(result) {
          console.log(result);
          return Pouch.remove(result);
        });
      });
    }
    vm.test();
  }]);
