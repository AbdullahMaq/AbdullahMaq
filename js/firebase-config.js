// Firebase configuration and management for StopitHarassment
export class FirebaseManager {
    constructor() {
        this.app = null;
        this.auth = null;
        this.firestore = null;
        this.currentUser = null;
        this.initialized = false;
    }

    async init() {
        try {
            // Firebase configuration - Replace with your actual config
            const firebaseConfig = {
                apiKey: "your-api-key-here",
                authDomain: "stopit-harassment.firebaseapp.com",
                projectId: "stopit-harassment",
                storageBucket: "stopit-harassment.appspot.com",
                messagingSenderId: "123456789",
                appId: "your-app-id-here"
            };

            // Initialize Firebase
            if (typeof firebase !== 'undefined') {
                this.app = firebase.initializeApp(firebaseConfig);
                this.auth = firebase.auth();
                this.firestore = firebase.firestore();

                // Enable offline persistence
                await this.firestore.enablePersistence({ synchronizeTabs: true });

                // Setup auth state listener
                this.auth.onAuthStateChanged(this.handleAuthStateChange.bind(this));

                this.initialized = true;
                console.log('Firebase initialized successfully');
            } else {
                console.warn('Firebase SDK not loaded, running in offline mode');
                this.initialized = false;
            }
        } catch (error) {
            console.error('Firebase initialization failed:', error);
            this.initialized = false;
        }
    }

    handleAuthStateChange(user) {
        this.currentUser = user;
        
        if (user) {
            console.log('User signed in:', user.email);
            this.syncUserData();
        } else {
            console.log('User signed out');
        }
    }

    async signInWithGoogle() {
        if (!this.initialized) {
            throw new Error('Firebase not initialized');
        }

        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('email');
            provider.addScope('profile');

            const result = await this.auth.signInWithPopup(provider);
            console.log('Google sign-in successful:', result.user.email);
            
            return result.user;
        } catch (error) {
            console.error('Google sign-in failed:', error);
            throw error;
        }
    }

    async signOut() {
        if (!this.initialized) {
            throw new Error('Firebase not initialized');
        }

        try {
            await this.auth.signOut();
            console.log('User signed out successfully');
        } catch (error) {
            console.error('Sign out failed:', error);
            throw error;
        }
    }

    getCurrentUser() {
        return this.currentUser;
    }

    async syncUserData() {
        if (!this.currentUser || !this.initialized) {
            return;
        }

        try {
            const userId = this.currentUser.uid;
            
            // Sync contacts to Firestore
            const localContacts = await this.getLocalContacts();
            if (localContacts.length > 0) {
                await this.uploadContacts(userId, localContacts);
            }

            // Download and merge remote contacts
            const remoteContacts = await this.downloadContacts(userId);
            if (remoteContacts.length > 0) {
                await this.mergeContacts(remoteContacts);
            }

            console.log('User data synced successfully');
        } catch (error) {
            console.error('User data sync failed:', error);
        }
    }

    async uploadContacts(userId, contacts) {
        if (!this.initialized) return;

        try {
            const batch = this.firestore.batch();
            
            contacts.forEach(contact => {
                const docRef = this.firestore
                    .collection('users')
                    .doc(userId)
                    .collection('contacts')
                    .doc(contact.id);
                
                batch.set(docRef, {
                    ...contact,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });

            await batch.commit();
            console.log('Contacts uploaded to Firebase');
        } catch (error) {
            console.error('Failed to upload contacts:', error);
            throw error;
        }
    }

    async downloadContacts(userId) {
        if (!this.initialized) return [];

        try {
            const snapshot = await this.firestore
                .collection('users')
                .doc(userId)
                .collection('contacts')
                .get();

            const contacts = [];
            snapshot.forEach(doc => {
                contacts.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            console.log('Downloaded contacts from Firebase:', contacts.length);
            return contacts;
        } catch (error) {
            console.error('Failed to download contacts:', error);
            return [];
        }
    }

    async mergeContacts(remoteContacts) {
        // This would integrate with the StorageManager
        // For now, we'll just log the contacts
        console.log('Merging remote contacts:', remoteContacts);
    }

    async getLocalContacts() {
        // This would integrate with the StorageManager
        // For now, return empty array
        return [];
    }

    async saveEmergencyAlert(alertData) {
        if (!this.initialized) {
            console.warn('Firebase not initialized, storing alert locally');
            return;
        }

        try {
            const docRef = await this.firestore.collection('emergencies').add({
                ...alertData,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userId: this.currentUser?.uid || 'anonymous'
            });

            console.log('Emergency alert saved to Firebase:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('Failed to save emergency alert:', error);
            throw error;
        }
    }

    async getEmergencyAlerts(limit = 10) {
        if (!this.initialized || !this.currentUser) {
            return [];
        }

        try {
            const snapshot = await this.firestore
                .collection('emergencies')
                .where('userId', '==', this.currentUser.uid)
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();

            const alerts = [];
            snapshot.forEach(doc => {
                alerts.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return alerts;
        } catch (error) {
            console.error('Failed to get emergency alerts:', error);
            return [];
        }
    }

    async sendEmergencyNotification(recipientId, alertData) {
        if (!this.initialized) {
            console.warn('Firebase not initialized, cannot send notification');
            return;
        }

        try {
            // Store notification in recipient's notifications collection
            await this.firestore
                .collection('users')
                .doc(recipientId)
                .collection('notifications')
                .add({
                    type: 'emergency',
                    fromUserId: this.currentUser?.uid || 'anonymous',
                    alertData: alertData,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    read: false
                });

            console.log('Emergency notification sent to:', recipientId);
        } catch (error) {
            console.error('Failed to send emergency notification:', error);
            throw error;
        }
    }

    async setupRealtimeSync() {
        if (!this.initialized || !this.currentUser) {
            return;
        }

        try {
            // Listen for real-time updates to user's notifications
            this.firestore
                .collection('users')
                .doc(this.currentUser.uid)
                .collection('notifications')
                .where('read', '==', false)
                .onSnapshot(snapshot => {
                    snapshot.docChanges().forEach(change => {
                        if (change.type === 'added') {
                            const notification = change.doc.data();
                            this.handleNewNotification(notification);
                        }
                    });
                });

            console.log('Real-time sync setup complete');
        } catch (error) {
            console.error('Failed to setup real-time sync:', error);
        }
    }

    handleNewNotification(notification) {
        if (notification.type === 'emergency') {
            // Show emergency notification
            this.showEmergencyNotification(notification);
        }
    }

    showEmergencyNotification(notification) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Emergency Alert Received', {
                body: 'A trusted contact has sent an emergency alert',
                icon: '/icons/icon-192x192.png',
                tag: 'emergency-alert',
                requireInteraction: true
            });
        }

        // Also show in-app notification
        console.log('Emergency notification received:', notification);
    }

    async requestNotificationPermission() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            console.log('Notification permission:', permission);
            return permission === 'granted';
        }
        return false;
    }

    // Cloud Functions integration
    async callCloudFunction(functionName, data) {
        if (!this.initialized) {
            throw new Error('Firebase not initialized');
        }

        try {
            const functions = firebase.functions();
            const callableFunction = functions.httpsCallable(functionName);
            const result = await callableFunction(data);
            
            console.log('Cloud function result:', result.data);
            return result.data;
        } catch (error) {
            console.error('Cloud function call failed:', error);
            throw error;
        }
    }

    async sendEmergencyToAuthorities(alertData) {
        try {
            // Call cloud function to notify authorities
            return await this.callCloudFunction('notifyAuthorities', {
                location: alertData.location,
                timestamp: alertData.timestamp,
                userId: this.currentUser?.uid,
                audioUrl: alertData.audioUrl
            });
        } catch (error) {
            console.error('Failed to notify authorities:', error);
            throw error;
        }
    }
}