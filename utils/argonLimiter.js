const Bottleneck = require('bottleneck');

// Ek waqt mein sirf 10 Argon2 verify calls allowed
const argonLimiter = new Bottleneck({ maxConcurrent: 10 });

module.exports = argonLimiter;