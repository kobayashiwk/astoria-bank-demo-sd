const { initializeDatabase, dbPath } = require('../src/db');

initializeDatabase();
console.log(`Asteria Bank data initialized: ${dbPath}`);
