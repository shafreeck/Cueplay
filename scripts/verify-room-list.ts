// @ts-nocheck

async function main() {
    const userId = 'user-' + Math.random().toString(36).substring(7);
    console.log('Testing with userId:', userId);

    console.log('1. Listing rooms (should be empty)...');
    const res1 = await fetch(`http://localhost:3000/rooms?userId=${userId}`);
    const data1 = await res1.json();
    console.log('Rooms:', data1.rooms.length);
    if (data1.rooms.length !== 0) {
        console.error('FAILURE: Should be 0 rooms');
        process.exit(1);
    }

    console.log('2. Creating Room 1...');
    await fetch('http://localhost:3000/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
    });

    console.log('3. Creating Room 2...');
    await fetch('http://localhost:3000/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
    });

    console.log('4. Listing rooms (should be 2)...');
    const res2 = await fetch(`http://localhost:3000/rooms?userId=${userId}`);
    const data2 = await res2.json();
    console.log('Rooms:', data2.rooms.length);

    if (data2.rooms.length === 2) {
        console.log('SUCCESS: Rooms listed correctly');
    } else {
        console.error('FAILURE: Expected 2 rooms, got', data2.rooms.length);
        process.exit(1);
    }
}

main();
