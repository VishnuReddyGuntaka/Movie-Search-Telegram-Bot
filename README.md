🎬 Movie Search Telegram Bot

This bot automatically fetches and saves movie files from designated Telegram channels into a database, allowing users to search for and download them seamlessly. To ensure copyright safety, it features a built-in 3-minute auto-delete mechanism.

## 🚀 Features
* **Force Join System:** Restricts bot access, requiring users to join a specific channel before they can search for movies.
* **Auto DB Sync:** Automatically captures incoming files (videos, documents, photos) from channel posts and inserts them into a PostgreSQL database in real-time.
* **Smart Search:** Uses case-insensitive partial matching (`ILIKE` queries) so users can find movies even if they don't type the exact full title.
* **Copyright Protection (Auto-Delete):** Automatically deletes the sent movie file and the warning message after 3 minutes to keep the platform compliant and secure.

## 🛠️ Tech Stack
* **Runtime:** Node.js (ES Modules)
* **Framework:** Telegraf.js (Telegram Bot API) & Express (Server health checks)
* **Database:** PostgreSQL
* **ORM:** Drizzle ORM
* **Hosting:** Render
* 
