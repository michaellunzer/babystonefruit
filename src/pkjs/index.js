// Phone-side companion for Baby StoneFruit.
// Watch sends an AppMessage with {action, type}; pkjs reads HA settings from
// Clay (URL, token, device_id), translates to a Home Assistant service call,
// and replies success/failure to the watch.
//
// Coexists with the Moddable fetch proxy: any AppMessage that isn't ours is
// forwarded to moddableProxy.

const moddableProxy = require("@moddable/pebbleproxy");

// Map watch action -> HA service path + body augmentation.
function buildServiceCall(action, type, deviceId) {
  var base = { device_id: deviceId };

  // Diaper
  if (action === "diaper") {
    if (type === "wet")   return { path: "huckleberry/log_diaper_pee",  body: Object.assign({ pee_amount: "medium" }, base) };
    if (type === "dirty") return { path: "huckleberry/log_diaper_poo",  body: Object.assign({ poo_amount: "medium", color: "yellow", consistency: "solid" }, base) };
    if (type === "both")  return { path: "huckleberry/log_diaper_both", body: Object.assign({ pee_amount: "medium", poo_amount: "medium", color: "yellow", consistency: "solid" }, base) };
    if (type === "dry")   return { path: "huckleberry/log_diaper_dry",  body: base };
  }

  // Feeding
  if (action === "feeding") {
    if (type === "bottle")        return { path: "huckleberry/log_bottle",       body: Object.assign({ amount: 120.0, bottle_type: "formula", units: "ml" }, base) };
    if (type === "nurse_left")    return { path: "huckleberry/start_nursing",    body: Object.assign({ side: "left"  }, base) };
    if (type === "nurse_right")   return { path: "huckleberry/start_nursing",    body: Object.assign({ side: "right" }, base) };
    if (type === "nurse_complete")return { path: "huckleberry/complete_nursing", body: base };
  }

  return null;
}

function getSettings() {
  try {
    var raw = localStorage.getItem("clay-settings");
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function settingValue(s, key) {
  return s[key] && s[key].value;
}

function trimSlash(url) {
  return url.replace(/\/+$/, "");
}

function reply(ok, message) {
  Pebble.sendAppMessage(
    { result: ok ? "ok" : "err", message: message || "" },
    function () {},
    function () {}
  );
}

function callHomeAssistant(haUrl, token, path, body, onDone) {
  var xhr = new XMLHttpRequest();
  var url = trimSlash(haUrl) + "/api/services/" + path;
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Authorization", "Bearer " + token);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.timeout = 20000;
  xhr.onload = function () {
    var ok = xhr.status >= 200 && xhr.status < 300;
    var msg = "";
    if (!ok) {
      msg = "HTTP " + xhr.status;
      try {
        var json = JSON.parse(xhr.responseText || "{}");
        if (json.message) msg = json.message;
      } catch (e) {}
    }
    onDone(ok, msg);
  };
  xhr.onerror = function () { onDone(false, "network error"); };
  xhr.ontimeout = function () { onDone(false, "timeout"); };
  xhr.send(JSON.stringify(body));
}

function handleAction(action, type) {
  var s = getSettings();
  var haUrl    = settingValue(s, "haUrl");
  var token    = settingValue(s, "haToken");
  var deviceId = settingValue(s, "haDeviceId");

  if (!haUrl || !token || !deviceId) {
    reply(false, "Open settings to configure Home Assistant");
    return;
  }

  var call = buildServiceCall(action, type, deviceId);
  if (!call) {
    reply(false, "Unknown action");
    return;
  }

  callHomeAssistant(haUrl, token, call.path, call.body, function (ok, msg) {
    reply(ok, msg);
  });
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
  var url = "https://michaellunzer.github.io/babystonefruit/config/config.html";
  var current = encodeURIComponent(localStorage.getItem("clay-settings") || "{}");
  Pebble.openURL(url + "?current=" + current);
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
