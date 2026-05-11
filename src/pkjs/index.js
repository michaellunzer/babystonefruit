// Phone-side companion for Baby StoneFruit.
//
// All Huckleberry/HA logic now lives on the watch (embeddedjs/main.js) and
// uses fetch() bridged through @moddable/pebbleproxy. This file just keeps
// the proxy wired up so the watch's fetch() works.

const moddableProxy = require("@moddable/pebbleproxy");

Pebble.addEventListener("ready", moddableProxy.readyReceived);

Pebble.addEventListener("appmessage", function (e) {
  moddableProxy.appMessageReceived(e);
});
