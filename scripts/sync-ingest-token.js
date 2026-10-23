const fs = require("fs");
const path = require("path");

const TOKEN = "bb7b94286478499dc0942916fa16792d4be2d04bb2f10bd3cc080302b0b149b6";

// --- API .env ---
const apiEnvPath = path.join(__dirname, "../apps/api/.env");
let api = fs.readFileSync(apiEnvPath, "utf8");
api = api.replace(/^OWNER_INGEST_TOKEN=.*$/m, "OWNER_INGEST_TOKEN=" + TOKEN);
fs.writeFileSync(apiEnvPath, api);
console.log("[API] OWNER_INGEST_TOKEN aggiornato");

// --- Owner Hub .env ---
const hubEnvPath = path.join(__dirname, "../apps/owner-hub/.env");
let hub = fs.readFileSync(hubEnvPath, "utf8");
hub = hub.replace(/^OWNER_INGEST_TOKEN=.*$/m, 'OWNER_INGEST_TOKEN="' + TOKEN + '"');
fs.writeFileSync(hubEnvPath, hub);
console.log("[Hub] OWNER_INGEST_TOKEN aggiornato");

console.log("\nToken: " + TOKEN);
console.log("Entrambi i file sincronizzati.");
