// Phone-side companion for Baby StoneFruit.
// - Receives action requests from the watch via AppMessage
// - Reads Huckleberry credentials from Clay settings
// - POSTs to the cloud proxy, returns success/failure to the watch
//
// Coexists with the Moddable fetch proxy: any AppMessage that isn't ours
// is forwarded to moddableProxy.

const moddableProxy = require("@moddable/pebbleproxy");

// TODO: replace with your deployed Railway/Render URL.
var PROXY_URL = "https://your-app.up.railway.app";

function getSettings() {
  try {
    var raw = localStorage.getItem("clay-settings");
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function detectTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch (e) {
    return "UTC";
  }
}

function reply(transactionId, ok, message) {
  Pebble.sendAppMessage(
    { result: ok ? "ok" : "err", message: message || "" },
    function () {},
    function () {}
  );
}

function postAction(path, body, onDone) {
  var xhr = new XMLHttpRequest();
  xhr.open("POST", PROXY_URL + path, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.timeout = 20000;
  xhr.onload = function () {
    var ok = xhr.status >= 200 && xhr.status < 300;
    var msg = "";
    try {
      var json = JSON.parse(xhr.responseText || "{}");
      ok = ok && json.ok === true;
      if (!ok) msg = json.error || ("HTTP " + xhr.status);
    } catch (e) {
      ok = false;
      msg = "bad response";
    }
    onDone(ok, msg);
  };
  xhr.onerror = function () { onDone(false, "network error"); };
  xhr.ontimeout = function () { onDone(false, "timeout"); };
  xhr.send(JSON.stringify(body));
}

function handleAction(action, type) {
  var s = getSettings();
  var email = s.huckleberryEmail && s.huckleberryEmail.value;
  var password = s.huckleberryPassword && s.huckleberryPassword.value;
  if (!email || !password) {
    reply(null, false, "Set credentials in app settings");
    return;
  }
  var path = action === "feeding" ? "/feeding" : "/diaper";
  postAction(
    path,
    { email: email, password: password, type: type, timezone: detectTimezone() },
    function (ok, msg) { reply(null, ok, msg); }
  );
}

Pebble.addEventListener("ready", moddableProxy.readyReceived);

Pebble.addEventListener("appmessage", function (e) {
  var p = e.payload || {};
  if (p.action === "feeding" || p.action === "diaper") {
    handleAction(p.action, p.type);
    return;
  }
  // Not ours — let the Moddable proxy handle it (powers fetch() on watch).
  if (moddableProxy.appMessageReceived(e)) return;
});

Pebble.addEventListener("showConfiguration", function () {
  var url = "https://cdn.jsdelivr.net/gh/" +
    "anthropics/baby-stonefruit-config@main/config.html"; // placeholder
  // Replace with your hosted config.html URL once published.
  Pebble.openURL(url);
});

Pebble.addEventListener("webviewclosed", function (e) {
  if (!e.response) return;
  try {
    var settings = JSON.parse(decodeURIComponent(e.response));
    localStorage.setItem("clay-settings", JSON.stringify(settings));
  } catch (err) {
    // ignore
  }
});
