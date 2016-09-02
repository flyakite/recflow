'use strict';

const {ipcRenderer, clipboard} = require('electron'),
  uuid = require('uuid'),
  loki = require('lokijs'),
  //pouchdb = require('pouchdb'), https://github.com/nolanlawson/pouchdb-electron#using-leveldb-via-leveldown
  path = require('path');
const childProcess = require('child_process');
const adb = require('adbkit');

angular
  .module('Utils', ['Config'])
  .factory('Generator', function() {
    return {
      uuid4: function() {
        return uuid.v4();
      }
    };
  })
  .service('ProjectHelper', ['$q', function($q) {
    this.loadSettings = function(options) {
      var d = $q.defer();
      const settingsFile = path.resolve(app.getPath('userData'), options.projectName + '.settings')
      fs.readFile(settingsFile, function(err, data) {
        if(err){
          console.error(err);
          d.reject(err);
          return
        }
        d.resolve(JSON.parse(data));
      });
      return d.promise;
    };
    this.createSettings = function(settings) {
      var d = $q.defer();
      const projectName = settings.projectName;
      const settingsFile = path.resolve(app.getPath('userData'), projectName + '.settings')
      fs.writeFile(settingsFile, JSON.stringify(settings), function(err, data) {
        if(err){
          console.error(err);
          d.reject(err);
          return
        }
        d.resolve(settings);
      });
      return d.promise;
    };
    this.addTestCase = function(settings, testCase) {
      var d = $q.defer();
      const projectName = settings.projectName;
      const settingsFile = path.resolve(app.getPath('userData'), projectName + '.settings')
      fs.readFile(settingsFile, function(err, data) {
        if(err){
          console.error(err);
          d.reject(err);
          return
        }
        settings = JSON.parse(data);
        settings.testCases = settings.testCases || [];
        settings.testCases.push({
          id: testCase.id,
          name: testCase.name
        });
        fs.writeFile(settingsFile, JSON.stringify(settings), function(err, data) {
          if(err){
            console.error(err);
            d.reject(err);
            return
          }
          d.resolve(settings);
        });
      });
      return d.promise;
    };
    this.deleteTestCase = function(settings, testCaseID) {
      var d = $q.defer();
      const projectName = settings.projectName;
      const settingsFile = path.resolve(app.getPath('userData'), projectName + '.settings')
      for(let i=0; i<settings.testCases.length;i++){
        console.log(settings.testCases[i].id, testCaseID);
        if(settings.testCases[i].id == testCaseID){
          console.log(i);
          settings.testCases.splice(i,1);
          console.log(settings.testCases);
          break;
        }
      }
      console.log(settings);
      fs.writeFile(settingsFile, JSON.stringify(settings), function(err, data) {
        if(err){
          console.error(err);
          d.reject(err);
          return
        }
        d.resolve(settings);
      });
      return d.promise;
    };
  }])
  .service('Pouch', ['$q', function($q) {
    //PouchDB included in html
    const db = new PouchDB('recflow'); //, {adapter : 'websql'}
    
    this.save = function(doc, _class) {
      const d = $q.defer();
      if(!doc._id){
        //new item
        doc._id = uuid.v4();
      }
      doc.class = _class || doc.class;

      db.put(doc).then(function(result) {
        return d.resolve(result);
      }).catch(function(err) {
        console.error(err);
        return d.reject(err);
      });
      return d.promise;
    };
    this.get_by_id = function(docID) {
      const d = $q.defer();
      db.get(docID).then(function(result) {
        return d.resolve(result);
      }).catch(function(err) {
        console.error(err);
        return d.reject(err);
      });
      return d.promise;
    };
    this.remove = function(doc) {
      const d = $q.defer();
      db.remove(doc._id, doc._rev).then(function(result) {
        return d.resolve(result);
      }).catch(function(err) {
        console.error(err);
        return d.reject(err);
      });
      return d.promise;
    };
    return this;
  }])
  // .service('Storage', ['$q', function($q) {
  //   this.db = new loki(path.resolve(app.getPath('userData'), 'app.db'));
  //   this.loaded = false;

  //   this.init = function() {
  //     return this.reload();
  //   };

  //   this.reload = function() {
  //     let d = $q.defer();

  //     this.loaded = false;

  //     this.db.loadDatabase({}, (e)=> {
  //       if(e) {
  //         d.reject(e);
  //       } else {
  //         this.loaded = true;
  //         d.resolve(this);
  //       }
  //     });

  //     return d.promise;
  //   };

  //   this.getCollection = function(collectionName) {
  //     this.collection = this.db.getCollection(collectionName);
  //     return this.collection;
  //   };

  //   this.isLoaded = function() {
  //     return this.loaded;
  //   };

  //   this.add = function(collectionName, data) {
  //     let d = $q.defer();

  //     if(this.isLoaded() && this.getCollection(collectionName)) {
  //       this.getCollection(collectionName).insert(data);
  //       this.db.saveDatabase();

  //       d.resolve(this.getCollection(collectionName));
  //     } else {
  //       d.reject(new Error('DB NOT READY'));
  //     }

  //     return d.promise;
  //   };

  //   this.remove = function(collectionName, doc) {
  //     return function() {
  //       let d = $q.defer();

  //       if(this.isLoaded() && this.getCollection(collectionName)) {
  //         this.getCollection(collectionName).remove(doc);
  //         this.db.saveDatabase();

  //         // we need to inform the insert view that the db content has changed
  //         // ipcRenderer.send('reload-insert-view');

  //         d.resolve(true);
  //       } else {
  //         d.reject(new Error('DB NOT READY'));
  //       }

  //       return d.promise;
  //     }.bind(this);
  //   };

  //   this.getAll = function(collectionName) {
  //     return (this.getCollection(collectionName)) ? this.getCollection(collectionName).data : null;
  //   };
  // }])
  // .service('Storage', ['$q', function($q) {
  //   this.db = new loki(path.resolve(app.getPath('userData'), 'app.db'));
  //   this.collection = null;
  //   this.collectionName = null;
  //   this.loaded = false;

  //   this.init = function(collectionName) {
  //     let d = $q.defer();
  //     this.collectionName = collectionName;
  //     this.reload()
  //       .then(()=> {
  //         this.collection = this.db.getCollection(collectionName);
  //         this.collection || this.db.addCollection(collectionName);
  //         d.resolve(this);
  //       })
  //       .catch((e)=> {
  //         // create collection
  //         this.db.addCollection(collectionName);
  //         // save and create file
  //         this.db.saveDatabase();

  //         this.collection = this.db.getCollection(collectionName);
  //         // this.loaded = true;

  //         d.resolve(this);
  //       });

  //     return d.promise;
  //   };

  //   this.reload = function() {
  //     let d = $q.defer();

  //     this.loaded = false;

  //     this.db.loadDatabase({}, (e)=> {
  //       if(e) {
  //         d.reject(e);
  //       } else {
  //         this.loaded = true;
  //         d.resolve(this);
  //       }
  //     });

  //     return d.promise;
  //   };

  //   this.getCollection = function() {
  //     this.collection = this.db.getCollection(this.collectionName);
  //     return this.collection;
  //   };

  //   this.isLoaded = function() {
  //     return this.loaded;
  //   };

  //   this.add = function(data) {
  //     let d = $q.defer();

  //     if(this.isLoaded() && this.getCollection()) {
  //       this.getCollection().insert(data);
  //       this.db.saveDatabase();

  //       d.resolve(this.getCollection());
  //     } else {
  //       d.reject(new Error('DB NOT READY'));
  //     }

  //     return d.promise;
  //   };

  //   this.remove = function(doc) {
  //     return function() {
  //       let d = $q.defer();

  //       if(this.isLoaded() && this.getCollection()) {
  //         this.getCollection().remove(doc);
  //         this.db.saveDatabase();

  //         // we need to inform the insert view that the db content has changed
  //         ipcRenderer.send('reload-insert-view');

  //         d.resolve(true);
  //       } else {
  //         d.reject(new Error('DB NOT READY'));
  //       }

  //       return d.promise;
  //     }.bind(this);
  //   };

  //   this.getAll = function() {
  //     return (this.getCollection()) ? this.getCollection().data : null;
  //   };
  // }])
  .service('adb', ['$q', '$timeout', 'EV_CODE', function($q, $timeout, EV_CODE) {
    this.client = adb.createClient();

    this.init = function(deviceID) {
      const d1 = $q.defer(), d2 = $q.defer();
      this.deviceID = deviceID;
      this.client.shell(deviceID, 'getevent -p')
        .then(adb.util.readAll)
        .then((result)=> {
          let touchScreenSize = {};
          const deviceInfo = result.toString();
          let match = /\s*0035\s+.*min\s+(\d+).*max\s+(\d+).*/.exec(deviceInfo);
          if(match){
            touchScreenSize.minX = match[1];
            touchScreenSize.maxX = match[2];
          }
          match = /\s*0036\s+.*min\s+(\d+).*max\s+(\d+).*/.exec(deviceInfo);
          if(match){
            touchScreenSize.minY = match[1];
            touchScreenSize.maxY = match[2];
          }
          d1.resolve(touchScreenSize);
        });
      this.client.shell(this.deviceID, 'dumpsys window | grep "mUnrestrictedScreen"')
        .then(adb.util.readAll)
        .then((result)=> {
          let displayScreenSize = {};
          const mUnrestrictedScreen = result.toString();
          const match = /.*\s+(\d+)x(\d+)/.exec(mUnrestrictedScreen);
          if(match){
            displayScreenSize.X = match[1];
            displayScreenSize.Y = match[2];
          }
          d2.resolve(displayScreenSize);
        })
      return $q.all([d1.promise, d2.promise]);
    };
    
    this.getEvents = function(callback) {
      this.recordingProcess = childProcess.execFile('adb', ['shell', 'getevent', '-lt' ]);
      this.recordingProcess.stdout.on('data', callback);
    };
    this.stopGetEvents = function() {
      this.recordingProcess && this.recordingProcess.kill();
    }
    this.takeScreenshot = function(savePath, callback) {
      // console.log(this.deviceID, savePath);
      const stream = fs.createWriteStream(savePath);
      // stream.on('finish', callback);
      this.client.screencap(this.deviceID).then(function(screencapStream) {
        // err && console.error(err);
        screencapStream.pipe(stream);
        screencapStream.on('end', callback);
      });
    };

    this.codeMap = function(code) {
      if(Object.keys(EV_CODE).indexOf(code) !== -1){
        const v = EV_CODE[code]
        if(/^0x[0-9a-f]+$/.test(v)){
          return parseInt(v,16);
        }else if(/^[0-9]+$/.test(v)){
          return parseInt(v, 10);
        }else{
          return v;
        }
      }else{
        return code;
      }

    };
    this.sendEvent = function(e) {
      //http://androidxref.com/4.4_r1/xref/prebuilts/ndk/6/platforms/android-9/arch-arm/usr/include/linux/input.h
      //decimal
      if(/^[0-9a-f]{8}$/.test(e.value)){
        e.value = parseInt(e.value, 16);
      }
      // const command = `sendevent /dev/input/${e.input} ${e.type} ${e.code} ${e.value}`;
      const o_command = `sendevent /dev/input/${e.input} ${e.type} ${e.code} ${e.value}`;
      const command = `sendevent /dev/input/${e.input} ${this.codeMap(e.type)} ${this.codeMap(e.code)} ${this.codeMap(e.value)}`;
      console.log(o_command);
      this.client.shell(this.deviceID, command);
    };
    return this;
  }])
  .service('DeviceEventHelper', ['$q', function($q) {
    console.log('DeviceEventHelper');
    this.state = 'none';
    this.touchNumber = 0;
    this.buffer = [];
    this.touchCoordinates = {};
    this.currentSlot = 0;
    this.eventsPack = [];
    this.touchDuration = [];
    this.init = function() {
      console.log('DeviceEventHelper init');
      this.state = 'none';
      this.touchNumber = 0;
      this.buffer = [];
      this.touchCoordinates = {};
      this.currentSlot = 0;
      this.eventsPack = [];
      this.touchDuration = [];
      return this;
    };
    this.handleChoppedEvent = function(e, callback) {
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
                    callback({state:this.state});
                  }else if(e.value == 'UP'){
                    this.state = 'power_button_up';
                    callback({state:this.state});
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
                  if(e.value !== 'ffffffff'){
                    //new touch
                    this.touchDuration[this.touchNumber] = {start:e.time};
                    if(this.touchNumber === 0){
                      this.state = 'touch_first';
                      this.touchNumber++;
                      callback({
                        state:this.state, 
                        time:e.time
                      });
                    }else{
                      this.state = 'touch_multi';
                      this.touchNumber++;
                      callback({
                        state:this.state, 
                        touchNumber:this.touchNumber, 
                        time:e.time
                      });
                    }
                  }else{
                    //end of tracking a touch
                    this.touchNumber--;
                    this.touchDuration[this.touchNumber] = this.touchDuration[this.touchNumber] || {};
                    let duration = this.touchDuration[this.touchNumber];
                    duration.end = e.time;
                    if(duration.start){
                      duration.duration = duration.end - duration.start;
                    }
                    if(this.touchNumber === 0){
                      this.state = 'touch_finished';
                      console.log(this.touchDuration[this.touchNumber]);
                      callback({
                        state:this.state, 
                        touchCoordinates:this.touchCoordinates, 
                        time:e.time,
                        duration: duration.duration
                      });
                      this.touchCoordinates = {};
                    }else{
                      this.state = 'touch_up';
                      callback({
                        state:this.state,
                        touchNumber:this.touchNumber, 
                        time:e.time,
                        duration: duration.duration
                      });  
                    }
                  }
                  break;
                case 'ABS_MT_SLOT':
                  this.currentSlot = parseInt(e.value);
                  break;
                case 'ABS_MT_POSITION_X':
                  console.log('ABS_MT_POSITION_X', this.touchCoordinates);
                  if(typeof this.touchCoordinates[this.currentSlot] === 'undefined'){
                    this.touchCoordinates[this.currentSlot] = [];
                  }
                  this.touchCoordinates[this.currentSlot].push({x:parseInt(e.value, 16),t:e.time});
                  break;
                case 'ABS_MT_POSITION_Y':
                  console.log('ABS_MT_POSITION_Y', this.touchCoordinates);
                  let coor = this.touchCoordinates[this.currentSlot];
                  if(coor){
                    coor[coor.length-1].y = parseInt(e.value, 16);
                  }
                  break;
                default:
                  // console.log(e.code);
              }
              break;
            case 'EV_SYN':
              switch(e.code){
                case 'SYN_REPORT':
                  if(['power_button_up', 'touch_finished'].indexOf(this.state) !== -1){
                    // console.log('return to none state');
                    this.state = 'none';
                    callback({state:this.state, eventsPack:this.eventsPack});
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
      return this;
    };//receive

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
      return this;
    };

  }])
  .service('TestCaseHelper', ['$q', function($q) {

    this.save = function(testCase, options) {
      options = options || {};
      options.testCaseFolder = options.testCaseFolder || 'TestCases';
      this.testCase = testCase;
      this.testCasePath = path.resolve(app.getPath('userData'), options.testCaseFolder, this.testCase.id);
      /**
       *  save intergrated events to userData in json format
       *  {
       *    screenSize: {},
       *    rawEvents: [],
       *    steps:[{
       *        waitInit:, //milisecond
       *        eventsPack: [],
       *        touchDownScreen : '', //touch down screen file name
       *        displayArea: {x:,y:,w:,h}, //step display Coordinates
       *        //tdCo: {x:,y:}, //touch down Coordinates
       *      },
       *    ]
       *    
       *  }
       * 
       */
      
      const d = $q.defer();
      console.log(path.resolve(this.testCasePath, 'steps.json'));
      fs.writeFile(path.resolve(this.testCasePath, 'steps.json'), JSON.stringify(this.testCase), function(result) {
        d.resolve(result);
      }, function(err) {
        d.reject(err);
      });
      return d.promise;
    };

    this.load = function(testCaseID, options) {
      const d = $q.defer();
      options = options || {};
      options.testCaseFolder = options.testCaseFolder || 'TestCases';
      console.log(app.getPath('userData'), options.testCaseFolder, testCaseID);
      this.testCasePath = path.resolve(app.getPath('userData'), options.testCaseFolder, testCaseID);
      fs.readFile(path.resolve(this.testCasePath, 'steps.json'), function(err, data) {
        if(err){
          d.reject(err);
        }else{
          d.resolve(JSON.parse(data));
        }
      });
      return d.promise;
    };

  }])
  .service('ScreenDisplayHelper', [function() {
    const FIRST_TOUCH = 0;
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
      const x = (coordinates[FIRST_TOUCH][0].x - device.touchScreenSize.minX) * 
        device.displayScreenSize.X / (device.touchScreenSize.maxX - device.touchScreenSize.minX + 1);
      const y = (coordinates[FIRST_TOUCH][0].y - device.touchScreenSize.minY) * 
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
      const x = (coordinates[FIRST_TOUCH][0].x - device.touchScreenSize.minX) * 
        device.displayScreenSize.X / (device.touchScreenSize.maxX - device.touchScreenSize.minX + 1);
      const y = (coordinates[FIRST_TOUCH][0].y - device.touchScreenSize.minY) * 
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
