// @ts-nocheck
import WebSocket from 'ws';

async function main() {
    console.log('1. Creating Room...');
    const createRes = await fetch('http://localhost:3000/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'leader-1' })
    });
    const createData = await createRes.json();
    const roomId = createData.room.id;
    console.log('Room created:', roomId);

    console.log('2. Connecting Clients...');
    const ws1 = new WebSocket('ws://127.0.0.1:3000/ws');
    ws1.on('open', () => console.log('Client 1 Connected'));
    ws1.on('error', (e) => console.error('Client 1 Error:', e));
    ws1.on('close', (code, reason) => console.error('Client 1 Closed:', code, reason.toString()));

    const ws2 = new WebSocket('ws://127.0.0.1:3000/ws');
    ws2.on('open', () => console.log('Client 2 Connected'));
    ws2.on('error', (e) => console.error('Client 2 Error:', e));
    ws2.on('close', (code, reason) => console.error('Client 2 Closed:', code, reason.toString()));

    await new Promise(r => setTimeout(r, 1000)); // Wait for connection

    // Helper to wait for ACK
    const waitForAck = (ws, label) => new Promise((resolve, reject) => {
        const handler = (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'ack') {
                console.log(`${label} Joined OK`);
                ws.removeListener('message', handler);
                resolve();
            } else if (msg.type === 'error') {
                console.error(`${label} Join Error:`, msg.payload);
                ws.removeListener('message', handler);
                reject(new Error(msg.payload.msg));
            }
        };
        ws.on('message', handler);
    });

    // Client 1 Join
    console.log('Client 1 JOIN_ROOM...');
    ws1.send(JSON.stringify({
        type: 'JOIN_ROOM',
        payload: { roomId, userId: 'leader-1' }
    }));
    await waitForAck(ws1, 'Client 1');

    // Client 2 Join
    console.log('Client 2 JOIN_ROOM...');
    ws2.send(JSON.stringify({
        type: 'JOIN_ROOM',
        payload: { roomId, userId: 'follower-1' }
    }));
    await waitForAck(ws2, 'Client 2');

    // Listen on Client 2 for Sync
    ws2.on('message', (data) => {
        const event = JSON.parse(data.toString());
        console.log('Client 2 received:', event);
        if (event.type === 'PLAYER_STATE' && event.payload.state === 'playing') {
            console.log('SUCCESS: Sync event received!');
            process.exit(0);
        }
    });

    console.log('3. Client 1 sending PLAYER_STATE...');
    ws1.send(JSON.stringify({
        type: 'PLAYER_STATE',
        payload: {
            state: 'playing',
            time: 10,
            playbackRate: 1
        }
    }));

    // Timeout
    setTimeout(() => {
        console.error('TIMEOUT: Did not receive sync event');
        process.exit(1);
    }, 5000);
}

main();
