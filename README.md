# Aureus

Aureus is a compact browser-style interface with tabs, search/address navigation, full-screen pages, and Quick Launch shortcuts. Ultraviolet is its only proxy engine; Scramjet and the extra Lux panels have been removed.

## Run on Windows

Install [Node.js 18 or newer](https://nodejs.org/), then open Command Prompt in the project folder:

```bat
cd /d "C:\Users\anwar\Documents\Codex\2026-10-12\hey-2\outputs\aureus"
npm install
npm run build
npm start
```

Open [http://localhost:8081](http://localhost:8081). Keep the terminal open while using Aureus and press **Ctrl+C** there to stop the server. Stop Aureus before reinstalling packages so Windows does not lock a native dependency.

Ultraviolet is based on the open-source [Lux](https://github.com/darksomaX/Lux) project. Brand SVGs in `public/assets/brands` are from [Simple Icons](https://github.com/simple-icons/simple-icons), licensed CC0-1.0. Brand names and marks belong to their owners.
