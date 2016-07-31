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
      var d = $q.defer();
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
      var d = $q.defer();

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
      var d = $q.defer();

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
        var d = $q.defer();

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
  }]);
