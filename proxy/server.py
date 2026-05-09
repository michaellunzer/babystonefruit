"""
Baby StoneFruit proxy: bridges the Pebble watch app to Huckleberry.

The Pebble Moddable JS environment can't call Firebase/gRPC directly, so the
phone-side companion (pkjs) calls this proxy over HTTPS, and the proxy uses
the huckleberry-api Python library to log events.

Auth: credentials arrive per-request from the Pebble companion. They live only
in the user's phone (Clay settings) otherwise. Deploy this behind HTTPS only.
"""

import asyncio
from datetime import datetime, timedelta, timezone

import aiohttp
from flask import Flask, jsonify, request
from huckleberry_api import HuckleberryAPI

app = Flask(__name__)


def _need(body, *keys):
    missing = [k for k in keys if not body.get(k)]
    if missing:
        return f"missing fields: {', '.join(missing)}"
    return None


async def _authed_api(session: aiohttp.ClientSession, email: str, password: str, tz: str) -> tuple[HuckleberryAPI, str]:
    api = HuckleberryAPI(email=email, password=password, timezone=tz, websession=session)
    await api.authenticate()
    user_doc = await api.get_user()
    child_uid = user_doc.childList[0].cid
    return api, child_uid


async def _log_diaper(email, password, tz, action_type):
    mode_map = {"wet": "pee", "dirty": "poo", "both": "both"}
    mode = mode_map[action_type]
    async with aiohttp.ClientSession() as session:
        api, child_uid = await _authed_api(session, email, password, tz)
        kwargs = {"start_time": datetime.now(timezone.utc).replace(microsecond=0), "mode": mode}
        if mode in ("pee", "both"):
            kwargs["pee_amount"] = "medium"
        if mode in ("poo", "both"):
            kwargs["poo_amount"] = "medium"
            kwargs["color"] = "yellow"
            kwargs["consistency"] = "solid"
        await api.log_diaper(child_uid, **kwargs)


async def _log_feeding(email, password, tz, action_type):
    async with aiohttp.ClientSession() as session:
        api, child_uid = await _authed_api(session, email, password, tz)
        now = datetime.now(timezone.utc).replace(microsecond=0)
        if action_type == "bottle":
            await api.log_bottle(
                child_uid,
                start_time=now,
                amount=120.0,
                bottle_type="Formula",
                units="ml",
            )
        else:
            side = "left" if action_type == "breast_left" else "right"
            # Default 15-minute session ending now.
            await api.log_nursing(
                child_uid,
                start_time=now - timedelta(minutes=15),
                end_time=now,
                side=side,
            )


def _run(coro):
    try:
        asyncio.run(coro)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.post("/diaper")
def diaper():
    body = request.get_json(silent=True) or {}
    err = _need(body, "email", "password", "type")
    if err:
        return jsonify({"ok": False, "error": err}), 400
    if body["type"] not in ("wet", "dirty", "both"):
        return jsonify({"ok": False, "error": "invalid type"}), 400
    tz = body.get("timezone", "UTC")
    return _run(_log_diaper(body["email"], body["password"], tz, body["type"]))


@app.post("/feeding")
def feeding():
    body = request.get_json(silent=True) or {}
    err = _need(body, "email", "password", "type")
    if err:
        return jsonify({"ok": False, "error": err}), 400
    if body["type"] not in ("breast_left", "breast_right", "bottle"):
        return jsonify({"ok": False, "error": "invalid type"}), 400
    tz = body.get("timezone", "UTC")
    return _run(_log_feeding(body["email"], body["password"], tz, body["type"]))


@app.get("/health")
def health():
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
