// Service Worker for StopitHarassment PWA
const CACHE_NAME = 'stopit-harassment-v1.0.0';
const OFFLINE_URL = '/offline.html';

// Files to cache for offline functionality
const STATIC_CACHE_FILES = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/styles.css',
    '/js/app.js',
    '/js/firebase-config.js',
    '/js/bluetooth.js',
    '/js/audio-recorder.js',
    '/js/location-tracker.js',
    '/js/storage.js',
    '/js/emergency.js',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching static files...');
                return cache.addAll(STATIC_CACHE_FILES);
            })
            .catch(error => {
                console.error('Cache installation failed:', error);
                // Continue installation even if some files fail to cache
                return Promise.resolve();
            })
            .then(() => {
                console.log('Service Worker installed successfully');
                self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', event => {
    // Handle navigation requests
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return caches.match('/');
                })
        );
        return;
    }

    // Handle other requests
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }

                return fetch(event.request)
                    .then(response => {
                        // Don't cache non-successful responses
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone the response
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // Return offline page for HTML requests
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/');
                        }
                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});

// Background sync for emergency alerts
self.addEventListener('sync', event => {
    console.log('Background sync triggered:', event.tag);
    
    if (event.tag === 'emergency-sync') {
        event.waitUntil(syncEmergencyData());
    } else if (event.tag === 'contact-sync') {
        event.waitUntil(syncContactData());
    }
});

// Sync emergency data when connection is restored
async function syncEmergencyData() {
    try {
        console.log('Syncing emergency data...');
        
        // Get pending emergency data from IndexedDB
        const emergencyData = await getPendingEmergencyData();
        
        if (emergencyData.length > 0) {
            for (const data of emergencyData) {
                try {
                    // Send to Firebase and external services
                    await sendEmergencyAlert(data);
                    await markEmergencyDataAsSynced(data.id);
                    console.log('Emergency data synced:', data.id);
                } catch (error) {
                    console.error('Failed to sync emergency data:', error);
                }
            }
        }
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

// Sync contact data
async function syncContactData() {
    try {
        console.log('Syncing contact data...');
        // Implementation for syncing contact changes
    } catch (error) {
        console.error('Contact sync failed:', error);
    }
}

// Helper functions for IndexedDB operations
async function getPendingEmergencyData() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('StopitHarassmentDB', 1);
        
        request.onerror = () => reject(request.error);
        
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['emergencies'], 'readonly');
            const store = transaction.objectStore('emergencies');
            const index = store.index('synced');
            const request = index.getAll(false);
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        };
    });
}

async function markEmergencyDataAsSynced(id) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('StopitHarassmentDB', 1);
        
        request.onerror = () => reject(request.error);
        
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['emergencies'], 'readwrite');
            const store = transaction.objectStore('emergencies');
            
            const getRequest = store.get(id);
            getRequest.onsuccess = () => {
                const data = getRequest.result;
                if (data) {
                    data.synced = true;
                    data.syncedAt = new Date().toISOString();
                    const updateRequest = store.put(data);
                    updateRequest.onsuccess = () => resolve();
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    resolve();
                }
            };
        };
    });
}

// Send emergency alert to external services
async function sendEmergencyAlert(data) {
    const alertPayload = {
        id: data.id,
        timestamp: data.timestamp,
        location: data.location,
        audioUrl: data.audioUrl,
        contacts: data.contacts,
        type: 'emergency',
        source: 'stopit-harassment-pwa'
    };

    // Send to Firebase
    if (self.firebase && self.firebase.firestore) {
        try {
            await self.firebase.firestore().collection('emergencies').add(alertPayload);
        } catch (error) {
            console.error('Failed to send to Firebase:', error);
        }
    }

    // Send to emergency services API (if configured)
    try {
        await fetch('/api/emergency', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(alertPayload)
        });
    } catch (error) {
        console.error('Failed to send to emergency API:', error);
    }
}

// Push notification handling
self.addEventListener('push', event => {
    console.log('Push notification received:', event);
    
    const options = {
        body: event.data ? event.data.text() : 'Emergency alert received',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
        vibrate: [200, 100, 200, 100, 200],
        tag: 'emergency-alert',
        requireInteraction: true,
        actions: [
            {
                action: 'view',
                title: 'View Alert',
                icon: '/icons/view-icon.png'
            },
            {
                action: 'dismiss',
                title: 'Dismiss',
                icon: '/icons/dismiss-icon.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('StopitHarassment Emergency', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    console.log('Notification clicked:', event);
    
    event.notification.close();

    if (event.action === 'view') {
        event.waitUntil(
            clients.openWindow('/?alert=view')
        );
    } else if (event.action === 'dismiss') {
        // Just close the notification
        return;
    } else {
        // Default action - open the app
        event.waitUntil(
            clients.matchAll({ type: 'window' }).then(clientList => {
                for (const client of clientList) {
                    if (client.url === '/' && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
        );
    }
});

// Message handling from main thread
self.addEventListener('message', event => {
    console.log('Service Worker received message:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    } else if (event.data && event.data.type === 'EMERGENCY_ALERT') {
        // Handle emergency alert from main thread
        handleEmergencyFromMainThread(event.data.payload);
    }
});

// Handle emergency alert triggered from main thread
async function handleEmergencyFromMainThread(payload) {
    try {
        // Store in IndexedDB for offline persistence
        await storeEmergencyData(payload);
        
        // Try to send immediately if online
        if (navigator.onLine) {
            try {
                await sendEmergencyAlert(payload);
                await markEmergencyDataAsSynced(payload.id);
            } catch (error) {
                console.error('Failed to send emergency alert immediately:', error);
                // Will be retried during background sync
            }
        } else {
            // Register for background sync when connection is restored
            await self.registration.sync.register('emergency-sync');
        }
    } catch (error) {
        console.error('Failed to handle emergency alert:', error);
    }
}

// Store emergency data in IndexedDB
async function storeEmergencyData(data) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('StopitHarassmentDB', 1);
        
        request.onerror = () => reject(request.error);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains('emergencies')) {
                const store = db.createObjectStore('emergencies', { keyPath: 'id' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('synced', 'synced', { unique: false });
            }
        };
        
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['emergencies'], 'readwrite');
            const store = transaction.objectStore('emergencies');
            
            const dataWithMeta = {
                ...data,
                synced: false,
                createdAt: new Date().toISOString()
            };
            
            const addRequest = store.add(dataWithMeta);
            addRequest.onsuccess = () => resolve();
            addRequest.onerror = () => reject(addRequest.error);
        };
    });
}