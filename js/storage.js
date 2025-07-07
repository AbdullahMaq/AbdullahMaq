// Storage manager for StopitHarassment PWA
export class StorageManager {
    constructor() {
        this.dbName = 'StopitHarassmentDB';
        this.dbVersion = 1;
        this.db = null;
        this.initialized = false;
    }

    async init() {
        try {
            console.log('Initializing Storage Manager...');
            
            await this.openDatabase();
            
            this.initialized = true;
            console.log('Storage Manager initialized');
            return true;
        } catch (error) {
            console.error('Storage Manager initialization failed:', error);
            return false;
        }
    }

    async openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                console.error('Database error:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('Database opened successfully');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this.createObjectStores(db);
            };
        });
    }

    createObjectStores(db) {
        console.log('Creating object stores...');
        
        // Contacts store
        if (!db.objectStoreNames.contains('contacts')) {
            const contactsStore = db.createObjectStore('contacts', { keyPath: 'id' });
            contactsStore.createIndex('email', 'email', { unique: false });
            contactsStore.createIndex('name', 'name', { unique: false });
            contactsStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
            const settingsStore = db.createObjectStore('settings', { keyPath: 'key' });
        }

        // Emergency data store
        if (!db.objectStoreNames.contains('emergencies')) {
            const emergenciesStore = db.createObjectStore('emergencies', { keyPath: 'id' });
            emergenciesStore.createIndex('timestamp', 'timestamp', { unique: false });
            emergenciesStore.createIndex('synced', 'synced', { unique: false });
            emergenciesStore.createIndex('type', 'type', { unique: false });
        }

        // Audio recordings store
        if (!db.objectStoreNames.contains('audioRecordings')) {
            const audioStore = db.createObjectStore('audioRecordings', { keyPath: 'id' });
            audioStore.createIndex('timestamp', 'metadata.timestamp', { unique: false });
            audioStore.createIndex('emergencyId', 'emergencyId', { unique: false });
        }

        // Location history store
        if (!db.objectStoreNames.contains('locationHistory')) {
            const locationStore = db.createObjectStore('locationHistory', { keyPath: 'id' });
            locationStore.createIndex('timestamp', 'timestamp', { unique: false });
            locationStore.createIndex('accuracy', 'accuracy', { unique: false });
        }

        console.log('Object stores created');
    }

    // Contacts management
    async addContact(contact) {
        try {
            const transaction = this.db.transaction(['contacts'], 'readwrite');
            const store = transaction.objectStore('contacts');
            
            const contactData = {
                ...contact,
                id: contact.id || this.generateId(),
                createdAt: contact.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            await this.promisifyRequest(store.add(contactData));
            console.log('Contact added:', contactData.name);
            return contactData;
        } catch (error) {
            console.error('Failed to add contact:', error);
            throw error;
        }
    }

    async getContacts() {
        try {
            const transaction = this.db.transaction(['contacts'], 'readonly');
            const store = transaction.objectStore('contacts');
            
            const contacts = await this.promisifyRequest(store.getAll());
            return contacts || [];
        } catch (error) {
            console.error('Failed to get contacts:', error);
            return [];
        }
    }

    async getContact(contactId) {
        try {
            const transaction = this.db.transaction(['contacts'], 'readonly');
            const store = transaction.objectStore('contacts');
            
            const contact = await this.promisifyRequest(store.get(contactId));
            return contact;
        } catch (error) {
            console.error('Failed to get contact:', error);
            return null;
        }
    }

    async updateContact(contactId, updates) {
        try {
            const contact = await this.getContact(contactId);
            if (!contact) {
                throw new Error('Contact not found');
            }

            const updatedContact = {
                ...contact,
                ...updates,
                updatedAt: new Date().toISOString()
            };

            const transaction = this.db.transaction(['contacts'], 'readwrite');
            const store = transaction.objectStore('contacts');
            
            await this.promisifyRequest(store.put(updatedContact));
            console.log('Contact updated:', contactId);
            return updatedContact;
        } catch (error) {
            console.error('Failed to update contact:', error);
            throw error;
        }
    }

    async removeContact(contactId) {
        try {
            const transaction = this.db.transaction(['contacts'], 'readwrite');
            const store = transaction.objectStore('contacts');
            
            await this.promisifyRequest(store.delete(contactId));
            console.log('Contact removed:', contactId);
        } catch (error) {
            console.error('Failed to remove contact:', error);
            throw error;
        }
    }

    // Settings management
    async getSetting(key) {
        try {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            
            const result = await this.promisifyRequest(store.get(key));
            return result ? result.value : null;
        } catch (error) {
            console.error('Failed to get setting:', error);
            return null;
        }
    }

    async updateSetting(key, value) {
        try {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            
            const settingData = {
                key: key,
                value: value,
                updatedAt: new Date().toISOString()
            };
            
            await this.promisifyRequest(store.put(settingData));
            console.log('Setting updated:', key);
        } catch (error) {
            console.error('Failed to update setting:', error);
            throw error;
        }
    }

    async getSettings() {
        try {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            
            const allSettings = await this.promisifyRequest(store.getAll());
            
            // Convert array to object
            const settings = {};
            allSettings.forEach(setting => {
                settings[setting.key] = setting.value;
            });
            
            return settings;
        } catch (error) {
            console.error('Failed to get settings:', error);
            return {};
        }
    }

    // Emergency data management
    async saveEmergency(emergencyData) {
        try {
            const transaction = this.db.transaction(['emergencies'], 'readwrite');
            const store = transaction.objectStore('emergencies');
            
            const data = {
                ...emergencyData,
                id: emergencyData.id || this.generateId(),
                timestamp: emergencyData.timestamp || Date.now(),
                synced: false,
                createdAt: new Date().toISOString()
            };
            
            await this.promisifyRequest(store.add(data));
            console.log('Emergency data saved:', data.id);
            return data.id;
        } catch (error) {
            console.error('Failed to save emergency data:', error);
            throw error;
        }
    }

    async getEmergencies(limit = 50) {
        try {
            const transaction = this.db.transaction(['emergencies'], 'readonly');
            const store = transaction.objectStore('emergencies');
            const index = store.index('timestamp');
            
            const emergencies = await this.promisifyRequest(index.getAll());
            
            // Sort by timestamp descending and limit
            return emergencies
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, limit);
        } catch (error) {
            console.error('Failed to get emergencies:', error);
            return [];
        }
    }

    async getPendingEmergencies() {
        try {
            const transaction = this.db.transaction(['emergencies'], 'readonly');
            const store = transaction.objectStore('emergencies');
            const index = store.index('synced');
            
            const pending = await this.promisifyRequest(index.getAll(false));
            return pending || [];
        } catch (error) {
            console.error('Failed to get pending emergencies:', error);
            return [];
        }
    }

    async markEmergencyAsSynced(emergencyId) {
        try {
            const transaction = this.db.transaction(['emergencies'], 'readwrite');
            const store = transaction.objectStore('emergencies');
            
            const emergency = await this.promisifyRequest(store.get(emergencyId));
            if (emergency) {
                emergency.synced = true;
                emergency.syncedAt = new Date().toISOString();
                await this.promisifyRequest(store.put(emergency));
                console.log('Emergency marked as synced:', emergencyId);
            }
        } catch (error) {
            console.error('Failed to mark emergency as synced:', error);
            throw error;
        }
    }

    // Audio recordings management
    async saveAudioRecording(audioBlob, metadata = {}) {
        try {
            const transaction = this.db.transaction(['audioRecordings'], 'readwrite');
            const store = transaction.objectStore('audioRecordings');
            
            const recordingData = {
                id: this.generateId(),
                blob: audioBlob,
                metadata: {
                    ...metadata,
                    timestamp: Date.now(),
                    size: audioBlob.size,
                    type: audioBlob.type
                },
                createdAt: new Date().toISOString()
            };
            
            await this.promisifyRequest(store.add(recordingData));
            console.log('Audio recording saved:', recordingData.id);
            return recordingData.id;
        } catch (error) {
            console.error('Failed to save audio recording:', error);
            throw error;
        }
    }

    async getAudioRecording(recordingId) {
        try {
            const transaction = this.db.transaction(['audioRecordings'], 'readonly');
            const store = transaction.objectStore('audioRecordings');
            
            const recording = await this.promisifyRequest(store.get(recordingId));
            return recording;
        } catch (error) {
            console.error('Failed to get audio recording:', error);
            return null;
        }
    }

    async getAudioRecordings(limit = 20) {
        try {
            const transaction = this.db.transaction(['audioRecordings'], 'readonly');
            const store = transaction.objectStore('audioRecordings');
            const index = store.index('timestamp');
            
            const recordings = await this.promisifyRequest(index.getAll());
            
            // Sort by timestamp descending and limit
            return recordings
                .sort((a, b) => b.metadata.timestamp - a.metadata.timestamp)
                .slice(0, limit);
        } catch (error) {
            console.error('Failed to get audio recordings:', error);
            return [];
        }
    }

    async deleteAudioRecording(recordingId) {
        try {
            const transaction = this.db.transaction(['audioRecordings'], 'readwrite');
            const store = transaction.objectStore('audioRecordings');
            
            await this.promisifyRequest(store.delete(recordingId));
            console.log('Audio recording deleted:', recordingId);
        } catch (error) {
            console.error('Failed to delete audio recording:', error);
            throw error;
        }
    }

    // Location history management
    async saveLocationHistory(locations) {
        try {
            const transaction = this.db.transaction(['locationHistory'], 'readwrite');
            const store = transaction.objectStore('locationHistory');
            
            for (const location of locations) {
                const locationData = {
                    ...location,
                    id: this.generateId(),
                    savedAt: new Date().toISOString()
                };
                await this.promisifyRequest(store.add(locationData));
            }
            
            console.log('Location history saved:', locations.length, 'entries');
        } catch (error) {
            console.error('Failed to save location history:', error);
            throw error;
        }
    }

    async getLocationHistory(limit = 100) {
        try {
            const transaction = this.db.transaction(['locationHistory'], 'readonly');
            const store = transaction.objectStore('locationHistory');
            const index = store.index('timestamp');
            
            const locations = await this.promisifyRequest(index.getAll());
            
            // Sort by timestamp descending and limit
            return locations
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, limit);
        } catch (error) {
            console.error('Failed to get location history:', error);
            return [];
        }
    }

    // Data export/import
    async exportData() {
        try {
            const data = {
                contacts: await this.getContacts(),
                settings: await this.getSettings(),
                emergencies: await this.getEmergencies(),
                audioRecordings: await this.getAudioRecordings(),
                locationHistory: await this.getLocationHistory(),
                exportDate: new Date().toISOString(),
                version: this.dbVersion
            };
            
            console.log('Data exported');
            return data;
        } catch (error) {
            console.error('Failed to export data:', error);
            throw error;
        }
    }

    async importData(data) {
        try {
            // Clear existing data
            await this.clearAllData();
            
            // Import contacts
            if (data.contacts) {
                for (const contact of data.contacts) {
                    await this.addContact(contact);
                }
            }
            
            // Import settings
            if (data.settings) {
                for (const [key, value] of Object.entries(data.settings)) {
                    await this.updateSetting(key, value);
                }
            }
            
            console.log('Data imported successfully');
        } catch (error) {
            console.error('Failed to import data:', error);
            throw error;
        }
    }

    // Cleanup methods
    async clearAllData() {
        try {
            const storeNames = ['contacts', 'settings', 'emergencies', 'audioRecordings', 'locationHistory'];
            
            for (const storeName of storeNames) {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                await this.promisifyRequest(store.clear());
            }
            
            console.log('All data cleared');
        } catch (error) {
            console.error('Failed to clear data:', error);
            throw error;
        }
    }

    async clearOldData(daysOld = 30) {
        try {
            const cutoffDate = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
            
            // Clear old emergencies
            const emergencyTransaction = this.db.transaction(['emergencies'], 'readwrite');
            const emergencyStore = emergencyTransaction.objectStore('emergencies');
            const emergencyIndex = emergencyStore.index('timestamp');
            const emergencyRange = IDBKeyRange.upperBound(cutoffDate);
            
            await this.promisifyRequest(emergencyIndex.openCursor(emergencyRange)).then(cursor => {
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
            });
            
            // Clear old audio recordings
            const audioTransaction = this.db.transaction(['audioRecordings'], 'readwrite');
            const audioStore = audioTransaction.objectStore('audioRecordings');
            const audioIndex = audioStore.index('timestamp');
            const audioRange = IDBKeyRange.upperBound(cutoffDate);
            
            await this.promisifyRequest(audioIndex.openCursor(audioRange)).then(cursor => {
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
            });
            
            console.log('Old data cleared (older than', daysOld, 'days)');
        } catch (error) {
            console.error('Failed to clear old data:', error);
            throw error;
        }
    }

    // Utility methods
    promisifyRequest(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Storage statistics
    async getStorageStats() {
        try {
            const stats = {
                contacts: await this.getContacts().then(c => c.length),
                emergencies: await this.getEmergencies().then(e => e.length),
                audioRecordings: await this.getAudioRecordings().then(a => a.length),
                locationHistory: await this.getLocationHistory().then(l => l.length),
                settings: Object.keys(await this.getSettings()).length
            };
            
            // Estimate storage usage
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                const estimate = await navigator.storage.estimate();
                stats.storageUsed = estimate.usage;
                stats.storageQuota = estimate.quota;
                stats.storageUsedPercent = (estimate.usage / estimate.quota * 100).toFixed(2);
            }
            
            return stats;
        } catch (error) {
            console.error('Failed to get storage stats:', error);
            return {};
        }
    }

    // Cleanup method
    destroy() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
        this.initialized = false;
    }
}