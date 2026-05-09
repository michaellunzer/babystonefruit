# Baby StoneFruit Proxy

Bridges the Pebble watch app to Huckleberry. The Pebble companion (pkjs) sends
HTTPS requests with the user's Huckleberry credentials and an action; this
proxy logs the event using the `huckleberry-api` Python library.

## Endpoints

| Method | Path | Body |
|--------|------|------|
| POST | `/diaper` | `{email, password, type, timezone?}` — type: `wet`, `dirty`, `both` |
| POST | `/feeding` | `{email, password, type, timezone?}` — type: `breast_left`, `breast_right`, `bottle` |
| GET  | `/health` | — |

## Local dev

```bash
cd proxy
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python server.py   # listens on :5001
```

Test:
```bash
curl -X POST http://localhost:5001/diaper \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"…","type":"wet","timezone":"America/Los_Angeles"}'
```

## Deploy (Railway / Render)

Both autodetect Python via `requirements.txt` and run the `Procfile`. Point the
service at this `proxy/` subdirectory as the root.

## Trust model

Credentials transit HTTPS to your own backend per request. They are stored only
in the user's phone Clay settings. No server-side storage.
