## Run the app locally

1. Install dependencies (once): `npm install`
2. Start dev server: `npm run dev -- --hostname 0.0.0.0`
   - Defaults to port **7777**.
   - Local URL: `http://localhost:7777`
3. Production build/start:
   - Build: `npm run build`
   - Start: `npm run start -- --hostname 0.0.0.0`

## Access from another device (mobile/tablet on same Wi‑Fi)

1. Find your Wi‑Fi IPv4 (Windows): run `ipconfig` and look for “Wi‑Fi” IPv4 (e.g., `192.168.x.x`).
2. Ensure the dev server is started with `--hostname 0.0.0.0` (see above).
3. On the mobile browser, open `http://<Your-WiFi-IP>:7777` (example: `http://192.168.0.95:7777`).
4. If unreachable, allow inbound TCP on port **7777** in Windows Defender Firewall.

## Environment

- Env file: `.env` (already present). Add any required keys there before running.

## Notes

- Port is fixed to **7777** in scripts; change with `--port <port>` if needed.
- The startup banner may show multiple interfaces; use your Wi‑Fi IP for mobile access.
