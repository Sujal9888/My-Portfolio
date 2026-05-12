// Service Worker for Todo App - Handles background notifications
const CACHE_NAME = 'todo-app-v1';

// Install event
self.addEventListener('install', (event) => {
    console.log('Service Worker installed');
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
    console.log('Service Worker activated');
    event.waitUntil(clients.claim());
});

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data.type === 'SCHEDULE_NOTIFICATION') {
        const { text, time, id } = event.data;
        scheduleNotification(text, time, id);
    }
});

// Schedule a notification
function scheduleNotification(text, time, id) {
    const now = Date.now();
    const scheduledTime = new Date(time).getTime();
    const delay = scheduledTime - now;

    if (delay > 0) {
        setTimeout(() => {
            showNotification(text, id);
        }, delay);
    }
}

// Show notification
function showNotification(text, id) {
    const options = {
        body: text,
        icon: 'https://cdn-icons-png.flaticon.com/512/2965/2965358.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/2965/2965358.png',
        vibrate: [200, 100, 200, 100, 200],
        tag: `todo-reminder-${id}`,
        requireInteraction: true,
        actions: [
            { action: 'dismiss', title: 'Dismiss' },
            { action: 'view', title: 'View Task' }
        ],
        data: { id, text, timestamp: Date.now() }
    };

    self.registration.showNotification('⏰ Todo Reminder', options);
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'view') {
        // Open or focus the app
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then((clientList) => {
                    // If app is already open, focus it
                    for (let client of clientList) {
                        if (client.url.includes('todo.html') && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    // Otherwise open a new window
                    if (clients.openWindow) {
                        return clients.openWindow('/todo.html');
                    }
                })
        );
    }
});

// Periodic check for reminders (runs when service worker is active)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'check-reminders') {
        event.waitUntil(checkReminders());
    }
});

// --- Background sync for pending contact messages ---
const CONTACT_DB = 'contact-sync-db';
const CONTACT_STORE = 'pendingContacts';

function openContactDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(CONTACT_DB, 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(CONTACT_STORE)) {
                db.createObjectStore(CONTACT_STORE, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function getAllPendingContacts() {
    const db = await openContactDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CONTACT_STORE, 'readonly');
        const store = tx.objectStore(CONTACT_STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

async function removePendingContact(id) {
    const db = await openContactDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CONTACT_STORE, 'readwrite');
        const store = tx.objectStore(CONTACT_STORE);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// Handle sync events (Background Sync API)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-contacts') {
        event.waitUntil(processPendingContacts());
    }
});

async function processPendingContacts() {
    try {
        const pending = await getAllPendingContacts();
        if (!pending.length) return;
        for (const item of pending) {
            try {
                const resp = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: item.name, email: item.email, message: item.message })
                });
                if (resp && resp.ok) {
                    await removePendingContact(item.id);
                }
            } catch (err) {
                // keep item for next sync attempt
                console.warn('Sync: failed to send contact', err);
            }
        }
    } catch (err) {
        console.error('Error processing pending contacts', err);
    }
}

async function checkReminders() {
    // This would check stored reminders and show notifications
    console.log('Checking for due reminders...');
}
