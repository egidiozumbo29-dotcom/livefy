/* eslint-disable */
const fs = require("node:fs");
const path = require("node:path");
const pass = process.argv[2];
if (!pass) {
  console.error("Manca password");
  process.exit(1);
}
const p = path.join(__dirname, "..", ".env");
let c = fs.readFileSync(p, "utf8");
c = c.replace(/SMTP_PASS="[^"]*"/, `SMTP_PASS="${pass}"`);
fs.writeFileSync(p, c);
console.log("OK");
