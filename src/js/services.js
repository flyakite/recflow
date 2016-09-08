'use strict';

// const path = require('path');
// const childProcess = require('child_process');
// const adb = require('adbkit');
// const PROJECTSETTING.classname = 'ProjectSetting';

angular
  .module('Services', ['Config', 'Utils'])
  // .service('ProjectHelper', ['$q', 'Storage', function($q, Storage) {
  //   this.loadSetting = function(options) {
  //     var d = $q.defer();
  //     // const settingsFile = path.resolve(app.getPath('userData'), options.projectName + '.settings')
  //     // fs.readFile(settingsFile, function(err, data) {
  //     //   if(err){
  //     //     console.error(err);
  //     //     d.reject(err);
  //     //     return
  //     //   }
  //     //   d.resolve(JSON.parse(data));
  //     // });
  //     Storage.ready().then(function() {
  //       let ps = Storage.getCollection(PROJECTSETTING.classname)
  //         .findOne({'class':PROJECTSETTING.classname, 'name':options.projectName});
  //       if(ps){
  //         d.resolve(ps);
  //       }else{
  //         d.reject();
  //       }
  //     });
  //     return d.promise;
  //   };
  //   this.createSetting = function(settings) {
  //     var d = $q.defer();
  //     // const projectName = settings.projectName;
  //     // const settingsFile = path.resolve(app.getPath('userData'), projectName + '.settings')
  //     // fs.writeFile(settingsFile, JSON.stringify(settings), function(err, data) {
  //     //   if(err){
  //     //     console.error(err);
  //     //     d.reject(err);
  //     //     return
  //     //   }
  //     //   d.resolve(settings);
  //     // });
  //     settings.class = PROJECTSETTING.classname;
  //     Storage.ready().then(function() {
  //       Storage.getCollection(PROJECTSETTING.classname).insert(settings);
  //       d.resolve(settings);
  //     })
  //     return d.promise;
  //   };

  //   this.addTestCase = function(settings, testCase) {
  //     var d = $q.defer();
  //     const projectName = settings.projectName;
  //     const settingsFile = path.resolve(app.getPath('userData'), projectName + '.settings')
  //     fs.readFile(settingsFile, function(err, data) {
  //       if(err){
  //         console.error(err);
  //         d.reject(err);
  //         return
  //       }
  //       settings = JSON.parse(data);
  //       settings.testCases = settings.testCases || [];
  //       settings.testCases.push({
  //         id: testCase.id,
  //         name: testCase.name
  //       });
  //       fs.writeFile(settingsFile, JSON.stringify(settings), function(err, data) {
  //         if(err){
  //           console.error(err);
  //           d.reject(err);
  //           return
  //         }
  //         d.resolve(settings);
  //       });
  //     });
  //     return d.promise;
  //   };
  //   this.deleteTestCase = function(settings, testCaseID) {
  //     var d = $q.defer();
  //     const projectName = settings.projectName;
  //     const settingsFile = path.resolve(app.getPath('userData'), projectName + '.settings')
  //     for(let i=0; i<settings.testCases.length;i++){
  //       console.log(settings.testCases[i].id, testCaseID);
  //       if(settings.testCases[i].id == testCaseID){
  //         console.log(i);
  //         settings.testCases.splice(i,1);
  //         console.log(settings.testCases);
  //         break;
  //       }
  //     }
  //     console.log(settings);
  //     fs.writeFile(settingsFile, JSON.stringify(settings), function(err, data) {
  //       if(err){
  //         console.error(err);
  //         d.reject(err);
  //         return
  //       }
  //       d.resolve(settings);
  //     });
  //     return d.promise;
  //   };
  // }])
  .service('DeviceEventHelper', ['$q', '$timeout', function($q, $timeout) {
    // console.log('DeviceEventHelper');
    this.state = 'none';
    this.touchNumber = 0;
    this.coorIndex = 0;
    this.buffer = [];
    this.touchTrackEvents = {};
    this.currentSlot = 0;
    this.eventsPack = [];
    // this.touchDuration = [];
    this.init = function() {
      // console.log('DeviceEventHelper init');
      this.state = 'none';
      this.touchNumber = 0;
      this.buffer = [];
      this.touchTrackEvents = {};
      this.currentSlot = 0;
      this.eventsPack = [];
      // this.touchDuration = [];
      return this;
    };

    this.catagorizeTouchType = function(t) {
      /**
       * touchInfo t:
       * state:this.state, 
       * touchTrackEvents:this.touchTrackEvents, 
       * time:e.time,
       * duration: duration
       */
      const FIRST_FINGER = 0;
      let touch = {
        anchorTouchTrackEvents: {},
        touchTrackEvents: t.touchTrackEvents,
        type: undefined,
      };
      // let lastTrackPointIndex;
      // for(let i=t.touchTrackEvents[FIRST_FINGER].length;i--;){
      //   if(typeof t.touchTrackEvents[FIRST_FINGER][i].y !== 'undefined'){
      //     lastTrackPointIndex = i;
      //     break;
      //   }
      // }

      if(Object.keys(t.touchTrackEvents).length > 1){
        touch.type = 'multi-touch';
        Object.keys(t.touchTrackEvents).forEach(function(k) {
          touch.anchorTouchTrackEvents[k] = this.findAnchorPoints(t.touchTrackEvents[k]);
        }.bind(this));

      }else if(t.touchTrackEvents[FIRST_FINGER] && t.touchTrackEvents[FIRST_FINGER].lastTrackPointIndex > 1 &&
        (Math.abs(t.touchTrackEvents[FIRST_FINGER][t.touchTrackEvents[FIRST_FINGER].lastTrackPointIndex].x - 
          t.touchTrackEvents[FIRST_FINGER][0].x)) > 10 ||
        (Math.abs(t.touchTrackEvents[FIRST_FINGER][t.touchTrackEvents[FIRST_FINGER].lastTrackPointIndex].y - 
          t.touchTrackEvents[FIRST_FINGER][0].y)) > 10
        ){
        touch.type = 'swipe';
        touch.anchorTouchTrackEvents[FIRST_FINGER] = this.findAnchorPoints(t.touchTrackEvents[FIRST_FINGER]);

      }else if(t.touchTrackEvents[FIRST_FINGER] && (t.duration) > 1 ){
        touch.type = 'long-press';
      }else{
        touch.type = 'touch';
      }
      return touch;
    };

    this.angleOfVectors = function(v1, v2) {
      //return 0 => degree 0, return 3.1415.. => degree 180
      return Math.acos((v1.x*v2.x+v1.y*v2.y)/
        Math.sqrt(
          (Math.pow(v1.x,2)+Math.pow(v1.y,2))*(Math.pow(v2.x,2)+Math.pow(v2.y,2)))
        );
    };

    this.screenInTheMiddlePoints = function(points, orientation_rotate_percentage_of_pi) {
      //orientation_rotate_percentage_of_pi = 1 if straigh line, means no orientationrotatation
      //orientation_rotate_percentage_of_pi = 0.5 if the line goes vertical, 90 degree
      //orientation_rotate_percentage_of_pi = 0 if the line goes 180 degree back
      let basePoint = points[0];
      let newpoints = [basePoint];
      let v1={}, v2={};
      for(let i=1;i<points.length-1;i++){
        v1.x = basePoint.x-points[i].x;
        v1.y = basePoint.y-points[i].y;
        v2.x = points[i+1].x-points[i].x;
        v2.y = points[i+1].y-points[i].y;
        if(this.angleOfVectors(v1,v2) < Math.PI * orientation_rotate_percentage_of_pi ){
          newpoints.push(points[i]);
          basePoint = points[i];
        }
      }
      //add last point
      newpoints.push(points[points.length-1]);
      return newpoints;
    };

    this.screenClosePoints = function(points) {
      let basePoint = points[0];
      let newpoints = [basePoint];
      for(let i=1;i<points.length-1;i++){
        if(Math.sqrt(Math.pow(points[i].x-basePoint.x,2) + 
          Math.pow(points[i].y-basePoint.y,2)) > 100){
          newpoints.push(points[i]);
          basePoint = points[i];
        }
      }
      //add last point
      newpoints.push(points[points.length-1]);
      return newpoints;
    };

    this.groupEventsByCoordinates = function(eventsPack) {
      let e, trackEvents={}, track={}, slot=0;
      track.eventsPack = [];
      for(var i=0;i<eventsPack.length;i++){
        e = eventsPack[i];
        track.eventsPack.push(e);
        switch(e.code){
          case 'ABS_MT_SLOT':
            slot = parseInt(e.value, 16);
            trackEvents[slot] = trackEvents[slot] || [];
            break;
          case 'ABS_MT_POSITION_X':
            track.x = parseInt(e.value, 16);
            break;
          case 'ABS_MT_POSITION_Y':
            track.y = parseInt(e.value, 16);
            trackEvents[slot] = trackEvents[slot] || [];
            trackEvents[slot].lastTrackPointIndex = trackEvents[slot].length - 1 ;
            break;
          case 'SYN_REPORT':
            track.t = parseInt(e.time, 16);
            trackEvents[slot].push(track);
            track={};
            track.eventsPack = []
            break;
          default:
            break;
        }
      }
      return trackEvents;
    };

    this.findAnchorPoints = function(trackEvents) {
      // let points = [];
      //detatch last event(touch up event)
      // for(let slot=0;slot<trackEvents.length;slot++){
      //   console.log(trackEvents[slot]);
      //   points[slot] = trackEvents[slot].splice(0,trackEvents[slot].length-1);
      // }
      let points = trackEvents.slice(0,trackEvents.length-1);
      points = this.screenClosePoints(points);
      points = this.screenInTheMiddlePoints(points, 0.9);

      //attach back the last event
      // for(let slot=0;slot<trackEvents.length;slot++){
      //   points[slot].push(trackEvents[slot][trackEvents[slot].length-1]);
      // }
      points.push(trackEvents[trackEvents.length-1]);
      return points;
    };

    this.handleChoppedEvent = function(e) {
      /**
       * a event looks like
       * {
       *   type: 'EV_SYN',
       *   code: 'SYN_REPORT',
       *   value: '00000000',
       *   input: 'event2',
       *   time: '57988.493168'
       * }
       */
      let d = $q.defer();
      let touch;
      this.eventsPack.push(e);
      switch(this.state) {

        default:
          //case 'none':
          switch(e.type) {
            case 'EV_KEY':
              switch(e.code){
                case 'KEY_POWER':
                  if(e.value == 'DOWN'){
                    this.state = 'power_button_down';
                    d.resolve({state:this.state});
                  }else if(e.value == 'UP'){
                    this.state = 'power_button_up';
                    d.resolve({state:this.state});
                  }
                  break;
                case 'BTN_TOUCH':
                  break;
                default:
                  console.log(e.code);
              }
              break;
            case 'EV_ABS':
              switch(e.code){
                case 'ABS_MT_TRACKING_ID':
                  console.log('touchNumber ', this.touchNumber);
                  if(e.value !== 'ffffffff'){
                    //new touch
                    // this.touchDuration[this.touchNumber] = {start:e.time};
                    if(this.touchNumber === 0){
                      this.state = 'touch_first';
                      this.touchNumber++;
                      d.resolve({
                        state:this.state, 
                        time:e.time
                      });
                    }else{
                      this.state = 'touch_multi';
                      this.touchNumber++;
                      d.resolve({
                        state:this.state, 
                        touchNumber:this.touchNumber, 
                        time:e.time
                      });
                    }
                  }else{
                    //end of tracking a touch
                    this.touchNumber--;
                    if(this.touchNumber === 0){
                      this.state = 'touch_finished';
                    }else{
                      this.state = 'touch_up';
                    }
                  }
                  break;
                // case 'ABS_MT_SLOT':
                //   this.currentSlot = parseInt(e.value);
                //   this.touchTrackEvents[this.currentSlot] = this.touchTrackEvents[this.currentSlot] || [];
                //   this.touchTrackEvents[this.currentSlot].push({
                //     // eventsPack: []
                //   });
                //   this.coorIndex = this.touchTrackEvents[this.currentSlot].length - 1;
                //   this.touchTrackEvents[this.currentSlot][this.coorIndex].eventsPack.push(e);
                //   break;
                // case 'ABS_MT_TOUCH_MAJOR':
                //   this.touchTrackEvents[this.currentSlot] = this.touchTrackEvents[this.currentSlot] || [];
                //   if(this.touchTrackEvents[this.currentSlot].length == 0 ||
                //    typeof this.touchTrackEvents[this.currentSlot][this.touchTrackEvents[this.currentSlot].lengh-1].x === 'undefined'){
                //     this.touchTrackEvents[this.currentSlot].push({
                //       // eventsPack: []
                //     });
                //     this.coorIndex = this.touchTrackEvents[this.currentSlot].length - 1;
                //   }
                //   // this.touchTrackEvents[this.currentSlot][this.coorIndex].eventsPack.push(e);
                //   break;
                // case 'ABS_MT_WIDTH_MAJOR':
                //   // this.touchTrackEvents[this.currentSlot][this.coorIndex].eventsPack.push(e);
                //   break;
                // case 'ABS_MT_POSITION_X':
                //   console.log('ABS_MT_POSITION_X', this.touchTrackEvents);
                //   this.touchTrackEvents[this.currentSlot][this.coorIndex].x = parseInt(e.value, 16);
                //   this.touchTrackEvents[this.currentSlot][this.coorIndex].t = parseInt(e.time, 16);
                //   break;
                // case 'ABS_MT_POSITION_Y':
                //   /**
                //    * There's a bug in some multi-touch device, ABS_MT_POSITION_X can be missing
                //    */
                //   console.log('ABS_MT_POSITION_Y', this.touchTrackEvents, this.currentSlot);
                //   let coor = this.touchTrackEvents[this.currentSlot];
                //   if(typeof coor === 'undefined'){
                //     console.error('ABS_MT_POSITION_X missing bug1');
                //     this.touchTrackEvents[this.currentSlot][this.coorIndex].x = parseInt(e.value, 16); //fake x
                //     this.touchTrackEvents[this.currentSlot][this.coorIndex].y = parseInt(e.value, 16);
                //     this.touchTrackEvents[this.currentSlot][this.coorIndex].t = parseInt(e.time, 16);

                //   }else if(typeof this.touchTrackEvents[this.currentSlot][coor.length-1].x === 'undefined'){
                //     console.error('ABS_MT_POSITION_X missing bug2');
                //     this.touchTrackEvents[this.currentSlot][this.coorIndex].x = parseInt(e.value, 16); //fake x
                //     this.touchTrackEvents[this.currentSlot][this.coorIndex].y = parseInt(e.value, 16);
                //     this.touchTrackEvents[this.currentSlot][this.coorIndex].t = parseInt(e.time, 16);

                //   }else{
                //     this.touchTrackEvents[this.currentSlot][this.coorIndex].y = parseInt(e.value, 16);
                //   }
                //   break;
                default:
                  // console.log(e.code);
              }
              break;
            case 'EV_SYN':
              switch(e.code){
                case 'SYN_REPORT':
                  //TODO: add more senarios, when to clear eventsPack
                  if(['power_button_up', 'touch_finished'].indexOf(this.state) !== -1){
                    console.log('return to none state');
                    if(this.state == 'touch_finished'){
                      // console.log(this.eventsPack);
                      let touchTrackEvents = this.groupEventsByCoordinates(this.eventsPack);
                      // console.log(touchTrackEvents);
                      let duration = this.eventsPack[this.eventsPack.length-1].time - this.eventsPack[0].time
                      // console.log(duration);
                      touch = this.catagorizeTouchType({
                        touchTrackEvents:touchTrackEvents,
                        duration: duration
                      });
                      // console.log(touch);
                      d.resolve({
                        state:'none',
                        fromState:this.state,
                        touchType:touch.type,
                        touchTrackEvents:touchTrackEvents,
                        anchorTouchTrackEvents:touch.anchorTouchTrackEvents,
                        time:e.time,
                        eventsPack:this.eventsPack,
                        duration: duration
                      });
                      // touchTrackEvents = {};
                    }else{
                      d.resolve({
                        state:'none', 
                        fromState:this.state,
                        eventsPack:this.eventsPack
                      });
                    }
                    this.state = 'none';
                    this.eventsPack = [];
                  // }else if(this.touchTrackEvents && 
                  //   typeof this.touchTrackEvents[this.currentSlot][this.coorIndex].sync === 'undefined'){
                  //   this.touchTrackEvents[this.currentSlot][this.coorIndex].eventsPack.push(e);
                  //   this.touchTrackEvents[this.currentSlot][this.coorIndex].sync = true;
                  }
                  break;
                default:
                  console.log(e.code);
              }
              break;
            default:
              console.log(e.type);
          }
      }
      return d.promise;
    };//handleChoppedEvent

    this.eventRawEventRegex = /\s*?\[\s*?(\d+\.\d+)\s*?\]\s*?\/dev\/input\/(event\d+)\:\s+?(EV_\w+)\s+?(\w+)\s+?(\w+)\s*/;
    this.chopRawEvents = function(event_string, callback) {
      /**
       * a event looks like
       * {
       *   type: 'EV_SYN',
       *   code: 'SYN_REPORT',
       *   value: '00000000',
       *   input: 'event2',
       *   time: '57988.493168'
       * }
       */
      // console.log('chopRawEvents');
      let match, events = event_string.split('\n');
      for(var i=0; i<events.length; i++){
        match = this.eventRawEventRegex.exec(events[i]);
        if(match && match.length > 0){
          callback({
            time: parseFloat(match[1]),
            input: match[2],
            type: match[3],
            code: match[4],
            value: match[5],
            raw: events[i].trim()
          });
        }else{
          callback({
            error: true,
            raw: events[i].trim()
          });
        }
      }
    };

  }])
  // .service('TestCaseHelper', ['$q', function($q) {

  //   this.save = function(testCase, options) {
  //     options = options || {};
  //     options.testCaseFolder = options.testCaseFolder || 'TestCases';
  //     this.testCase = testCase;
  //     this.testCasePath = path.resolve(app.getPath('userData'), options.testCaseFolder, this.testCase.id);
  //     /**
  //      *  save intergrated events to userData in json format
  //      *  {
  //      *    screenSize: {},
  //      *    rawEvents: [],
  //      *    steps:[{
  //      *        waitInit:, //milisecond
  //      *        eventsPack: [],
  //      *        touchDownScreen : '', //touch down screen file name
  //      *        displayArea: {x:,y:,w:,h}, //step display Coordinates
  //      *        //tdCo: {x:,y:}, //touch down Coordinates
  //      *      },
  //      *    ]
  //      *    
  //      *  }
  //      * 
  //      */
      
  //     const d = $q.defer();
  //     console.log(path.resolve(this.testCasePath, 'steps.json'));
  //     fs.writeFile(path.resolve(this.testCasePath, 'steps.json'), JSON.stringify(this.testCase), function(result) {
  //       d.resolve(result);
  //     }, function(err) {
  //       d.reject(err);
  //     });
  //     return d.promise;
  //   };

  //   this.load = function(testCaseID, options) {
  //     const d = $q.defer();
  //     options = options || {};
  //     options.testCaseFolder = options.testCaseFolder || 'TestCases';
  //     console.log(app.getPath('userData'), options.testCaseFolder, testCaseID);
  //     this.testCasePath = path.resolve(app.getPath('userData'), options.testCaseFolder, testCaseID);
  //     fs.readFile(path.resolve(this.testCasePath, 'steps.json'), function(err, data) {
  //       if(err){
  //         d.reject(err);
  //       }else{
  //         d.resolve(JSON.parse(data));
  //       }
  //     });
  //     return d.promise;
  //   };

  // }])
  .service('ScreenDisplayHelper', [function() {
    const FIRST_FINGER = 0;
    const SCREEN_SCALE = 4;
    this.touchDisplay = function(device, coordinates, touch_width) {
      /**
       * return display object for css clip
       * {
       *   rect:{
       *     top:
       *     right:
       *     bottom:
       *     left:
       *   }
       * }
       */
      const x = (coordinates[FIRST_FINGER][0].x - device.touchScreenSize.minX) * 
        device.displayScreenSize.X / (device.touchScreenSize.maxX - device.touchScreenSize.minX + 1);
      const y = (coordinates[FIRST_FINGER][0].y - device.touchScreenSize.minY) * 
        device.displayScreenSize.Y / (device.touchScreenSize.maxY - device.touchScreenSize.minY + 1);
      return {
        margin:{
          top: (y - touch_width*SCREEN_SCALE/2)/SCREEN_SCALE,
          left: (x - touch_width*SCREEN_SCALE/2)/SCREEN_SCALE,
        },
        width: device.displayScreenSize.X / SCREEN_SCALE,
        height: device.displayScreenSize.Y / SCREEN_SCALE
      };
    };
    this.swipeDisplay = function(device, coordinates, touch_width) {
      //TODO: draw the track
      const x = (coordinates[FIRST_FINGER][0].x - device.touchScreenSize.minX) * 
        device.displayScreenSize.X / (device.touchScreenSize.maxX - device.touchScreenSize.minX + 1);
      const y = (coordinates[FIRST_FINGER][0].y - device.touchScreenSize.minY) * 
        device.displayScreenSize.Y / (device.touchScreenSize.maxY - device.touchScreenSize.minY + 1);
      return {
        margin:{
          top: (y - touch_width*SCREEN_SCALE/2)/SCREEN_SCALE,
          left: (x - touch_width*SCREEN_SCALE/2)/SCREEN_SCALE,
        },
        width: device.displayScreenSize.X / SCREEN_SCALE,
        height: device.displayScreenSize.Y / SCREEN_SCALE
      };
    };
    this.multiTouchDisplay = function(device, coordinates, touch_width) {
      //TODO: draw the track
      const AMPLIF = 4;
      let top, right, bottom, left;
      for(let i=0;i<Object.keys(coordinates).length;i++){
        if(!top || coordinates[i][0].y < top){
          top = coordinates[i][0].y;
        }
        if(!right || coordinates[i][0].x > right){
          right = coordinates[i][0].x;
        }
        if(!bottom || coordinates[i][0].y > bottom){
          bottom = coordinates[i][0].y;
        }
        if(!left || coordinates[i][0].x < left){
          left = coordinates[i][0].x;
        }
      }
      console.log(top,right,bottom,left);
      const x = (left + (right-left)/2 - device.touchScreenSize.minX) * 
        device.displayScreenSize.X / (device.touchScreenSize.maxX - device.touchScreenSize.minX + 1);
      const y = (top + (bottom-top)/2 - device.touchScreenSize.minY) * 
        device.displayScreenSize.Y / (device.touchScreenSize.maxY - device.touchScreenSize.minY + 1);
      return {
        margin:{
          top: (y - touch_width*(SCREEN_SCALE*AMPLIF)/2)/(SCREEN_SCALE*AMPLIF),
          left: (x - touch_width*(SCREEN_SCALE*AMPLIF)/2)/(SCREEN_SCALE*AMPLIF),
        },
        width: device.displayScreenSize.X / (SCREEN_SCALE*AMPLIF),
        height: device.displayScreenSize.Y / (SCREEN_SCALE*AMPLIF)
      };
    };
    this.fullDisplay = function(device, touch_width) {
      return {
        margin:{
          top:0, left:0
        },
        height: touch_width
      }
    };
  }])
;
