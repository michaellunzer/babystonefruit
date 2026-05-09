# Baby StoneFruit

Quick-log feeding and diaper changes to [Huckleberry](https://huckleberrycare.com/) from a Pebble watch.

## Architecture

```
Pebble watch (embeddedjs/main.js)  ──AppMessage──▶  Phone (pkjs/index.js)
                                                        │ HTTPS
                                                        ▼
                              Cloud proxy (proxy/server.py, Python Flask)
                                                        │ huckleberry-api
                                                        ▼
                                               Huckleberry / Firestore
```

The Pebble JS environment can't speak Firebase/gRPC, so a small Python proxy
bridges to the [`huckleberry-api`](https://pypi.org/project/huckleberry-api/)
library.

## Layout

- `src/embeddedjs/main.js` — watch UI (two-level menu, runs on Moddable XS)
- `src/pkjs/index.js` — phone companion (handles AppMessage, calls proxy)
- `config/config.html` — Clay-style settings page (email + password)
- `proxy/` — Python Flask proxy, deployable to Railway / Render

## Setup

1. **Deploy the proxy** (`proxy/`) to Railway or Render. Copy the public URL.
2. Edit `src/pkjs/index.js` and set `PROXY_URL` to your deployed URL.
3. Host `config/config.html` on a public URL (e.g. GitHub Pages) and set that
   URL in `pkjs/index.js` `showConfiguration` handler.
4. Build via CloudPebble (this Moddable project) and sideload onto your watch.
5. In the Pebble phone app, open the gear icon and enter your Huckleberry
   credentials. They're stored only on your phone.

## Targets

`emery` (Pebble Time 2) and `gabbro` (Pebble 2 Duo).
