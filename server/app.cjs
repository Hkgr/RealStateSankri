// Startup file for hosting panels such as Plesk (Node.js extension / Passenger), which load the startup file
// with require(). The app itself is an ES module with top-level await, so it is loaded with import().
// Settings come from the panel's environment variables; a .env file next to this file is used when present.
const path = require('node:path')

try {
  process.loadEnvFile(path.join(__dirname, '.env'))
} catch {
  // No .env file: the environment variables set in the panel are used.
}

import('./src/server.js').catch((error) => {
  console.error(error)
  process.exit(1)
})
