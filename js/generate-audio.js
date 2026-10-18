// Run this ONCE on your computer (not in the browser) to make the directions audio.
//
//   node generate-audio.js              floor plan -> Gemini -> directions/*.txt -> ElevenLabs -> audio/*.mp3
//   node generate-audio.js --from-text  skip Gemini; turn your (edited) directions/*.txt into audio/*.mp3
//
// Needs Node 21.7+ (for built-in .env loading) and a .env file (copy .env.example).

const fs = require("fs");
const LOCATIONS = require("./locations.js");

// ---------- Settings ----------
const GEMINI_MODEL = "gemini-3.8-flash";
const ELEVENLABS_MODEL = "eleven_multilingual_v2";
const FLOORPLAN_FILE = "floorplan.png";

// ---------- Load API keys from .env ----------
try {
  process.loadEnvFile(".env");
} catch (error) {
  console.error("Couldn't read .env. Copy .env.example to .env and fill in your keys.");
  process.exit(1);
}
const { GEMINI_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID } = process.env;

const fromText = process.argv.includes("--from-text");
const entrance = LOCATIONS.find((l) => l.type === "entrance");
const tables = LOCATIONS.filter((l) => l.type === "table");

function requireKey(name, value) {
  if (!value) {
    console.error(`Missing ${name} in .env`);
    process.exit(1);
  }
}

// Ask Gemini for directions from the entrance to one table, using the floor plan image.
async function getDirections(table, floorplanBase64) {
  const prompt =
    `This is a floor plan of a dining hall. Write walking directions from the ` +
    `${entrance.name} to ${table.name} for a blind or low-vision person. ` +
    `Use short, numbered steps. Mention landmarks they can feel or hear (walls, ` +
    `counters, doors, pillars), left/right turns, and approximate number of steps. ` +
    `Do not mention colors or anything only visible by sight. ` +
    `Keep it under 60 words. Reply with only the directions.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: "image/png", data: floorplanBase64 } },
        ],
      }],
    }),
  });
  if (!response.ok) {
    throw new Error(`Gemini error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("").trim();
  if (!text) {
    throw new Error("Gemini returned no text: " + JSON.stringify(data.promptFeedback ?? data));
  }
  return text;
}

// Turn text into speech with ElevenLabs and return the MP3 bytes.
async function textToSpeech(text) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": ELEVENLABS_API_KEY },
    body: JSON.stringify({ text, model_id: ELEVENLABS_MODEL }),
  });
  if (!response.ok) {
    throw new Error(`ElevenLabs error ${response.status}: ${await response.text()}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  requireKey("ELEVENLABS_API_KEY", ELEVENLABS_API_KEY);
  requireKey("ELEVENLABS_VOICE_ID", ELEVENLABS_VOICE_ID);

  let floorplanBase64 = null;
  if (!fromText) {
    requireKey("GEMINI_API_KEY", GEMINI_API_KEY);
    if (!fs.existsSync(FLOORPLAN_FILE)) {
      console.error(`Can't find ${FLOORPLAN_FILE}. Put your floor plan image in this folder.`);
      process.exit(1);
    }
    floorplanBase64 = fs.readFileSync(FLOORPLAN_FILE).toString("base64");
  }

  fs.mkdirSync("directions", { recursive: true });
  fs.mkdirSync("audio", { recursive: true });

  for (const table of tables) {
    const textFile = `directions/${table.id}.txt`;
    let text;

    if (fromText) {
      if (!fs.existsSync(textFile)) {
        console.log(`Skipping ${table.id}: no ${textFile} yet.`);
        continue;
      }
      text = fs.readFileSync(textFile, "utf8").trim();
    } else {
      console.log(`Asking Gemini for directions to ${table.name}...`);
      text = await getDirections(table, floorplanBase64);
      fs.writeFileSync(textFile, text + "\n");
      console.log(`  saved ${textFile}`);
    }

    console.log(`Making audio for ${table.name}...`);
    fs.writeFileSync(table.audio, await textToSpeech(text));
    console.log(`  saved ${table.audio}`);
  }

  console.log("Done! Read the files in directions/ and fix anything wrong, then run:");
  console.log("  node generate-audio.js --from-text");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
