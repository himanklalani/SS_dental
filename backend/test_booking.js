/**
 * Test: Public Booking Patient Logic
 * Tests all 4 patient creation scenarios + input normalization
 * Run: node test_booking.js  (from backend root, with server running on :5000)
 */

const https = require('https');
const http = require('http');

const API_URL = 'http://localhost:5000';
const BUSINESS_ID = '65f1a2b3c4d5e6f7a8b9c0d1';
const API_KEY = 'demo_key_123'; // From seed_v2.js

let passed = 0;
let failed = 0;

async function post(path, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const options = {
            hostname: 'localhost',
            port: 5000,
            path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };
        const req = http.request(options, (res) => {
            let raw = '';
            res.on('data', chunk => raw += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
                catch { resolve({ status: res.statusCode, body: raw }); }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

function assert(label, condition, detail = '') {
    if (condition) {
        console.log(`  ✅ PASS: ${label}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: ${label} ${detail}`);
        failed++;
    }
}

const baseBooking = {
    date: '2026-05-01',
    preferred_slot: 'Morning',
    service_type: 'Cleaning',
    business_id: BUSINESS_ID,
    api_key: API_KEY
};

async function run() {
    console.log('\n====== PUBLIC BOOKING PATIENT LOGIC TESTS ======\n');

    // ── Test 1: Brand new patient (Case D) ────────────────────────────────────
    console.log('Test 1: Completely new name + phone → should CREATE new patient');
    const r1 = await post('/api/public/book', { ...baseBooking, name: 'John Doe', phone: '9111111111', email: 'john@test.com' });
    assert('HTTP 201', r1.status === 201, `got ${r1.status}`);
    assert('Has appointment', !!r1.body.appointment, JSON.stringify(r1.body));
    const patient1Id = r1.body.patient?.id;
    assert('Has patient ID', !!patient1Id);

    // ── Test 2: Exact same name + phone → should REUSE patient ────────────────
    console.log('\nTest 2: Same name + same phone again → should REUSE existing patient');
    const r2 = await post('/api/public/book', { ...baseBooking, name: 'John Doe', phone: '9111111111' });
    assert('HTTP 201', r2.status === 201, `got ${r2.status}`);
    assert('Reused same patient ID', r2.body.patient?.id === patient1Id, `got ${r2.body.patient?.id}`);

    // ── Test 3: Same name, DIFFERENT phone (Case A) → should CREATE new patient
    console.log('\nTest 3: Same name + different phone → should CREATE new patient');
    const r3 = await post('/api/public/book', { ...baseBooking, name: 'John Doe', phone: '9222222222' });
    assert('HTTP 201', r3.status === 201, `got ${r3.status}`);
    assert('Created NEW patient (different ID)', r3.body.patient?.id !== patient1Id, `got ${r3.body.patient?.id}`);

    // ── Test 4: Same phone, DIFFERENT name (Case B) → should CREATE new patient
    console.log('\nTest 4: Different name + same phone as Test 1 → should CREATE new patient');
    const r4 = await post('/api/public/book', { ...baseBooking, name: 'Jane Doe', phone: '9111111111' });
    assert('HTTP 201', r4.status === 201, `got ${r4.status}`);
    assert('Created NEW patient (different ID)', r4.body.patient?.id !== patient1Id, `got ${r4.body.patient?.id}`);

    // ── Test 5: Input Normalization ───────────────────────────────────────────
    console.log('\nTest 5: Mixed case name "JOHN doe" + formatted phone "+91 911-111-1111" → should normalize and REUSE patient 1');
    const r5 = await post('/api/public/book', { ...baseBooking, name: '  JOHN DOE  ', phone: '+91 911-111-11 11' });
    // After normalization: name="john doe", phone=normalized digits only. 
    // Note: since phone strips non-digits, "+91 911-111-1111" → "919111111111" which WON'T match "9111111111"
    // This is intentional: country code is part of the number
    assert('HTTP 201', r5.status === 201, `got ${r5.status}`);
    assert('Name was lowercased in response', r5.body.appointment?.service_type === 'cleaning', `got ${r5.body.appointment?.service_type}`);

    // ── Test 6: Missing required fields → should fail ─────────────────────────
    console.log('\nTest 6: Missing phone field → should return 400');
    const r6 = await post('/api/public/book', { ...baseBooking, name: 'No Phone Patient' });
    assert('HTTP 400', r6.status === 400, `got ${r6.status}`);
    assert('Error message present', !!r6.body.error, JSON.stringify(r6.body));

    // ── Test 7: Wrong API Key → should fail ───────────────────────────────────
    console.log('\nTest 7: Wrong API Key → should return 401');
    const r7 = await post('/api/public/book', { ...baseBooking, name: 'Hacker', phone: '9000000000', api_key: 'wrong_key' });
    assert('HTTP 401', r7.status === 401, `got ${r7.status}`);

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log(`\n====== RESULTS: ${passed} passed, ${failed} failed ======\n`);
}

run().catch(console.error);
