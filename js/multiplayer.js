// multiplayer.js - backend URL set in index.html (window.ASTRARISE_BACKEND_URL) for production
const BACKEND_URL = (typeof window !== 'undefined' && window.ASTRARISE_BACKEND_URL) ? window.ASTRARISE_BACKEND_URL : 'http://localhost:3001';

let socket;
try {
    socket = io(BACKEND_URL, {
        reconnectionAttempts: 5,
        reconnectionDelay: 3000,
        timeout: 5000
    });

    socket.on('connect', () => {
        console.log('Connected to AstraRise Multiplayer Server!');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from Server.');
    });

    socket.on('connect_error', (err) => {
        console.warn('Server offline — running in local mode. Chat/Crash multiplayer disabled.');
    });
} catch (e) {
    console.warn('Socket.io not available, running in offline mode.');
    // Create a dummy socket so the rest of the code doesn't crash
    socket = {
        on: () => { },
        emit: () => { },
        connected: false
    };
}
