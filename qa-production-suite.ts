import { db } from './server/db.js';
import { users } from './shared/schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword } from './server/auth.js';
import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:5000/api';

async function login(username, password) {
    const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    
    if (res.status !== 200) {
        return null;
    }
    const setCookieHeader = res.headers.get('set-cookie');
    if (!setCookieHeader) return null;
    return setCookieHeader.split(',').map(c => c.split(';')[0]).join('; ');
}

async function apiCall(method, endpoint, cookie, body) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookie || ''
        },
        body: body ? JSON.stringify(body) : undefined
    });
    
    let json;
    const text = await res.text();
    try { json = JSON.parse(text); } catch(e) { json = { raw: text }; }
    return { status: res.status, data: json };
}

async function uploadFile(endpoint, cookie, filePath, isMalicious = false) {
    // We create a FormData equivalent manually or use node-fetch FormData if available,
    // but the easiest is using native fetch with FormData since Node 18+ has it.
    const form = new FormData();
    
    let fileBuffer;
    if (isMalicious) {
        // Create an executable-like buffer (MZ header)
        fileBuffer = Buffer.from('4D5A90000300000004000000FFFF', 'hex');
    } else {
        // Create a valid PDF buffer (starts with %PDF)
        fileBuffer = Buffer.from('255044462D312E340A25E2E3CFD3', 'hex');
    }
    
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    form.append('document', blob, 'test-document.pdf');
    
    const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Cookie': cookie || '' },
        body: form
    });
    
    let json;
    const text = await res.text();
    try { json = JSON.parse(text); } catch(e) { json = { raw: text }; }
    return { status: res.status, data: json };
}

async function runProductionSuite() {
    console.log("=== PRODUCTION HARDENING QA SUITE ===\n");
    let allTestsPassed = true;

    // 1. Setup Data
    console.log("Setting up test users...");
    const trainerExists = await db.select().from(users).where(eq(users.username, 'qa_trainer'));
    if (trainerExists.length === 0) {
        const hashed = await hashPassword('password123');
        await db.insert(users).values({ username: 'qa_trainer', password: hashed, role: 'trainer' });
    }

    const adminCookie = await login('admin', 'maged');
    const trainerCookie = await login('qa_trainer', 'password123');
    
    if (!adminCookie || !trainerCookie) {
        console.error("❌ Failed to login users. Ensure server is running and DB has admin user seeded.");
        process.exit(1);
    }
    console.log("✅ Users authenticated.\n");

    // ==============================================================
    // TEST 1: RBAC Enforcement
    // ==============================================================
    console.log("--- TEST 1: RBAC on Financial Dashboard ---");
    
    const resUnauth = await apiCall('GET', '/dashboard/stats', null);
    if (resUnauth.status === 401) {
        console.log("✅ PASS: Unauthenticated user blocked (401).");
    } else {
        console.log(`❌ FAIL: Unauth user got ${resUnauth.status}`);
        allTestsPassed = false;
    }

    const resTrainer = await apiCall('GET', '/dashboard/stats', trainerCookie);
    if (resTrainer.status === 403) {
        console.log("✅ PASS: Trainer user blocked by RBAC (403).");
    } else {
        console.log(`❌ FAIL: Trainer got ${resTrainer.status}`);
        allTestsPassed = false;
    }

    const resAdmin = await apiCall('GET', '/dashboard/stats', adminCookie);
    if (resAdmin.status === 200) {
        console.log("✅ PASS: Admin user permitted by RBAC (200).");
    } else {
        console.log(`❌ FAIL: Admin got ${resAdmin.status}`);
        allTestsPassed = false;
    }

    // ==============================================================
    // TEST 2: File Upload Magic Byte Security
    // ==============================================================
    console.log("\n--- TEST 2: Magic Byte File Security ---");
    // We need a dummy player ID to upload a document to
    const playersRes = await db.query.players.findFirst();
    if (playersRes) {
        const playerId = playersRes.id;
        console.log(`Using Player ID: ${playerId} for upload test.`);

        const maliciousRes = await uploadFile(`/players/${playerId}/documents`, adminCookie, '', true);
        if (maliciousRes.status === 400 && maliciousRes.data.message.includes('Invalid file signature')) {
            console.log("✅ PASS: Malicious file with fake extension correctly blocked by magic byte scanner.");
        } else {
            console.log(`❌ FAIL: Malicious file was not blocked properly. Got ${maliciousRes.status}:`, maliciousRes.data);
            allTestsPassed = false;
        }

        const validRes = await uploadFile(`/players/${playerId}/documents`, adminCookie, '', false);
        if (validRes.status === 201) {
            console.log("✅ PASS: Valid PDF file successfully accepted.");
        } else {
            console.log(`❌ FAIL: Valid file was rejected. Got ${validRes.status}:`, validRes.data);
            allTestsPassed = false;
        }
    } else {
        console.log("⚠️ SKIP: No players found in DB to test upload against.");
    }

    // ==============================================================
    // TEST 3: Rate Limiting
    // ==============================================================
    console.log("\n--- TEST 3: Express Rate Limiter ---");
    console.log("Firing 25 consecutive rapid login attempts...");
    
    let rateLimitTriggered = false;
    for (let i = 0; i < 25; i++) {
        const res = await apiCall('POST', '/login', null, { username: 'admin', password: 'wrong' });
        if (res.status === 429) {
            rateLimitTriggered = true;
            break;
        }
    }
    
    if (rateLimitTriggered) {
        console.log("✅ PASS: Rate limiter correctly triggered HTTP 429 Too Many Requests.");
    } else {
        console.log("❌ FAIL: Rate limiter did not block 25 consecutive requests.");
        allTestsPassed = false;
    }

    console.log("\n==============================================================");
    if (allTestsPassed) {
        console.log("🏆 ALL PRODUCTION SECURITY TESTS PASSED!");
    } else {
        console.log("⚠️ SOME TESTS FAILED.");
    }
    process.exit(0);
}

runProductionSuite().catch(console.error);
