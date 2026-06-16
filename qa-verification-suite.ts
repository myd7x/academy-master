import { db } from './server/db.js';
import { players, payments, subscriptions, sessions } from './shared/schema.js';
import { eq, desc } from 'drizzle-orm';

const API_BASE = 'http://localhost:5000/api';

async function login() {
    const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'maged' })
    });
    
    const setCookieHeader = res.headers.get('set-cookie');
    if (!setCookieHeader) {
        throw new Error("No set-cookie header received upon login");
    }
    const cookies = setCookieHeader.split(',').map(c => c.split(';')[0]);
    return cookies.join('; ');
}

async function apiCall(method: string, endpoint: string, cookie: string, body?: any) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookie
        },
        body: body ? JSON.stringify(body) : undefined
    });
    
    let json;
    const text = await res.text();
    try {
        json = JSON.parse(text);
    } catch(e) {
        json = { raw: text };
    }
    
    return { status: res.status, data: json };
}

async function runVerification() {
    console.log("=== FINAL QA VERIFICATION SUITE ===\n");
    let cookie = '';
    try {
        cookie = await login();
        console.log("Login successful. Cookie acquired.\n");
    } catch(e) {
        console.error("Login failed:", e);
        process.exit(1);
    }

    let allTestsPassed = true;

    // ==============================================================
    // TEST 1: Negative Payments Validation
    // ==============================================================
    console.log("--- TEST 1: Negative Payments ---");
    const payload1 = {
        fullName: 'Test Patched Negative Payment',
        dateOfBirth: '1990-01-01',
        activity: 'football',
        subscriptionDate: new Date().toISOString(),
        totalSessionsAllowed: 8,
        subscriptionFee: -500,
        amountPaid: -200,
        paymentMethod: 'cash'
    };
    
    const res1 = await apiCall('POST', '/players', cookie, payload1);
    console.log(`HTTP Response: ${res1.status}`);
    console.log(`Body:`, res1.data);
    if (res1.status === 400) {
        console.log("✅ PASS: System successfully blocked negative payment creation.");
    } else {
        console.log("❌ FAIL: System allowed negative payment.");
        allTestsPassed = false;
    }

    // ==============================================================
    // TEST 2: Overpayment Loss Validation (Option A Reject)
    // ==============================================================
    console.log("\n--- TEST 2: Overpayment Ledger Loss ---");
    // First, create a valid player
    const payloadValidPlayer = {
        fullName: 'Test Valid Player For Overpayment',
        dateOfBirth: '1990-01-01',
        activity: 'football',
        subscriptionDate: new Date().toISOString(),
        totalSessionsAllowed: 8,
        subscriptionFee: 1000, 
        amountPaid: 0,
        paymentMethod: 'cash'
    };
    const resValidPlayer = await apiCall('POST', '/players', cookie, payloadValidPlayer);
    let createdPlayerId = null;

    if (resValidPlayer.status === 201) {
        createdPlayerId = resValidPlayer.data.id;
        const payloadOverpayment = {
            subscriptionFee: 1000,
            amountPaid: 2000,
            paymentMethod: 'cash',
            description: 'Massive Overpayment Test'
        };

        const res2 = await apiCall('POST', `/players/${createdPlayerId}/renew`, cookie, payloadOverpayment);
        console.log(`HTTP Response: ${res2.status}`);
        console.log(`Body:`, res2.data);
        if (res2.status === 400) {
            console.log("✅ PASS: System successfully blocked overpayment via Renewal.");
        } else {
            console.log("❌ FAIL: System allowed overpayment via Renewal.");
            allTestsPassed = false;
        }

        // Test additional payment overpayment
        const payloadAddPayment = {
            playerId: createdPlayerId,
            amountPaid: 2000,
            paymentMethod: 'cash',
            description: 'Additional Payment Overpayment Test'
        };
        const res3 = await apiCall('POST', `/payments/additional`, cookie, payloadAddPayment);
        console.log(`Additional Payment HTTP Response: ${res3.status}`);
        console.log(`Body:`, res3.data);
        if (res3.status === 400) {
            console.log("✅ PASS: System successfully blocked overpayment via Additional Payment.");
        } else {
            console.log("❌ FAIL: System allowed overpayment via Additional Payment.");
            allTestsPassed = false;
        }
        
        // Test negative additional payment
        const payloadNegAddPayment = {
            playerId: createdPlayerId,
            amountPaid: -500,
            paymentMethod: 'cash',
            description: 'Additional Payment Negative Test'
        };
        const res4 = await apiCall('POST', `/payments/additional`, cookie, payloadNegAddPayment);
        if (res4.status === 400) {
            console.log("✅ PASS: System successfully blocked negative additional payment.");
        } else {
            console.log("❌ FAIL: System allowed negative additional payment.");
            allTestsPassed = false;
        }
    } else {
        console.log("❌ FAIL: Could not create base player for test 2.");
        allTestsPassed = false;
    }

    // ==============================================================
    // TEST 3: Session Concurrency Race Condition
    // ==============================================================
    console.log("\n--- TEST 3: Attendance Race Condition (50 Concurrent Requests) ---");
    if (createdPlayerId) {
        const payloadSession = {
            playerId: createdPlayerId,
            sessionDate: new Date().toISOString(),
            scheduledStartTime: new Date().toISOString(),
            scheduledEndTime: new Date(Date.now() + 3600000).toISOString(),
            attendanceStatus: 'present',
            sessionStatus: 'attended'
        };
        
        console.log("Firing 50 concurrent session requests...");
        const promises = [];
        for (let i = 0; i < 50; i++) {
             promises.push(apiCall('POST', '/sessions', cookie, payloadSession));
        }
        
        const responses = await Promise.all(promises);
        
        const successCount = responses.filter(r => r.status === 201 || r.status === 200).length;
        const failCount = responses.filter(r => r.status === 400 || r.status === 500).length;
        
        console.log(`Successful Session Creations: ${successCount}`);
        console.log(`Failed/Rejected Session Creations: ${failCount}`);
        
        const finalPlayerState = await apiCall('GET', `/players/${createdPlayerId}`, cookie);
        console.log(`sessionsUsed from API:`, finalPlayerState.data.sessionsUsed);
        
        const subs = await db.select().from(subscriptions).where(eq(subscriptions.playerId, createdPlayerId));
        // We might have multiple active subscriptions because of previous tests, let's sum or find the active one
        let totalSessionsUsed = 0;
        let totalSessionsAllowed = 0;
        for (const sub of subs) {
            totalSessionsUsed += sub.sessionsUsed;
            totalSessionsAllowed += sub.sessionsAllowed;
        }

        console.log(`DB Subscriptions State - Allowed: ${totalSessionsAllowed}, Used: ${totalSessionsUsed}`);

        const createdSessions = await db.select().from(sessions).where(eq(sessions.playerId, createdPlayerId));
        console.log(`Total sessions actually inserted in DB: ${createdSessions.length}`);

        if (successCount === 8 && totalSessionsUsed === 8 && createdSessions.length === 8) {
             console.log("✅ PASS: Atomic transaction successfully prevented race condition. Exactly 8 sessions logged.");
        } else {
             console.log("❌ FAIL: Race condition allowed extra sessions or caused a mismatch.");
             allTestsPassed = false;
        }
    }

    console.log("\n==============================================================");
    if (allTestsPassed) {
        console.log("🏆 ALL TESTS PASSED! The application is fully verified.");
    } else {
        console.log("⚠️ SOME TESTS FAILED.");
    }
    process.exit(0);
}

runVerification().catch(console.error);
