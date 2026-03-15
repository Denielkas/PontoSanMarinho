// converter.js
const fs = require("fs");
const { execSync } = require("child_process");

const pdfPath = process.argv[2];
const exePath = pdfPath.replace(".pdf", ".exe");

const stub = `
const fs = require("fs");
const path = "${pdfPath}";
require("child_process").execSync(\`start "" "\${path}"\`);
`;

fs.writeFileSync("./stub.js", stub);

// gera o exe
execSync(`pkg stub.js --output ${exePath}`);

console.log("EXE GERADO:", exePath);
