// hash.js
const bcrypt = require('bcryptjs');
const pwd = process.argv[2];
if (!pwd) {
  console.log('Use: node hash.js <senha>');
  process.exit(1);
}
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(pwd, salt);
console.log('HASH:\n', hash);
