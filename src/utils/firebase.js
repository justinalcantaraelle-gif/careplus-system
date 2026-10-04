import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, set, onValue } from 'firebase/database';

// Primary Firebase Configuration with Environment Overrides
const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyB4j4K7ja5lPVgrpLT98_8or_NSbwRxTW8",
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "careplus-system.firebaseapp.com",
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "careplus-system",
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "careplus-system.firebasestorage.app",
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "188033705243",
    appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:188033705243:web:ecf51182ff751870f75fbe",
    databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL || "https://careplus-system-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Realtime Database
let rtdb = null;
try {
    rtdb = getDatabase(app);
} catch (e) {
    // If asia-southeast1 fails or is not enabled, try standard default domain
    try {
        rtdb = getDatabase(app, "https://careplus-system-default-rtdb.firebaseio.com");
    } catch (e2) {
        console.warn('[Firebase RTDB] Database init notice:', e2.message);
    }
}

export const getFirebaseDb = () => rtdb;

/**
 * Broadcasts a live real-time sync event to all connected devices across the world
 * @param {string} event - Event name (e.g. 'db_updated', 'consultation_added')
 * @param {object} payload - Optional extra payload
 */
export const broadcastFirebaseSync = async (event = 'db_updated', payload = {}) => {
    if (!rtdb) return;
    try {
        const syncRef = ref(rtdb, 'careplus_sync/latest');
        await set(syncRef, {
            event,
            ...payload,
            timestamp: Date.now()
        });
    } catch (err) {
        console.warn('[Firebase Realtime Broadcast Warning]:', err.message);
    }
};

/**
 * Subscribes to live database updates from Firebase Realtime Database
 * @param {Function} onSyncCallback - Called whenever any device updates the system
 */
let isListening = false;
export const subscribeToFirebaseRealtime = (onSyncCallback) => {
    if (!rtdb || isListening) return;
    try {
        const syncRef = ref(rtdb, 'careplus_sync/latest');
        isListening = true;
        onValue(syncRef, (snapshot) => {
            const data = snapshot.val();
            if (data && onSyncCallback) {
                onSyncCallback(data);
            }
        }, (err) => {
            console.warn('[Firebase Realtime Listener Warning]:', err.message);
        });
    } catch (err) {
        console.warn('[Firebase Realtime Subscription Error]:', err.message);
    }
};

export default app;
