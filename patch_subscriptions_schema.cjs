const fs = require('fs');
const path = require('path');

const routesPath = path.join(__dirname, 'server', 'routes.ts');
let routes = fs.readFileSync(routesPath, 'utf8');

// Replace monthlyFee with price
routes = routes.replace(/monthlyFee:/g, 'price:');

// Remove id: nanoid(), from subscriptions inserts
routes = routes.replace(/id: nanoid\(\),\n\s*/g, '');

// Remove const { nanoid } = require('nanoid');
routes = routes.replace(/const { nanoid } = require\('nanoid'\);\n\s*/g, '');

fs.writeFileSync(routesPath, routes, 'utf8');
console.log('Fixed properties for subscriptions insertion');
