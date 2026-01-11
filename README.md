## RUN ON DESKTOP

1. Configure the MCP server :  

 "human-assistant": {
      "args": [
        "c:\\Users\\[YOUR_NAME]\\Desktop\\Human_Loop_project\\mcp-server.js"
      ],
      "command": "node",
      "disabled": false,
      "disabledTools": []
    },

2. Install dependencies (once): `npm install`
3. Start dev server: `npm run dev`
   - Access chat via URL: `http://localhost:7777`

-------------------------------------------------------------------------------------------------------------------------------

## RUN ON MOBILE (SAME Wi‑Fi ONLY!)

1. Find your Wi‑Fi IPv4 (Windows): run `ipconfig`
2. On the mobile browser, open `http://<Your-WiFi-IP>:7777` (example: `http://192.168.0.100:7777`).


PS:If unreachable, allow inbound TCP on port **7777** in Windows Defender Firewall.

