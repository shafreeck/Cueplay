// @ts-nocheck

async function main() {
    const deviceId = 'test-device-1';

    console.log('1. Granting Lease...');
    const grantRes = await fetch('http://localhost:3000/leases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId })
    });
    const grantData = await grantRes.json();
    const leaseId = grantData.lease.id;
    console.log('Lease granted:', leaseId, grantData.lease.expiresAt);

    await new Promise(r => setTimeout(r, 1000));

    console.log('2. Renewing Lease...');
    const renewRes = await fetch(`http://localhost:3000/leases/${leaseId}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });
    const renewData = await renewRes.json();
    console.log('Lease renewed. New expiry:', renewData.lease.expiresAt);

    if (renewData.lease.expiresAt <= grantData.lease.expiresAt) {
        console.error('FAILURE: Expiry not extended');
        process.exit(1);
    }

    console.log('3. Revoking Lease...');
    const revokeRes = await fetch(`http://localhost:3000/leases/${leaseId}`, {
        method: 'DELETE'
    });
    const revokeData = await revokeRes.json();
    console.log('Lease status:', revokeData.lease.status);

    if (revokeData.lease.status !== 'revoked') {
        console.error('FAILURE: Lease not revoked');
        process.exit(1);
    }

    console.log('4. Attempting to renew revoked lease...');
    const failRes = await fetch(`http://localhost:3000/leases/${leaseId}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });

    if (failRes.status === 400) {
        console.log('SUCCESS: Renew rejected as expected');
    } else {
        console.error('FAILURE: Renew should have failed', await failRes.text());
        process.exit(1);
    }
}

main();
