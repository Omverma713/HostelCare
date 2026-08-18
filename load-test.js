import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// ─── Custom Metrics ───────────────────────────────────────────────────────────
const errorRate       = new Rate('error_rate');
const loginDuration   = new Trend('login_duration_ms', true);
const successCount    = new Counter('successful_logins');
const failCount       = new Counter('failed_logins');

// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const LOGIN_URL = `${BASE_URL}/api/v1/users/login`;

// ─── Gradual Ramp-Up: 100 → 500 → 1K → 2K → 5K ──────────────────────────────
export const options = {
  stages: [
    { duration: '1m',  target: 100 },  // Warm up
    { duration: '3m',  target: 100 },  // Hold 100
    { duration: '2m',  target: 150 },  // Ramp to 150
    { duration: '3m',  target: 150 },  // Hold 150
    { duration: '2m',  target: 250 },  // Ramp to 250
    { duration: '3m',  target: 250 },  // Hold 250 — peak
    { duration: '2m',  target: 0   },  // Cool down
  ],

  thresholds: {
    'http_req_duration': ['p(50)<2000', 'p(95)<5000', 'p(99)<8000'],
    'http_req_failed':   ['rate<0.05'],
    'error_rate':        ['rate<0.05'],
    'login_duration_ms': ['p(95)<5000'],
  },
};

// ─── Test Data ────────────────────────────────────────────────────────────────
// ✅ JWT Payload: { id, registrationNumber, role, hostel }
// Replace with real test credentials seeded in your DB
const testUsers = [
  { registrationNumber: 'SUP001', password: 'Super@123' },
  // Add more users from your DB if you have them
];

// ─── Main Test Function ───────────────────────────────────────────────────────
export default function () {
  // Pick a random test user
  const user = testUsers[randomIntBetween(0, testUsers.length - 1)];

  const payload = JSON.stringify({
    registrationNumber: user.registrationNumber,   // ✅ matches your login body
    password:           user.password,
  });

  const headers = {
    'Content-Type': 'application/json',
  };

  // ── Make Login Request ────────────────────────────────────────────────────
  const res = http.post(LOGIN_URL, payload, {
    headers,
    tags: { name: 'Login' },
  });

  // ── Record duration ───────────────────────────────────────────────────────
  loginDuration.add(res.timings.duration);

  // ── Checks ────────────────────────────────────────────────────────────────
  const success = check(res, {
    '✅ Status is 200':          (r) => r.status === 200,
    '✅ success: true':          (r) => {
      try { return JSON.parse(r.body).success === true; }
      catch { return false; }
    },
    '✅ token exists in body':   (r) => {
      try {
        const body = JSON.parse(r.body);
        // HostelCare response: { success: true, message: '...', token: 'eyJ...' }
        return typeof body.token === 'string' && body.token.startsWith('eyJ');
      } catch {
        return false;
      }
    },
    '⏱️  Response < 5s':        (r) => r.timings.duration < 5000,
    '❌ Not a server error':     (r) => r.status !== 500,
  });

  if (success) {
    successCount.add(1);
    errorRate.add(0);   // ✅ Fix: Rate needs 0 for success too
  } else {
    failCount.add(1);
    errorRate.add(1);   // 1 = failure
    if (failCount.value <= 5) {
      console.error(`❌ Login failed | Status: ${res.status} | Body: ${res.body?.substring(0, 100)}`);
    }
  }

  // ── Think Time ────────────────────────────────────────────────────────────
  // Real users don't spam login — they wait between attempts
  // This makes it realistic: ~1 login per user per session
  sleep(randomIntBetween(3, 8));
}

// ─── Summary Hook (printed at end) ───────────────────────────────────────────
export function handleSummary(data) {
  const dur    = data.metrics?.login_duration_ms?.values;
  const p50    = dur?.['p(50)']?.toFixed(0)  ?? 'N/A';
  const p95    = dur?.['p(95)']?.toFixed(0)  ?? 'N/A';
  const p99    = dur?.['p(99)']?.toFixed(0)  ?? 'N/A';
  const errR   = ((data.metrics?.error_rate?.values?.rate ?? 0) * 100).toFixed(2);
  const ok     = data.metrics?.successful_logins?.values?.count ?? 0;
  const fail   = data.metrics?.failed_logins?.values?.count    ?? 0;
  const total  = ok + fail;
  const okPct  = total ? ((ok / total) * 100).toFixed(1) : '0';

  const p95Num = parseFloat(p95);
  const verdict = (p95Num < 5000 && parseFloat(errR) < 5)
    ? '✅ PASS'
    : '❌ FAIL — Argon2 fix needed';

  const summary = `
╔══════════════════════════════════════════════════════════╗
║         HostelCare Login Load Test — Results             ║
╠══════════════════════════════════════════════════════════╣
║  Login Duration (p50):   ${p50}ms
║  Login Duration (p95):   ${p95}ms     ← Argon2 impact
║  Login Duration (p99):   ${p99}ms
╠══════════════════════════════════════════════════════════╣
║  Successful Logins:      ${ok} / ${total} (${okPct}%)
║  Failed Logins:          ${fail}
║  Error Rate:             ${errR}%
╠══════════════════════════════════════════════════════════╣
║  Verdict: ${verdict}
╚══════════════════════════════════════════════════════════╝
`;

  console.log(summary);
  return { stdout: summary };
}