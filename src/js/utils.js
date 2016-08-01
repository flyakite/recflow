'use strict';

const {ipcRenderer, clipboard} = require('electron'),
  uuid = require('uuid'),
  loki = require('lokijs'),
  path = require('path');

angular
  .module('Utils', [])
  .factory('Generator', function() {
    return {
      create: function() {
        return uuid.v4();
      }
    };
  })
  .service('Storage', ['$q', function($q) {
    this.db = new loki(path.resolve(__dirname, '../..', 'app.db'));
    this.collection = null;
    this.collectionName = null;
    this.loaded = false;

    this.init = function(collectionName) {
      let d = $q.defer();
      this.collectionName = collectionName;
      this.reload()
        .then(()=> {
          this.collection = this.db.getCollection(collectionName);
          this.collection || this.db.addCollection(collectionName);
          d.resolve(this);
        })
        .catch((e)=> {
          // create collection
          this.db.addCollection(collectionName);
          // save and create file
          this.db.saveDatabase();

          this.collection = this.db.getCollection(collectionName);
          // this.loaded = true;

          d.resolve(this);
        });

      return d.promise;
    };

    this.reload = function() {
      let d = $q.defer();

      this.loaded = false;

      this.db.loadDatabase({}, (e)=> {
        if(e) {
          d.reject(e);
        } else {
          this.loaded = true;
          d.resolve(this);
        }
      });

      return d.promise;
    };

    this.getCollection = function() {
      this.collection = this.db.getCollection(this.collectionName);
      return this.collection;
    };

    this.isLoaded = function() {
      return this.loaded;
    };

    this.add = function(data) {
      let d = $q.defer();

      if(this.isLoaded() && this.getCollection()) {
        this.getCollection().insert(data);
        this.db.saveDatabase();

        d.resolve(this.getCollection());
      } else {
        d.reject(new Error('DB NOT READY'));
      }

      return d.promise;
    };

    this.remove = function(doc) {
      return function() {
        let d = $q.defer();

        if(this.isLoaded() && this.getCollection()) {
          this.getCollection().remove(doc);
          this.db.saveDatabase();

          // we need to inform the insert view that the db content has changed
          ipcRenderer.send('reload-insert-view');

          d.resolve(true);
        } else {
          d.reject(new Error('DB NOT READY'));
        }

        return d.promise;
      }.bind(this);
    };

    this.getAll = function() {
      return (this.getCollection()) ? this.getCollection().data : null;
    };
  }])
  .service('TouchRawEventHelper', ['$q', function($q) {
    this.state = 'none';
    this.touchNumber = 0;
    this.buffer = [];
    this.touchCoordinates = {};
    this.currentSlot = 0;
    this.receiveChoppedEvent = function(e, callback) {
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
                default:
                  console.log(e.code);
              }
              break;
            case 'EV_ABS':
              switch(e.code){
                case 'ABS_MT_TRACKING_ID':
                  if(e.value == 'ffffffff'){
                    this.touchNumber--;
                    if(this.touchNumber === 0){
                      this.state = 'touch_finished';
                      callback({
                        state:this.state, 
                        touchNumber:this.touchNumber,
                        touchCoordinates:this.touchCoordinates
                      });
                      this.touchCoordinates = {};
                    }else{
                      this.state = 'touch_up';
                      callback({state:this.state, touchNumber:this.touchNumber});  
                    }
                  }else{
                    //new touch
                    this.state = 'touch_down';
                    this.touchNumber++;
                    callback({state:this.state, touchNumber:this.touchNumber});
                  }
                  break;
                case 'ABS_MT_SLOT':
                  this.currentSlot = parseInt(e.value);
                  break;
                case 'ABS_MT_POSITION_X':
                  if(typeof this.touchCoordinates[this.currentSlot] === 'undefined'){
                    this.touchCoordinates[this.currentSlot] = [];
                  }
                  this.touchCoordinates[this.currentSlot].push({x:parseInt(e.value, 16),t:e.time});
                  break;
                case 'ABS_MT_POSITION_Y':
                  let coor = this.touchCoordinates[this.currentSlot];
                  coor[coor.length-1]['y'] = parseInt(e.value, 16);
                  break;
                default:
                  // console.log(e.code);
              }
              break;
            case 'EV_SYN':
              switch(e.code){
                case 'SYN_REPORT':
                  if(['power_button_up', 'touch_finished'].indexOf(this.state) !== -1){
                    this.state = 'none';
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
            value: match[5]
          });
        }
      }
      return this;
    };

  }])
;
