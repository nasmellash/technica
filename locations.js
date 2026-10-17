// All the places that have an NFC tag.
// Each tag's URL is:  index.html?loc=<id>
// To add a table: copy a table line, change the id/name/audio, then re-run generate-audio.js.
//
// type:  "entrance" or "table"
// audio: the directions MP3 (from the entrance to this table). Entrances have none.
const LOCATIONS = [
  { id: "entrance", name: "Main Entrance", type: "entrance", audio: null },
  { id: "table-1", name: "Table 1", type: "table", audio: "audio/table-1.mp3" },
  { id: "table-2", name: "Table 2", type: "table", audio: "audio/table-2.mp3" },
  { id: "table-3", name: "Table 3", type: "table", audio: "audio/table-3.mp3" },
];

// This line lets generate-audio.js (Node) load the same list. Browsers ignore it.
if (typeof module !== "undefined") module.exports = LOCATIONS;
