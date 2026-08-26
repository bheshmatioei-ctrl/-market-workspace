Market Research Workspace V5 — Chrome-first, cross-browser PWA

V5 keeps the approved flexible trading/research workspace and changes the sync foundation from Microsoft to Google.

Runtime target

• Primary: Chrome on Windows and Android.
• Supported: Edge, Safari/iPadOS/iOS where web-platform capabilities permit.
• One codebase; no browser lock-in.

Included

• Approved default layout: Yahoo Finance / Market dominant left, ChatGPT large right.
• Drag, resize, fullscreen/restore, minimize, lock, hide/show, Reset Layout, Undo/Redo.
• Rectangle, lasso and widget capture prototype.
• Notes + ChatGPT capture attachment flow.
• Local-first storage.
• PWA manifest + service worker.
• Google Identity Services OAuth adapter.
• Google Drive appDataFolder sync adapter for workspace state.
• Automatic debounced cloud push after local changes when signed in.
• Pull-on-sign-in and timestamp-based last-write-wins reconciliation.
• No client secret in frontend.

GitHub Pages note
-----------------
This GitHub-ready package intentionally omits Google Drive sync and app icons for the first public deployment.
The workspace itself works, stores its state locally in the browser, and can be published on GitHub Pages.
Google sync and PWA icons can be added later without changing the main workspace layout.
