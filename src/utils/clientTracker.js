// In-memory client tracking module to associate client IP with registration numbers
// Enables older APK clients (like v1.2.2.0) that don't send auth headers during version checks
// to be accurately recognized for pilot release rollouts.

const ipToUserMap = new Map();
const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours window

function normalizeIp(ip) {
  if (!ip) return "";
  let clean = String(ip).trim();
  // Handle IPv4 mapped in IPv6 (e.g. ::ffff:192.168.1.1)
  if (clean.startsWith("::ffff:")) {
    clean = clean.substring(7);
  }
  return clean;
}

function recordClientIdentity(ip, registrationNumber) {
  const cleanIp = normalizeIp(ip);
  if (!cleanIp || !registrationNumber) return;
  
  ipToUserMap.set(cleanIp, {
    reg: String(registrationNumber).trim().toUpperCase(),
    timestamp: Date.now(),
  });
}

function getClientIdentityByIp(ip) {
  const cleanIp = normalizeIp(ip);
  if (!cleanIp) return null;
  
  const entry = ipToUserMap.get(cleanIp);
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > MAX_AGE_MS) {
    ipToUserMap.delete(cleanIp);
    return null;
  }
  
  return entry.reg;
}

module.exports = {
  recordClientIdentity,
  getClientIdentityByIp,
};
