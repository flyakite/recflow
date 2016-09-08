'use strict';

const fs = require('fs');
const {ipcMain, app} = require('electron').remote;
const assert = require('assert');

const TOUCH_WIDTH = 50;
const TESTCASE_FOLDER = 'TestCases';

const TESTCASE = {
  classname: 'TestCase',
};
const PROJECT_SETTING = {
  classname: 'ProjectSetting'
};

angular
  .module('MainView', ['Utils', 'Services', 'Filters'])
  .controller('MainCtrl', ['$q', '$scope','$timeout', 'Storage', 'DeviceEventHelper', 'ScreenDisplayHelper', 'adb', 'Generator', 
    function($q, $scope, $timeout, Storage, DeviceEventHelper, ScreenDisplayHelper, adb, Generator) {
    let vm = this;
    vm.state = {recording:false};
    vm.testCases = [];
    vm.device = {};
    vm.projectSetting = {};
    vm.projectSettingCollection = {};
    vm.testCaseCollection = {};

    const defaultProject = {
      'name': 'default',
      'class': PROJECT_SETTING.classname,
      'testCases': []
    };
    Storage.ready().then(function() {
      vm.projectSettingCollection = Storage.getCollection(PROJECT_SETTING.classname);
      vm.testCaseCollection = Storage.getCollection(TESTCASE.classname);
      let projectSetting = vm.projectSettingCollection
        .findOne({
          '$and':[
            {'name': defaultProject.name},
            {'class': defaultProject.class}
          ]
        });
      if(projectSetting){
        console.log('found project setting');
        vm.projectSetting = projectSetting;
        $timeout(function() {
          vm.testCaseDropdown();
        });
      }else{
        console.log('new project setting');

        vm.projectSettingCollection.insert(defaultProject);
        vm.projectSetting = defaultProject;
        Storage.saveDatabase();
      }
      console.log(vm.projectSetting);
      console.log(vm.projectSettingCollection.get(1));

      vm.testCases = Storage.getAll(TESTCASE.classname);
          // .chain().simplesort('order').data();
          // 
      // let tc = vm.testCaseCollection.findOne({id:805910966103})
      //.get(805910966103);
      // console.log(tc);
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

    let recordingProcess;
    const newTestCase = {
      rawEvents:[],
      steps:[]
    };
    vm.cookedEvents = [];
    vm.record = function() {
      vm.state.recording = true;
      vm.testCase = angular.copy(newTestCase);
      vm.testCase.tid = Generator.uuid4();
      const testCasesDir = path.resolve(app.getPath('userData'), TESTCASE_FOLDER);
      try{
        const stat = fs.statSync(testCasesDir);
      }catch(e){
        console.error(e);
        fs.mkdirSync(testCasesDir);    
      }
      const testCasePath = path.resolve(app.getPath('userData'), TESTCASE_FOLDER, vm.testCase.tid);
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
      vm.testCase = vm.testCaseCollection.insert(vm.testCase);
      console.log(vm.testCase);
      vm.projectSetting.testCases = vm.projectSetting.testCases || [];
      vm.projectSetting.testCases.push({
        id: vm.testCase.$loki,
        tid: vm.testCase.tid,
        name: vm.testCase.name,
        order: vm.testCases.length
      });
      console.log(vm.projectSetting.testCases);
      vm.projectSettingCollection.update(vm.projectSetting);
      $timeout(function() {
        vm.testCaseDropdown();
      });
      Storage.saveDatabase();
      $('#save-testcase').closeModal();
    };

    vm.deleteTestCase = function(testCaseID) {
      // ProjectHelper.deleteTestCase(vm.projectSetting, testCaseID).then(function(settings) {
      //   vm.projectSetting = settings;
      //   $timeout(function() {
      //     vm.testCaseDropdown();
      //   });
      // });
      for(var i=vm.projectSetting.testCases.length;i--;){
        if(vm.projectSetting.testCases[i].id==testCaseID){
          vm.projectSetting.testCases.splice(i,1);
          break;
        }
      }
      vm.projectSettingCollection.update(vm.projectSetting);
      Storage.saveDatabase();
    };

    vm.showTestCaseSteps = function(testCaseID) {
      console.log('testCaseID ', testCaseID);
      const d = $q.defer();
      // TestCaseHelper.load(testCaseID, {testCaseFolder:TESTCASE_FOLDER}).then(function(testCase) {
      //   vm.testCase = testCase;
      //   d.resolve(vm.testCase);
      // });
      vm.testCase = vm.testCaseCollection.get(testCaseID);
      console.log(vm.testCase); //null
      d.resolve(vm.testCase);
      return d.promise;
    };

    vm.testCaseStepTimeouts = [];
    vm.playbackTestCase = function(testCaseID) {
      // console.log('testCaseID ', testCaseID);
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
        let tcst, sie0, e, tcset, timeStolen=0;
        for(let i=0;i<vm.testCase.steps.length;i++){
          //step translation
          if(typeof vm.testCase.steps[i].touchType){

          }else if(!vm.testCase.steps[i].eventsPack){
            //init or end
            //TODO: check screen
            // vm.testCase.steps[i].pass = true;
          }else{
            //play raw event
            // (function(i) {
            //   sie0 = vm.testCase.steps[i].eventsPack[0];
            //   tcst = setTimeout(function() {
            //     const e0 = vm.testCase.steps[i].eventsPack[0];
            //     for(let j=0;j<vm.testCase.steps[i].eventsPack.length;j++){
            //       (function(i, j) {
            //         e = vm.testCase.steps[i].eventsPack[j];
            //         tcset = setTimeout(function() {
            //           e = vm.testCase.steps[i].eventsPack[j]; //renew
            //           // console.log(i,j,e);
            //           // console.log('send ', e);
            //           adb.sendEvent(e);
            //         }, (e.time - e0.time)*1000);
            //         vm.testCaseStepTimeouts.push(tcset);
            //       })(i, j)
            //     }
            //   }, (sie0.time - s1e0.time)*1000);
            //   vm.testCaseStepTimeouts.push(tcst);
            // })(i);
            //play events by event blocks(if two events happened adjasent, play them together)
            // (function(i) {
              // console.log('====== ' + i + ' ======');
              // console.log(vm.testCase.steps[i].eventsPack);
              let eventBlock = [vm.testCase.steps[i].eventsPack[0]];
              let eventBlockStartTime = eventBlock[0].time - s1e0.time;
              // console.log('storing ' + vm.testCase.steps[i].eventsPack[0].raw);
              for(let j=1;j<vm.testCase.steps[i].eventsPack.length;j++){
                //execute the event block if the there's a time gap(100 milliseconds), 
                //or if the event block is big(>6 events)
                if((vm.testCase.steps[i].eventsPack[j].time - 
                  vm.testCase.steps[i].eventsPack[j-1].time)*1000 > 100 ||
                  (eventBlock.length > 10 && vm.testCase.steps[i].eventsPack[j-1].code == 'SYN_REPORT')
                  ){
                  (function(eventBlock, eventBlockStartTime) {
                    tcset = setTimeout(function() {
                      console.log('========eventBlock======== ');
                      for(var k=0; k<eventBlock.length; k++){
                        e = eventBlock[k];
                        console.log('executing ' + e.raw);
                        //ECONNRESET error means too many events sent at the same time
                        adb.sendEvent(e);
                      }
                      // adb.sendEventBlock(eventBlock);
                    // }, (eventBlock[0].time - s1e0.time)*1000);
                    }, eventBlockStartTime*1000);
                    vm.testCaseStepTimeouts.push(tcset);
                  })(eventBlock, eventBlockStartTime);
                  eventBlockStartTime = eventBlockStartTime + 
                    vm.testCase.steps[i].eventsPack[j].time - eventBlock[0].time;
                  eventBlock = [];
                }
                // console.log('storing ' + vm.testCase.steps[i].eventsPack[j].raw);
                eventBlock.push(vm.testCase.steps[i].eventsPack[j]);
              }

              if(eventBlock.length != 0){
                (function(eventBlock, eventBlockStartTime) {
                  tcset = setTimeout(function() {
                    console.log('======== remaining eventBlock======== ');
                    for(var k=0;k<eventBlock.length;k++){
                      e = eventBlock[k];
                      console.log('executing ' + e.raw);
                      adb.sendEvent(e);
                    }
                    // adb.sendEventBlock(eventBlock);
                  // }, (eventBlock[0].time - s1e0.time)*1000);
                  }, (eventBlockStartTime)*1000);
                  vm.testCaseStepTimeouts.push(tcset);
                })(eventBlock, eventBlockStartTime);
                eventBlock = [];
              }
            // })(i);
          }
        }
      });
    };

    vm.takeScreenShot = function(option) {
      const screenshotFilename = option.name || Generator.uuid4() + '.png';
      const testCasePath = path.resolve(app.getPath('userData'), TESTCASE_FOLDER, vm.testCase.tid);
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

      DeviceEventHelper.init();
      adb.getEvents(function(data) {
        return DeviceEventHelper
          .chopRawEvents(data.toString(), function(e) {
          vm.testCase.rawEvents.push(e.raw);
          if(e.error) return;

          DeviceEventHelper.handleChoppedEvent(e)
          .then(function(es) {
            console.log('state ', es.state);
            switch(es.state){
              case 'power_button_down':
                vm.testCase.steps[stepIndex] = vm.testCase.steps[stepIndex] || {};
                break;
              case 'power_button_up':
                //TODO: power long press unhandled
                //http://stackoverflow.com/questions/11338022/simulating-power-button-press-to-display-switch-off-dialog-box
                console.log(vm.testCase.steps);
                console.log(stepIndex);
                vm.testCase.steps[stepIndex].name = 'Power Pressed';
                vm.testCase.steps[stepIndex].shell_input = 'keyevent 26';
                break;
              case 'touch_first':
                vm.testCase.steps[stepIndex] = vm.testCase.steps[stepIndex] || {};
                vm.takeScreenShot({stepIndex:stepIndex});
                break;
              case 'touch_finished':
                break;
              case 'none':
                //events finished, go back to none state
                if(es.fromState == 'touch_finished'){
                  console.log('touch_finished touchTrackEvents', es.touchTrackEvents);
                  console.log('touch_finished anchorTouchTrackEvents', es.anchorTouchTrackEvents);
                  vm.testCase.steps[stepIndex].touchTrackEvents = es.touchTrackEvents;
                  vm.testCase.steps[stepIndex].anchorTouchTrackEvents = es.anchorTouchTrackEvents;
                  switch(es.touchType){
                    case 'multi-touch':
                      vm.testCase.steps[stepIndex].name = 'Multi-Touch';
                      vm.testCase.steps[stepIndex].clip = ScreenDisplayHelper.multiTouchDisplay(vm.device, es.touchTrackEvents, TOUCH_WIDTH);
                      break;
                    case 'swipe':
                      vm.testCase.steps[stepIndex].name = 'Swipe';
                      vm.testCase.steps[stepIndex].clip = ScreenDisplayHelper.swipeDisplay(vm.device, es.touchTrackEvents, TOUCH_WIDTH);
                      break;
                    case 'long-press':
                      vm.testCase.steps[stepIndex].name = 'Long Press';
                      vm.testCase.steps[stepIndex].clip = ScreenDisplayHelper.touchDisplay(vm.device, es.touchTrackEvents, TOUCH_WIDTH);
                      break;
                    default:
                      vm.testCase.steps[stepIndex].name = 'Touch';
                      vm.testCase.steps[stepIndex].clip = ScreenDisplayHelper.touchDisplay(vm.device, es.touchTrackEvents, TOUCH_WIDTH);
                  }
                }
                if(typeof es.eventsPack !== 'undefined'){
                  vm.testCase.steps[stepIndex] = vm.testCase.steps[stepIndex] || {};
                  vm.testCase.steps[stepIndex].eventsPack = es.eventsPack;
                }
                stepIndex++;
                break;
              default:
                console.log(e);
            }
            // $scope.$apply();
          });
        });
      });
    };

    //temp easy testing code
    // vm.test = function() {
    //   var testCase = angular.copy(newTestCase);
    //   testCase.name = "test";
    //   testCase.steps.push({
    //     sid: 'test',
    //     name: 'Initial Screen',
    //   });
    //   // Pouch.save(testCase, TESTCASE.classname)
    //   // .then(function(result) {
    //   //   console.log(result);
    //   //   return Pouch.get_by_id(result.id);
    //   // }).then(function(result) {
    //   //   console.log(result);
    //   //   return Pouch.remove(result);
    //   // });
    //   // Storage.ready().then(function() {
    //   //   let testCaseCollection = Storage.getCollection(TESTCASE.classname);
    //   //   testCaseCollection.insert(testCase);
    //   //   // Storage.saveDatabase();
    //   //   let tc = testCaseCollection.findOne({'name':'test'});
    //   //   assert.notEqual(tc, null);
    //   //   testCaseCollection.remove(testCase);
    //   //   // Storage.saveDatabase();
    //   //   tc = testCaseCollection.findOne({'name':'test'});
    //   //   assert.equal(tc, null);
    //   //   console.log('Storage test finished');
    //   // });

    // }
    // vm.test();
  }]);
