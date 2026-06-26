# VIP Any Media Downloader

React + Express media downloader powered by `yt-dlp`.

## Local Development

```bash
npm install
npm run dev
```

## Render Deployment

Use these commands in Render:

- Build command: `npm install && npm run build`
- Start command: `npm start`

## Fixing YouTube "Sign in to confirm you're not a bot"

YouTube may block data-center IPs such as Render's free servers unless `yt-dlp` receives logged-in YouTube cookies. Facebook, Instagram, and Twitter can still work without this, which is why only YouTube fails.

The app supports these server-side variables:

- `YTDLP_COOKIES_FILE`: path to a Netscape-format cookies file. Recommended for Render Secret Files.
- `YTDLP_COOKIES_BASE64`: base64 encoded Netscape-format cookies content.
- `YTDLP_COOKIES_CONTENT`: raw Netscape-format cookies content. Use `\n` for line breaks if your dashboard stores it as one line.

Recommended Render Secret File setup:

1. Export YouTube cookies from a browser where YouTube is signed in. Use Netscape/cookies.txt format.
2. In Render, open the service, then go to **Environment**.
3. Add a **Secret File** named `youtube-cookies.txt` and paste the exported cookie text.
4. Add an environment variable:

```text
YTDLP_COOKIES_FILE=/etc/secrets/youtube-cookies.txt
```

5. Redeploy the service.

Alternative base64 setup:

```bash
base64 -w 0 youtube-cookies.txt
```

Add the output as:

```text
YTDLP_COOKIES_BASE64=PASTE_BASE64_OUTPUT_HERE
```

Cookies expire. If YouTube starts failing again later, export a fresh cookies file and update the Render secret.
