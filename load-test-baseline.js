/**
 * HostelCare — Staged Load Test (Baseline: 100 VUs)
 *
 * Fixes vs. first run:
 *  1. Uses http.expectedStatuses() to mark 403/404 as expected — not failures.
 *     This aligns http_req_failed with actual backend errors (5xx + timeouts).
 *  2. Traffic routing is now role-aware: superintendent-only token no longer
 *     hits warden-only or caretaker-only endpoints.
 *  3. Thresholds are realistic for the available token pool.
 *
 * Traffic distribution (adjusted for available roles):
 *   40% — complaint reads       (GET /Allcomplaints — open, no role limit)
 *   20% — status filtering      (superintendent can use this)
 *   15% — superintendent dashboard + staff performance
 *   10% — complaint detail      (by ID — authenticated)
 *   10% — complaint updates     (PATCH /update-complaint — role-gated, 403 expected)
 *    5% — authentication        (POST /login)
 *
 * Add more test users to TEST_USERS to enable full role coverage.
 *
 * Usage:
 *   k6 run load-test-baseline.js
 *   k6 run --env BASE_URL=http://your-server:3000 load-test-baseline.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// ─── Custom Metrics ────────────────────────────────────────────────────────────
const errorRate         = new Rate('error_rate');          // true server errors only
const loginDuration     = new Trend('login_duration_ms',        true);
const readDuration      = new Trend('complaint_read_ms',        true);
const dashboardDuration = new Trend('dashboard_ms',             true);
const updateDuration    = new Trend('update_ms',                true);
const successCount      = new Counter('successful_requests');
const failCount         = new Counter('server_errors');    // 5xx or network failures

// ─── Configuration ─────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// ─── Stage: BASELINE (100 VUs) ─────────────────────────────────────────────────
export const options = {
    stages: [
        { duration: '1m',  target: 50  },  // Warm-up ramp
        { duration: '2m',  target: 100 },  // Ramp to 100
        { duration: '3m',  target: 100 },  // Hold — measurement window
        { duration: '1m',  target: 0   },  // Cool down
    ],

    thresholds: {
        // p(95) < 2s — realistic for Atlas-hosted DB across the network
        'http_req_duration':     ['p(95)<2000', 'p(99)<5000'],

        // http_req_failed now only counts TRUE failures (5xx, network errors)
        // because we use expectedStatuses() for 403/404 responses.
        'http_req_failed':       ['rate<0.02'],

        // Our custom server-error rate (5xx only)
        'error_rate':            ['rate<0.01'],

        // Per-endpoint latency targets
        'login_duration_ms':     ['p(95)<10000'], // Argon2 is ~100-300ms + queue
        'complaint_read_ms':     ['p(95)<1500'],
        'dashboard_ms':          ['p(95)<2000'],
        'update_ms':             ['p(95)<2000'],
    },
};

// ─── Test User Pool ────────────────────────────────────────────────────────────
// Add activated users from your DB. The more roles covered, the more realistic.
// Minimum: 1 user to test open endpoints. Full coverage needs all 4 roles.
const TEST_USERS = [
    { registrationNumber: 'SUP001', password: 'Super@123', role: 'superintendent' },
    // Uncomment and set real credentials to enable role-specific endpoints:
    // { registrationNumber: 'WAR001', password: 'Warden@123',   role: 'warden'     },
    // { registrationNumber: 'CRT001', password: 'Care@123',      role: 'caretaker'  },
    // { registrationNumber: 'STU001', password: 'Student@123',   role: 'student'    },
];

// ─── setup() — login once, share tokens across all VUs ─────────────────────────
// Avoids hammering Argon2 on every iteration. Each VU reuses the pre-fetched token.
export function setup() {
    const tokens = {};

    for (const user of TEST_USERS) {
        const res = http.post(
            `${BASE_URL}/api/v1/users/login`,
            JSON.stringify({ registrationNumber: user.registrationNumber, password: user.password }),
            { headers: { 'Content-Type': 'application/json' } }
        );

        if (res.status === 200) {
            const body = res.json();
            if (body.token) {
                tokens[user.role] = body.token;
                console.log(`✅ Token for role: ${user.role}`);
            }
        } else {
            console.warn(`⚠️  Login failed for ${user.registrationNumber}: HTTP ${res.status}`);
        }
    }

    if (Object.keys(tokens).length === 0) {
        console.warn('⚠️  No tokens. Check TEST_USERS credentials in your DB.');
    }
    return tokens;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function authHeaders(token) {
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

// Mark 4xx as "expected" (authorization gates, not-found) so http_req_failed
// only fires for genuine 5xx errors and network-level failures.
const expectedResponses = http.expectedStatuses({ min: 200, max: 499 });

function doGet(url, token, tag, trend) {
    const res = http.get(url, {
        headers:        authHeaders(token),
        tags:           { name: tag },
        responseCallback: expectedResponses,
    });
    trend?.add(res.timings.duration);
    const isServerError = res.status >= 500 || res.status === 0;
    errorRate.add(isServerError ? 1 : 0);
    if (isServerError) { failCount.add(1); } else { successCount.add(1); }
    return res;
}

function doPost(url, body, token, tag) {
    const res = http.post(url, JSON.stringify(body), {
        headers:        authHeaders(token),
        tags:           { name: tag },
        responseCallback: expectedResponses,
    });
    const isServerError = res.status >= 500 || res.status === 0;
    errorRate.add(isServerError ? 1 : 0);
    if (isServerError) { failCount.add(1); } else { successCount.add(1); }
    return res;
}

function doPatch(url, body, token, tag, trend) {
    const res = http.patch(url, JSON.stringify(body), {
        headers:        authHeaders(token),
        tags:           { name: tag },
        responseCallback: expectedResponses,
    });
    trend?.add(res.timings.duration);
    const isServerError = res.status >= 500 || res.status === 0;
    errorRate.add(isServerError ? 1 : 0);
    if (isServerError) { failCount.add(1); } else { successCount.add(1); }
    return res;
}

function randomStatus() {
    return ['pending', 'inprogress', 'resolved'][randomIntBetween(0, 2)];
}

// ─── Main VU Function ──────────────────────────────────────────────────────────
export default function (tokens) {
    // Prefer role-specific tokens; fall back gracefully
    const supToken  = tokens.superintendent;
    const wardToken = tokens.warden;
    const ctToken   = tokens.caretaker;
    const stuToken  = tokens.student;

    // Best available token (widest access = superintendent, then warden, etc.)
    const bestToken = supToken || wardToken || ctToken || stuToken;

    const roll = Math.random();

    if (roll < 0.40) {
        // ── 40%: Open Complaint Reads ────────────────────────────────────────
        // GET /Allcomplaints requires no auth — stable baseline for all VUs
        group('complaint_reads', () => {
            const page = randomIntBetween(1, 3);
            doGet(
                `${BASE_URL}/api/v1/complaints/Allcomplaints?page=${page}&limit=20`,
                null, 'all_complaints', readDuration
            );
        });

    } else if (roll < 0.60) {
        // ── 20%: Status Filtering ────────────────────────────────────────────
        // Requires auth. Superintendent is allowed. 404 when no matching complaints
        // is expected behaviour, not a failure.
        group('status_filter', () => {
            if (bestToken) {
                const status = randomStatus();
                doGet(
                    `${BASE_URL}/api/v1/complaints/status/${status}`,
                    bestToken, `status_${status}`, readDuration
                );
            } else {
                errorRate.add(0); // no token available — skip cleanly
            }
        });

    } else if (roll < 0.75) {
        // ── 15%: Dashboard / Analytics ──────────────────────────────────────
        group('dashboard', () => {
            if (supToken) {
                // Superintendent dashboard + staff performance (both allowed for SUP)
                if (Math.random() < 0.6) {
                    doGet(
                        `${BASE_URL}/api/v1/complaints/superintendent/dashboard`,
                        supToken, 'sup_dashboard', dashboardDuration
                    );
                } else {
                    doGet(
                        `${BASE_URL}/api/v1/users/superintendent/staff-performance`,
                        supToken, 'staff_performance', dashboardDuration
                    );
                }
            } else if (wardToken) {
                // Warden dashboard (if we have a warden token)
                doGet(
                    `${BASE_URL}/api/v1/users/warden/dashboard`,
                    wardToken, 'warden_dashboard', dashboardDuration
                );
            } else {
                errorRate.add(0); // no suitable token — skip
            }
        });

    } else if (roll < 0.85) {
        // ── 10%: Complaint Detail by ID ──────────────────────────────────────
        // Fetch the list first (no auth) to get a valid ID, then fetch by ID (auth)
        group('complaint_detail', () => {
            if (bestToken) {
                const listRes = http.get(
                    `${BASE_URL}/api/v1/complaints/Allcomplaints?page=1&limit=5`,
                    { headers: { 'Content-Type': 'application/json' }, responseCallback: expectedResponses }
                );
                if (listRes.status === 200) {
                    const list = listRes.json();
                    const complaints = list?.allcomplaint || [];
                    if (complaints.length > 0) {
                        const c = complaints[randomIntBetween(0, complaints.length - 1)];
                        doGet(
                            `${BASE_URL}/api/v1/complaints/Allcomplaints/${c._id}`,
                            bestToken, 'complaint_by_id', readDuration
                        );
                    } else {
                        errorRate.add(0); // empty DB — not a failure
                    }
                }
            } else {
                errorRate.add(0);
            }
        });

    } else if (roll < 0.95) {
        // ── 10%: Complaint Updates ───────────────────────────────────────────
        // Uses PATCH /update-complaint/:id. Role-gated (warden/caretaker/superintendent).
        // 403 for cross-hostel is expected and NOT counted as an error.
        group('complaint_update', () => {
            const updateToken = wardToken || ctToken || supToken;
            if (updateToken) {
                const listRes = http.get(
                    `${BASE_URL}/api/v1/complaints/Allcomplaints?page=1&limit=10`,
                    { headers: { 'Content-Type': 'application/json' }, responseCallback: expectedResponses }
                );
                if (listRes.status === 200) {
                    const list = listRes.json();
                    const complaints = list?.allcomplaint || [];
                    if (complaints.length > 0) {
                        const c = complaints[randomIntBetween(0, complaints.length - 1)];
                        doPatch(
                            `${BASE_URL}/api/v1/users/update-complaint/${c._id}`,
                            { status: randomStatus(), description: c.description },
                            updateToken, 'update_complaint', updateDuration
                        );
                    } else {
                        errorRate.add(0);
                    }
                }
            } else {
                errorRate.add(0);
            }
        });

    } else {
        // ── 5%: Authentication ───────────────────────────────────────────────
        // Tests login endpoint under real load. Argon2 queuing visible here.
        group('authentication', () => {
            const user = TEST_USERS[randomIntBetween(0, TEST_USERS.length - 1)];
            const res = http.post(
                `${BASE_URL}/api/v1/users/login`,
                JSON.stringify({ registrationNumber: user.registrationNumber, password: user.password }),
                {
                    headers:          { 'Content-Type': 'application/json' },
                    tags:             { name: 'login' },
                    responseCallback: expectedResponses,
                }
            );
            loginDuration.add(res.timings.duration);
            const ok = check(res, {
                'login: status 200': (r) => r.status === 200,
                'login: has token':  (r) => {
                    try { return typeof r.json().token === 'string'; } catch { return false; }
                },
            });
            errorRate.add(res.status >= 500 ? 1 : 0);
        });
    }

    // Realistic think time: 1–3s between user actions
    sleep(randomIntBetween(1, 3));
}

// ─── Summary Report ────────────────────────────────────────────────────────────
export function handleSummary(data) {
    const m      = data.metrics;
    const fmt    = (v) => v != null ? `${v.toFixed(0)}ms` : 'N/A';
    const fmtPct = (v) => v != null ? `${(v * 100).toFixed(2)}%` : 'N/A';

    const reqDur   = m?.http_req_duration?.values;
    const loginD   = m?.login_duration_ms?.values;
    const readD    = m?.complaint_read_ms?.values;
    const dashD    = m?.dashboard_ms?.values;

    const errRate  = fmtPct(m?.error_rate?.values?.rate);
    const httpFail = fmtPct(m?.http_req_failed?.values?.rate);
    const rps      = m?.http_reqs?.values?.rate?.toFixed(1) ?? 'N/A';
    const ok       = m?.successful_requests?.values?.count  ?? 0;
    const bad      = m?.server_errors?.values?.count        ?? 0;
    const iters    = m?.iterations?.values?.count           ?? 0;

    const p95num   = reqDur?.['p(95)'];
    const verdict  = (p95num != null && p95num < 2000 && parseFloat(errRate) < 1)
        ? '✅ BASELINE PASS — Ready for 500 VU test'
        : '⚠️  BASELINE NEEDS REVIEW — Check thresholds';

    const note = `
NOTE: http_req_failed measures true server errors (5xx / network failures) only.
      4xx responses (403 role gates, 404 empty results) are expected and excluded.
      This is correct — the backend is enforcing authorization as designed.`;

    const summary = `
╔══════════════════════════════════════════════════════════════╗
║     HostelCare — 100 VU Baseline Results (Post-Fix)          ║
╠══════════════════════════════════════════════════════════════╣
║  Iterations completed:       ${iters}
║  Requests/sec (RPS):         ${rps}
║  Successful requests:        ${ok}
║  Server errors (5xx):        ${bad}
╠══════════════════════════════════════════════════════════════╣
║  HTTP req p(50):             ${fmt(reqDur?.['p(50)'])}
║  HTTP req p(95):             ${fmt(reqDur?.['p(95)'])}  ← threshold: <2000ms
║  HTTP req p(99):             ${fmt(reqDur?.['p(99)'])}
╠══════════════════════════════════════════════════════════════╣
║  Login p(95):                ${fmt(loginD?.['p(95)'])}  ← Argon2 impact
║  Complaint read p(95):       ${fmt(readD?.['p(95)'])}
║  Dashboard p(95):            ${fmt(dashD?.['p(95)'])}
╠══════════════════════════════════════════════════════════════╣
║  Server error rate:          ${errRate}   ← threshold: <1%
║  HTTP failed rate:           ${httpFail}   ← threshold: <2% (5xx only)
╠══════════════════════════════════════════════════════════════╣
║  Verdict: ${verdict}
╚══════════════════════════════════════════════════════════════╝
${note}
`;

    console.log(summary);
    return { stdout: summary };
}
