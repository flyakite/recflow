'use strict';

const {ipcRenderer, clipboard} = require('electron'),
  uuid = require('uuid'),
  loki = require('lokijs'),
  LokiNativescriptAdapter = require('lokijs/src/loki-nativescript-adapter'),
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
  // .service('Pouch', ['$q', function($q) {
  //   //PouchDB included in html
  //   const db = new PouchDB('recflow'); //, {adapter : 'websql'}
    
  //   this.db = db;

  //   this.save = function(doc, _class) {
  //     const d = $q.defer();
  //     if(!doc._id){
  //       //new item
  //       doc._id = uuid.v4();
  //     }
  //     doc.class = _class || doc.class;

  //     db.put(doc).then(function(result) {
  //       return d.resolve(result);
  //     }).catch(function(err) {
  //       console.error(err);
  //       return d.reject(err);
  //     });
  //     return d.promise;
  //   };
  //   this.get_by_id = function(docID) {
  //     const d = $q.defer();
  //     db.get(docID).then(function(result) {
  //       return d.resolve(result);
  //     }).catch(function(err) {
  //       console.error(err);
  //       return d.reject(err);
  //     });
  //     return d.promise;
  //   };
  //   this.remove = function(doc) {
  //     const d = $q.defer();
  //     db.remove(doc._id, doc._rev).then(function(result) {
  //       return d.resolve(result);
  //     }).catch(function(err) {
  //       console.error(err);
  //       return d.reject(err);
  //     });
  //     return d.promise;
  //   };
  //   return this;
  // }])
  .service('Storage', ['$q', function($q) {
    this.db = new loki(path.resolve(app.getPath('userData'), 'app.db'));
    // this.db = new loki('app.db');

    this.loaded = false;
    this.ready = function() {
      let d = $q.defer();
      if(!this.loaded){
        this.reload()
        .then(()=> {
          d.resolve(this);
        })
        .catch(function(err) {
          console.error(err);
        });
      }else{
        d.resolve(this);
      }
      return d.promise;
    }

    this.reload = function() {
      const d = $q.defer();

      this.loaded = false;

      this.db.loadDatabase({}, (err)=> {
        if(!err) {
          this.loaded = true;
          d.resolve(this);
        } else {
          d.reject(err);
        }
      });

      return d.promise;
    };

    this.isLoaded = function() {
      return this.loaded;
    };

    this.getCollection = function(collectionName) {
      this.collection = this.db.getCollection(collectionName) || this.db.addCollection(collectionName);
      return this.collection;
    };

    this.addCollection = function(collectionName) {
      this.collection = this.db.addCollection(collectionName);
      return this.collection;
    };

    this.add = function(collectionName, data) {
      const d = $q.defer();

      if(this.isLoaded() && this.getCollection(collectionName)) {
        this.getCollection(collectionName).insert(data);
        this.db.saveDatabase();

        d.resolve(this.getCollection(collectionName));
      } else {
        d.reject(new Error('DB NOT READY'));
      }

      return d.promise;
    };

    this.remove = function(collectionName, doc) {
      return function() {
        const d = $q.defer();

        if(this.isLoaded() && this.getCollection(collectionName)) {
          this.getCollection(collectionName).remove(doc);
          this.db.saveDatabase();

          // we need to inform the insert view that the db content has changed
          // ipcRenderer.send('reload-insert-view');

          d.resolve(true);
        } else {
          d.reject(new Error('DB NOT READY'));
        }

        return d.promise;
      }.bind(this);
    };

    this.getAll = function(collectionName) {
      return (this.getCollection(collectionName)) ? this.getCollection(collectionName).data : null;
    };

    this.saveDatabase = function() {
      this.db.saveDatabase();
    };
  }])
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
;
