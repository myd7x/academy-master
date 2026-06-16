import { db } from './server/db.js';
import { players, payments, subscriptions, sessions } from './shared/schema.js';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

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
    // Handle multiple cookies if separated by comma
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
    console.log("=== BUG VERIFICATION SCRIPT ===\n");
    let cookie = '';
    try {
        cookie = await login();
        console.log("Login successful. Cookie acquired.\n");
    } catch(e) {
        console.error("Login failed:", e);
        process.exit(1);
    }

    // ==============================================================
    // BUG-01: Negative Payments & Financial Manipulation
    // ==============================================================
    console.log("--- VERIFYING BUG-01: Negative Payments ---");
    const payload1 = {
        fullName: 'Test Negative Payment',
        dateOfBirth: '1990-01-01',
        activity: 'football',
        subscriptionDate: new Date().toISOString(),
        totalSessionsAllowed: 8,
        subscriptionFee: -500, // NEGATIVE
        amountPaid: -200,      // NEGATIVE
        paymentMethod: 'cash'
    };
    
    console.log("Payload:", JSON.stringify(payload1));
    
    let beforePlayers = await db.select().from(players);
    console.log(`DB State Before: Players Count = ${beforePlayers.length}`);

    const res1 = await apiCall('POST', '/players', cookie, payload1);
    console.log(`HTTP Response: ${res1.status}`);
    console.log(JSON.stringify(res1.data, null, 2));

    let createdPlayerId = res1.status === 201 ? res1.data.id : null;
    if (createdPlayerId) {
        const afterPayments = await db.select().from(payments).where(eq(payments.playerId, createdPlayerId));
        console.log(`DB State After (Payments for this player):`);
        console.log(JSON.stringify(afterPayments, null, 2));
    }

    // ==============================================================
    // BUG-02: Overpayment Sinks Money
    // ==============================================================
    console.log("\n--- VERIFYING BUG-02: Overpayment Sinks Money ---");
    let createdPlayerId2 = null;
    const payloadPlayer2 = {
        fullName: 'Test Overpayment',
        dateOfBirth: '1990-01-01',
        activity: 'football',
        subscriptionDate: new Date().toISOString(),
        totalSessionsAllowed: 8,
        subscriptionFee: 1000, 
        amountPaid: 0,
        paymentMethod: 'cash'
    };
    const resPlayer2 = await apiCall('POST', '/players', cookie, payloadPlayer2);
    if (resPlayer2.status === 201) {
        createdPlayerId2 = resPlayer2.data.id;
        
        const payload2 = {
            subscriptionFee: 1000,
            amountPaid: 2000, // OVERPAYMENT (1000 excess)
            paymentMethod: 'cash',
            description: 'Massive Overpayment Test'
        };
        console.log("Payload:", JSON.stringify(payload2));

        const res2 = await apiCall('POST', `/players/${createdPlayerId2}/renew`, cookie, payload2);
        console.log(`HTTP Response: ${res2.status}`);
        console.log(JSON.stringify(res2.data, null, 2));

        const afterPayments2 = await db.select().from(payments).where(eq(payments.playerId, createdPlayerId2)).orderBy(desc(payments.createdAt));
        console.log(`DB State After (Payments for this player):`);
        console.log(JSON.stringify(afterPayments2, null, 2));
    }

    // ==============================================================
    // BUG-03: Negative Refund Loophole
    // ==============================================================
    console.log("\n--- VERIFYING BUG-03: Negative Refund ---");
    // Find a payment to refund
    const existingPayments = await db.select().from(payments);
    if (existingPayments.length > 0) {
        const paymentToRefund = existingPayments[0];
        console.log(`Attempting to refund payment ID: ${paymentToRefund.id}`);
        
        const payload3 = {
            refundAmount: -100, // NEGATIVE REFUND
            reason: 'Negative Refund Exploit',
            refundMethod: 'cash'
        };
        console.log("Payload:", JSON.stringify(payload3));

        const res3 = await apiCall('POST', `/payments/${paymentToRefund.id}/refund`, cookie, payload3);
        console.log(`HTTP Response: ${res3.status}`);
        console.log(JSON.stringify(res3.data, null, 2));
    }

    // ==============================================================
    // BUG-04: Exceeding Maximum Session Limits
    // ==============================================================
    console.log("\n--- VERIFYING BUG-04: Exceed Maximum Sessions ---");
    if (createdPlayerId2) {
        const payload4 = {
            playerId: createdPlayerId2,
            sessionDate: new Date().toISOString(),
            scheduledStartTime: new Date().toISOString(),
            scheduledEndTime: new Date(Date.now() + 3600000).toISOString(),
            attendanceStatus: 'present',
            sessionStatus: 'attended'
        };
        
        // Let's fire 10 sessions to exceed the limit of 8
        console.log("Payload (sending 10 times):", JSON.stringify(payload4));
        
        let successCount = 0;
        for (let i = 0; i < 10; i++) {
             const sRes = await apiCall('POST', '/sessions', cookie, payload4);
             if (sRes.status === 201 || sRes.status === 200) successCount++;
        }
        
        console.log(`HTTP Responses: Successfully created ${successCount} sessions out of 10 requests.`);
        
        const finalPlayerState = await apiCall('GET', `/players/${createdPlayerId2}`, cookie);
        console.log(`DB State After (sessionsUsed from API):`, finalPlayerState.data.sessionsUsed);
        
        const sub = await db.select().from(subscriptions).where(eq(subscriptions.playerId, createdPlayerId2));
        console.log(`DB State After (subscriptions table):`);
        console.log(JSON.stringify(sub, null, 2));
    }

    process.exit(0);
}

runVerification().catch(console.error);
