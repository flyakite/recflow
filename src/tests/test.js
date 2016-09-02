var Application = require('spectron').Application;
var assert = require('assert');
// var fs = require('fs')

var app = new Application({
  path: '/usr/local/bin/electron',
  args:['app.js']
})

app.start().then(function () {
  // Check if the window is visible
  return app.browserWindow.isVisible();
}).then(function (isVisible) {
  // Verify the window is visible
  assert.equal(isVisible, true);
}).then(function () {
  return app.client.getUrl('url');
}).then(function (url) {
  console.log(url);
//   return app.client.getHTML('html');
// }).then(function (html) {
//   console.log(html);
  return app.client.execute(function() {
    var myApp = angular.module('MainView');
    console.log(myApp);
  });
}).then(function (result) {
  console.log(result);
//   return app.client.click('#main-record-btn');
// }).then(function (result) {
//   console.log(result);
  // return app.client.saveScreenshot('./screen.png');
}).then(function () {
//   return app.client.getTitle(); //click("#main-record-btn");
// }).then(function (tltle) {
//   console.log(title);
  // Stop the application
  return app.stop();
}).catch(function (error) {
  // Log any failures
  console.error('Test failed', error.message)
});