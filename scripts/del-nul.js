const fs = require("node:fs");
const p = "\\\\?\\" + require("node:path").resolve(__dirname, "..", "nul");
console.log("Trying:", p);
try {
  fs.unlinkSync(p);
  console.log("DELETED");
} catch (e) {
  console.log("FAIL:", e.code, e.message);
}
