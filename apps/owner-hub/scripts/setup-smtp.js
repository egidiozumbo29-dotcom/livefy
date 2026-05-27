/* eslint-disable */
const fs = require("node:fs");
const path = require("node:path");
const p = path.join(__dirname, "..", ".env");
let c = fs.readFileSync(p, "utf8");
c = c.replace('SMTP_HOST=""', 'SMTP_HOST="smtp.gmail.com"');
c = c.replace('SMTP_USER=""', 'SMTP_USER="egidiozumbo29@gmail.com"');
c = c.replace(
  'SMTP_FROM="Owner Hub <noreply@tuodominio.com>"',
  'SMTP_FROM="Owner Hub <egidiozumbo29@gmail.com>"',
);
fs.writeFileSync(p, c);
console.log("env updated");
console.log(c);
