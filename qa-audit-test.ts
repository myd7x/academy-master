
const API_BASE = 'http://localhost:5000/api';
let authCookie = '';

async function login() {
    console.log('--- Logging in ---');
    const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'password' })
    });
    authCookie = res.headers.get('set-cookie') || '';
    if (!authCookie) console.error("FAILED TO GET AUTH COOKIE");
}

async function apiCall(method: string, endpoint: string, body?: any) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Cookie': authCookie
        },
        body: body ? JSON.stringify(body) : undefined
    });
    
    let text = await res.text();
    let json;
    try {
        json = JSON.parse(text);
    } catch(e) {
        json = { raw: text };
    }
    
    return { status: res.status, data: json };
}

async function runTests() {
    await login();
    let createdPlayerId = '';
    let createdSubscriptionId = '';
    let createdPaymentId = '';

    console.log('\n=======================================');
    console.log('TEST 1: Negative Payment Values');
    console.log('=======================================');
    const test1 = await apiCall('POST', '/players', {
        fullName: 'Fuzz Player Negative Payment',
        dateOfBirth: '1990-01-01',
        activity: 'football',
        subscriptionDate: new Date().toISOString(),
        totalSessionsAllowed: 8,
        subscriptionFee: -1000,   // NEGATIVE FEE
        amountPaid: -500,         // NEGATIVE PAYMENT
        paymentMethod: 'cash'
    });
    
    console.log(`Status: ${test1.status}`);
    console.log('Response:', test1.data);
    if (test1.status === 201) {
        console.log("❌ VULNERABILITY FOUND: System allowed negative subscription fee and negative payment!");
        createdPlayerId = test1.data.id;
        // Let's get payments to find the payment ID
        const pRes = await apiCall('GET', '/payments');
        const payment = pRes.data.find((p: any) => p.playerId === createdPlayerId);
        if (payment) createdPaymentId = payment.id;
    } else {
        console.log("✅ Passed: System rejected negative payment values.");
    }

    console.log('\n=======================================');
    console.log('TEST 2: Extreme Overpayment');
    console.log('=======================================');
    // Create a normal player first
    const test2Player = await apiCall('POST', '/players', {
        fullName: 'Fuzz Player Overpayment',
        dateOfBirth: '1990-01-01',
        activity: 'football',
        subscriptionDate: new Date().toISOString(),
        totalSessionsAllowed: 8,
        subscriptionFee: 1000,
        amountPaid: 0,
        paymentMethod: 'cash'
    });
    
    if (test2Player.status === 201) {
        const playerId = test2Player.data.id;
        const pRes = await apiCall('POST', '/payments', {
            playerId: playerId,
            amount: 999999999, // MASSIVE OVERPAYMENT
            paymentMethod: 'cash',
            description: 'Massive Overpayment Test'
        });
        
        console.log(`Status: ${pRes.status}`);
        console.log('Response:', pRes.data);
        if (pRes.status === 201 || pRes.status === 200) {
            console.log("❌ VULNERABILITY FOUND: System allowed overpaying balance by millions!");
        } else {
             console.log("✅ Passed: System rejected massive overpayment.");
        }
    }

    console.log('\n=======================================');
    console.log('TEST 3: Refund Negative Amount (Steal Money)');
    console.log('=======================================');
    if (createdPaymentId) {
        const pRes = await apiCall('POST', `/payments/${createdPaymentId}/refund`, {
            refundAmount: -1000, // NEGATIVE REFUND
            reason: 'Negative Refund Exploit',
            refundMethod: 'cash'
        });
        console.log(`Status: ${pRes.status}`);
        console.log('Response:', pRes.data);
        if (pRes.status === 201 || pRes.status === 200) {
            console.log("❌ VULNERABILITY FOUND: System allowed negative refund amount!");
        } else {
             console.log("✅ Passed: System rejected negative refund.");
        }
    } else {
        console.log("Skipping Test 3 because Test 1 failed to create a payment or didn't run.");
    }

    console.log('\n=======================================');
    console.log('TEST 4: Exceed Total Sessions Allowed');
    console.log('=======================================');
    if (test2Player.status === 201) {
        const playerId = test2Player.data.id;
        const pRes = await apiCall('GET', `/players/${playerId}`);
        const subId = pRes.data.subscriptions?.[0]?.id || pRes.data.activeSubscription?.id || 'none';
        
        // Log 10 sessions when only 8 are allowed
        let successCount = 0;
        for (let i = 0; i < 10; i++) {
             const sRes = await apiCall('POST', '/sessions', {
                playerId: playerId,
                sessionDate: new Date().toISOString(),
                scheduledStartTime: new Date().toISOString(),
                scheduledEndTime: new Date(Date.now() + 3600000).toISOString(),
                attendanceStatus: 'present',
                sessionStatus: 'attended'
             });
             if (sRes.status === 201 || sRes.status === 200) {
                 successCount++;
             }
        }
        console.log(`Successfully logged ${successCount} sessions out of 10 requests.`);
        if (successCount > 8) {
             console.log("❌ VULNERABILITY FOUND: System allowed logging more sessions than allowed by subscription!");
        } else {
             console.log("✅ Passed: System prevented exceeding allowed sessions.");
        }
    }

    console.log('\n=======================================');
    console.log('TEST 5: Concurrent Sessions Race Condition (Double Logging)');
    console.log('=======================================');
    if (test2Player.status === 201) {
        const playerId = test2Player.data.id;
        
        // Fire 5 session creations simultaneously
        const promises = [];
        for (let i = 0; i < 5; i++) {
             promises.push(apiCall('POST', '/sessions', {
                playerId: playerId,
                sessionDate: new Date().toISOString(),
                scheduledStartTime: new Date().toISOString(),
                scheduledEndTime: new Date(Date.now() + 3600000).toISOString(),
                attendanceStatus: 'present',
                sessionStatus: 'attended'
             }));
        }
        
        const results = await Promise.all(promises);
        const successes = results.filter(r => r.status === 201 || r.status === 200).length;
        console.log(`Concurrent requests successful: ${successes} out of 5`);
        
        // Fetch player to see used sessions
        const pRes = await apiCall('GET', `/players/${playerId}`);
        console.log(`Player sessionsUsed reported by API: ${pRes.data.sessionsUsed}`);
        
        if (pRes.data.sessionsUsed !== 8 + successes) {
             console.log("❌ VULNERABILITY FOUND: Possible race condition in sessions used calculation or mismatch!");
        } else {
             console.log("Note: Concurrent behaviour depends on previous tests.");
        }
    }

    console.log('\n=======================================');
    console.log('TEST 6: Inventory Item Negative Stock');
    console.log('=======================================');
    const inv1 = await apiCall('POST', '/inventory', {
        name: 'Fuzz Item',
        quantity: 10,
        minQuantity: 5,
        unitPrice: 100,
        status: 'active'
    });
    
    if (inv1.status === 201) {
        const itemId = inv1.data.id;
        const inv2 = await apiCall('POST', '/inventory/transactions', {
            itemId: itemId,
            type: 'out',
            quantity: 100, // Remove more than exists
            unitCostAtTransaction: 100
        });
        console.log(`Status: ${inv2.status}`);
        console.log('Response:', inv2.data);
        if (inv2.status === 201 || inv2.status === 200) {
             console.log("❌ VULNERABILITY FOUND: System allowed removing more inventory than available (negative stock)!");
        } else {
             console.log("✅ Passed: System rejected negative inventory stock.");
        }
    }

}

runTests().catch(console.error);
