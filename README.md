# Discord Trading Message Bot — Node.js for Windows

Posts educational trading tips, psychology reminders, and technical-analysis concepts to one Discord text channel. Default interval: **one minute**.

## Requirements
- Windows 10/11
- Node.js 20 or newer (LTS recommended): https://nodejs.org/
- Permission to add a bot to your Discord server

## 1. Create your Discord bot
1. Visit https://discord.com/developers/applications and choose **New Application**.
2. Open **Bot** and create the bot if prompted. Copy/reset its token. Treat it like a password.
3. Open **OAuth2 → URL Generator**. Select scope `bot`; select permissions **View Channels**, **Send Messages**, and **Embed Links**.
4. Open the generated URL and add the bot to your server.
5. In Discord, enable **User Settings → Advanced → Developer Mode**. Right-click the target text channel and choose **Copy Channel ID**.
6. Never share the token or commit it to GitHub. If exposed, reset it in the Developer Portal.

The bot only uses the `Guilds` gateway intent; no privileged Message Content intent is needed.

## 2. Install and configure
1. Extract this ZIP into a folder such as `C:\\DiscordTradingBot`.
2. Copy `.env.example` to a file named `.env` in the project root. Ensure it is not accidentally `.env.txt`.
3. Open `.env` in Notepad and enter:
   ```dotenv
   DISCORD_BOT_TOKEN=your_real_bot_token
   DISCORD_CHANNEL_ID=your_target_channel_id
   POST_INTERVAL_MINUTES=1
   RECENT_HISTORY_SIZE=50
   ```
4. Install Node.js 20+ from https://nodejs.org/ if needed.
5. Open the project folder in File Explorer, click the address bar, type `cmd`, and press Enter.
6. Run:
   ```bat
   npm install
   npm run check
   npm start
   ```
The bot posts one message after login, then once every minute. Keep the terminal open. Press `Ctrl+C` to stop it. You can also run `run.bat`.

## 3. Edit messages
Edit `messages.json`. Each item needs a unique `id`, `category`, and `text`, for example:
```json
{
  "id": "psych-007",
  "category": "Psychology",
  "text": "A good process includes knowing when not to trade."
}
```
Keep valid JSON syntax (quotes around strings and commas between objects). The bot reloads the file before each post, so valid edits take effect without restarting.

## 4. Duplicate prevention
- Recent IDs are stored in `data/state.json` and survive restarts.
- `RECENT_HISTORY_SIZE=50` means the last 50 IDs are avoided where possible.
- If all entries are within the recent window, the bot begins a new cycle and avoids repeating the previous text immediately when possible.
- Use a unique ID for each library item. Reusing an ID means the bot considers those items the same for duplicate tracking.

## 5. Logs and troubleshooting
Logs are in the console and `data/bot.log`.
- **Missing token/channel ID:** confirm `.env` is in the project root and variable names are exact.
- **Cannot send:** check the channel ID and grant the bot View Channel, Send Messages, and Embed Links permissions.
- **Invalid library:** ensure `messages.json` is a non-empty JSON array with valid entries.
- **Login failed:** check the token; reset it if it may have been exposed.
- Changes to `.env` require restarting the bot.

## 6. Start automatically on Windows (optional)
Use **Task Scheduler** → **Create Task** → trigger **At log on** → action **Start a program**:
- Program/script: find Node using `where node` in Command Prompt.
- Add arguments: `src\\bot.js`
- Start in: the project folder, e.g. `C:\\DiscordTradingBot`
Test the task after saving. A sleeping, shut-down, or offline PC cannot post.

## API and rate limits
This uses Discord's official API through `discord.js`, not a user-account self-bot. The library handles Discord API rate-limit responses. One post per minute is intentionally conservative; do not add rapid retry loops or try to bypass limits. Follow Discord's Developer Terms, Developer Policy, and server rules.

Content is general education, not personalized financial advice, trade signals, or a promise of results.
