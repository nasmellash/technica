# TableTap 🍽️

Tap an NFC tag in the dining hall:

- **Table tag** → tell your friends where you're sitting (push notification via [ntfy.sh](https://ntfy.sh)).
- **Entrance tag** → hear spoken walking directions to any table, written for blind and low-vision users.

Plain HTML, CSS and JavaScript. No frameworks, no build step.

## Files

| File | What it does |
|---|---|
| `index.html` | The one page every tag opens. `?loc=table-2` decides what it shows. |
| `style.css` | Mobile-first, high-contrast styling. |
| `app.js` | Page logic: remembers your name, sends notifications, 5-minute cooldown, plays directions. |
| `locations.js` | **Edit this** to add or rename tables. Used by both the page and the audio script. |
| `config.js` | Your ntfy topic name and the cooldown length. |
| `generate-audio.js` | Run once on your laptop: floor plan → Gemini → `directions/*.txt` → ElevenLabs → `audio/*.mp3`. |
| `.env.example` | Template for your API keys. Copy it to `.env`. |
| `.gitignore` | Keeps `.env` (your secret keys) out of git. |

## 1. Set up notifications (2 minutes)

1. Each friend installs the **ntfy** app (Android / iOS) or opens https://ntfy.sh/app.
2. Tap **+ / Subscribe to topic** and enter the topic from `config.js`
   (`tabletap-4bf7497cc047d1878a`). Leave the server as `ntfy.sh`.

ntfy topics are public: anyone who knows the name can read and send messages.
The long random name keeps strangers out, but don't send anything private.

## 2. Make the directions audio

Needs Node.js 21.7 or newer (`node --version`).

1. Save your floor plan as `floorplan.png` in this folder. Label the entrance and
   tables with the **same names as in `locations.js`** ("Main Entrance", "Table 1"...).
2. Copy the key template and fill it in:
   ```bash
   cp .env.example .env
   ```
   - `GEMINI_API_KEY`: from https://aistudio.google.com/apikey
   - `ELEVENLABS_API_KEY`: from https://elevenlabs.io/app/settings/api-keys
   - `ELEVENLABS_VOICE_ID`: pick a voice in ElevenLabs and copy its ID
3. Run:
   ```bash
   node generate-audio.js
   ```
4. **Read every file in `directions/`.** AI can misread a floor plan. Walk the route
   yourself if you can, then fix the text and rebuild only the audio (no Gemini call):
   ```bash
   node generate-audio.js --from-text
   ```

To change the AI model, edit `GEMINI_MODEL` at the top of `generate-audio.js`.

## 3. Test on your laptop

From this folder in Git Bash:

```bash
npx serve .
```

(Type `y` if asked to install. Or just double-click `index.html`, which works too.)
Then "tap" tags by visiting these URLs:

- http://localhost:3000/?loc=entrance
- http://localhost:3000/?loc=table-1
- http://localhost:3000/?loc=table-2
- http://localhost:3000/?loc=table-3
- http://localhost:3000/ (an unknown tag shows links to every location)

Things to check:
- The first visit asks for your name. "Change name" lets you edit it.
- "Notify my friends" sends a notification to the ntfy app. A second tap within
  5 minutes shows a "notify again in about X minutes" message instead.
- Testing the cooldown again? In DevTools (F12) → Application → Local Storage,
  delete the `tabletap-last-sent-...` keys.
- On the entrance page, each "Play directions" button plays its MP3.
- Screen reader check: Windows Narrator (Ctrl + Win + Enter) should read the
  status messages aloud.

## 4. Deploy for free (NFC tags need a real https URL)

⚠️ **Never upload `.env`.** It holds your API keys.

**Option A: GitHub Pages** (`.gitignore` already keeps `.env` out)
1. Create a public repo on GitHub, then push:
   ```bash
   git add .
   git commit -m "TableTap"
   git remote add origin https://github.com/YOUR-USERNAME/tabletap.git
   git push -u origin main
   ```
2. Repo → **Settings → Pages** → Source: *Deploy from a branch* → `main` / `/ (root)` → Save.
3. After about a minute, your site is at `https://YOUR-USERNAME.github.io/tabletap/`.

**Option B: Netlify Drop**
1. Make a copy of this folder **without `.env`** (and without `node_modules` if any).
2. Drag that copy onto https://app.netlify.com/drop.

## 5. Write the NFC tags

With a free app like **NFC Tools** (Android/iOS): Write → Add a record → **URL** →
for example `https://YOUR-USERNAME.github.io/tabletap/?loc=table-2` → Write → hold the phone to the tag.
Leave `index.html` out of the URL: some servers redirect it and drop the `?loc=` part.

## Adding a table

1. Add a line to `locations.js`, e.g.
   `{ id: "table-4", name: "Table 4", type: "table", audio: "audio/table-4.mp3" },`
2. Label it on `floorplan.png`, run `node generate-audio.js`, then redeploy.
