// Main application module for StopitHarassment PWA
import { FirebaseManager } from './firebase-config.js';
import { BluetoothManager } from './bluetooth.js';
import { AudioRecorder } from './audio-recorder.js';
import { LocationTracker } from './location-tracker.js';
import { StorageManager } from './storage.js';
import { EmergencyManager } from './emergency.js';

class StopitHarassmentApp {
    constructor() {
        this.firebaseManager = new FirebaseManager();
        this.bluetoothManager = new BluetoothManager();
        this.audioRecorder = new AudioRecorder();
        this.locationTracker = new LocationTracker();
        this.storageManager = new StorageManager();
        this.emergencyManager = new EmergencyManager();
        
        this.currentView = 'home';
        this.sosActivationTimer = null;
        this.sosDelay = 3; // seconds
        this.isEmergencyActive = false;
        this.installPromptEvent = null;
        
        this.init();
    }

    async init() {
        console.log('Initializing StopitHarassment App...');
        
        try {
            // Show loading screen
            this.showLoadingScreen();
            
            // Initialize all managers
            await this.initializeManagers();
            
            // Setup UI event listeners
            this.setupEventListeners();
            
            // Check system capabilities
            await this.checkSystemCapabilities();
            
            // Load user data
            await this.loadUserData();
            
            // Setup PWA install prompt
            this.setupInstallPrompt();
            
            // Hide loading screen and show app
            this.hideLoadingScreen();
            
            console.log('App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize app. Please refresh the page.');
        }
    }

    showLoadingScreen() {
        document.getElementById('loading-screen').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
    }

    hideLoadingScreen() {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
    }

    async initializeManagers() {
        try {
            await this.storageManager.init();
            await this.firebaseManager.init();
            await this.locationTracker.init();
            await this.audioRecorder.init();
            await this.bluetoothManager.init();
            
            // Initialize emergency manager with other managers
            this.emergencyManager.init({
                storage: this.storageManager,
                firebase: this.firebaseManager,
                bluetooth: this.bluetoothManager,
                audio: this.audioRecorder,
                location: this.locationTracker
            });
        } catch (error) {
            console.error('Manager initialization failed:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.switchView(view);
            });
        });

        // SOS Button
        const sosButton = document.getElementById('sos-button');
        let sosTimer = null;

        sosButton.addEventListener('mousedown', this.startSOSActivation.bind(this));
        sosButton.addEventListener('mouseup', this.cancelSOSActivation.bind(this));
        sosButton.addEventListener('touchstart', this.startSOSActivation.bind(this));
        sosButton.addEventListener('touchend', this.cancelSOSActivation.bind(this));
        sosButton.addEventListener('mouseleave', this.cancelSOSActivation.bind(this));

        // Quick Actions
        document.getElementById('test-alert').addEventListener('click', this.testAlert.bind(this));
        document.getElementById('location-check').addEventListener('click', this.checkLocation.bind(this));
        document.getElementById('audio-test').addEventListener('click', this.testAudio.bind(this));

        // Contact Management
        document.getElementById('add-contact').addEventListener('click', this.showAddContactModal.bind(this));
        document.getElementById('add-contact-form').addEventListener('submit', this.handleAddContact.bind(this));

        // Modal Controls
        document.querySelectorAll('.modal-cancel').forEach(btn => {
            btn.addEventListener('click', this.hideModals.bind(this));
        });

        document.getElementById('cancel-emergency').addEventListener('click', this.cancelEmergency.bind(this));

        // Settings
        document.getElementById('sos-delay').addEventListener('input', this.updateSOSDelay.bind(this));
        document.getElementById('sign-in').addEventListener('click', this.signIn.bind(this));
        document.getElementById('sign-out').addEventListener('click', this.signOut.bind(this));
        document.getElementById('clear-data').addEventListener('click', this.clearData.bind(this));

        // Install Prompt
        document.getElementById('install-confirm').addEventListener('click', this.installApp.bind(this));
        document.getElementById('install-dismiss').addEventListener('click', this.dismissInstallPrompt.bind(this));

        // Online/Offline status
        window.addEventListener('online', this.updateOnlineStatus.bind(this));
        window.addEventListener('offline', this.updateOnlineStatus.bind(this));

        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeydown.bind(this));
    }

    async checkSystemCapabilities() {
        // Check internet connection
        this.updateOnlineStatus();
        
        // Check Bluetooth availability
        const bluetoothAvailable = await this.bluetoothManager.checkAvailability();
        this.updateBluetoothStatus(bluetoothAvailable);
        
        // Check location services
        const locationAvailable = await this.locationTracker.checkPermissions();
        this.updateLocationStatus(locationAvailable);
        
        // Enable SOS button if basic requirements are met
        const sosButton = document.getElementById('sos-button');
        if (bluetoothAvailable || navigator.onLine) {
            sosButton.disabled = false;
        }
    }

    async loadUserData() {
        try {
            // Load contacts
            const contacts = await this.storageManager.getContacts();
            this.renderContacts(contacts);
            
            // Load settings
            const settings = await this.storageManager.getSettings();
            this.applySettings(settings);
            
            // Update contact count
            document.getElementById('contacts-count').textContent = contacts.length;
        } catch (error) {
            console.error('Failed to load user data:', error);
        }
    }

    switchView(viewName) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

        // Update views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(`${viewName}-view`).classList.add('active');

        this.currentView = viewName;

        // Load view-specific data
        if (viewName === 'contacts') {
            this.loadContactsView();
        } else if (viewName === 'settings') {
            this.loadSettingsView();
        }
    }

    startSOSActivation() {
        if (this.isEmergencyActive) return;

        const sosButton = document.getElementById('sos-button');
        sosButton.classList.add('activating');

        this.sosActivationTimer = setTimeout(() => {
            this.activateEmergency();
        }, this.sosDelay * 1000);
    }

    cancelSOSActivation() {
        if (this.sosActivationTimer) {
            clearTimeout(this.sosActivationTimer);
            this.sosActivationTimer = null;
        }

        const sosButton = document.getElementById('sos-button');
        sosButton.classList.remove('activating');
    }

    async activateEmergency() {
        if (this.isEmergencyActive) return;

        console.log('Emergency activated!');
        this.isEmergencyActive = true;

        const sosButton = document.getElementById('sos-button');
        sosButton.classList.remove('activating');
        sosButton.classList.add('activated');

        // Show emergency modal
        this.showEmergencyModal();

        try {
            // Start emergency procedures
            const emergencyData = await this.emergencyManager.activateEmergency();
            this.updateEmergencyModal(emergencyData);
        } catch (error) {
            console.error('Emergency activation failed:', error);
            this.showError('Emergency activation failed. Please try again.');
        }
    }

    async cancelEmergency() {
        if (!this.isEmergencyActive) return;

        console.log('Emergency cancelled');
        this.isEmergencyActive = false;

        const sosButton = document.getElementById('sos-button');
        sosButton.classList.remove('activated', 'activating');

        this.hideModals();

        try {
            await this.emergencyManager.cancelEmergency();
        } catch (error) {
            console.error('Failed to cancel emergency:', error);
        }
    }

    showEmergencyModal() {
        const modal = document.getElementById('emergency-modal');
        modal.classList.add('show');

        // Start updating status
        this.updateEmergencyStatus();
    }

    updateEmergencyStatus() {
        if (!this.isEmergencyActive) return;

        // Update location status
        this.locationTracker.getCurrentLocation()
            .then(location => {
                document.getElementById('emergency-location').textContent = 
                    `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
            })
            .catch(() => {
                document.getElementById('emergency-location').textContent = 'Location unavailable';
            });

        // Update recording status
        if (this.audioRecorder.isRecording) {
            document.getElementById('emergency-recording').textContent = 'Recording active';
        } else {
            document.getElementById('emergency-recording').textContent = 'Recording failed';
        }

        // Continue updating every 2 seconds
        setTimeout(() => this.updateEmergencyStatus(), 2000);
    }

    updateEmergencyModal(data) {
        if (data.alertsSent) {
            document.getElementById('emergency-alerts').textContent = data.alertsSent;
        }
    }

    async testAlert() {
        try {
            await this.emergencyManager.sendTestAlert();
            this.showSuccess('Test alert sent successfully');
        } catch (error) {
            console.error('Test alert failed:', error);
            this.showError('Test alert failed');
        }
    }

    async checkLocation() {
        try {
            const location = await this.locationTracker.getCurrentLocation();
            this.showSuccess(`Location: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`);
        } catch (error) {
            console.error('Location check failed:', error);
            this.showError('Location check failed');
        }
    }

    async testAudio() {
        try {
            const isRecording = this.audioRecorder.isRecording;
            
            if (isRecording) {
                await this.audioRecorder.stopRecording();
                this.showSuccess('Audio recording stopped');
            } else {
                await this.audioRecorder.startRecording();
                this.showSuccess('Audio recording started (will stop automatically in 5s)');
                
                // Auto-stop after 5 seconds for test
                setTimeout(() => {
                    this.audioRecorder.stopRecording();
                }, 5000);
            }
        } catch (error) {
            console.error('Audio test failed:', error);
            this.showError('Audio test failed');
        }
    }

    showAddContactModal() {
        const modal = document.getElementById('add-contact-modal');
        modal.classList.add('show');
    }

    hideModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('show');
        });
    }

    async handleAddContact(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const contact = {
            id: Date.now().toString(),
            name: formData.get('name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            createdAt: new Date().toISOString()
        };

        try {
            await this.storageManager.addContact(contact);
            await this.loadUserData();
            this.hideModals();
            e.target.reset();
            this.showSuccess('Contact added successfully');
        } catch (error) {
            console.error('Failed to add contact:', error);
            this.showError('Failed to add contact');
        }
    }

    async renderContacts(contacts) {
        const container = document.getElementById('contacts-list');
        
        if (contacts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No trusted contacts added yet.</p>
                    <p>Add contacts to receive emergency alerts.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = contacts.map(contact => `
            <div class="contact-item" data-contact-id="${contact.id}">
                <div class="contact-info">
                    <h4>${contact.name}</h4>
                    <p>${contact.email}</p>
                    ${contact.phone ? `<p>${contact.phone}</p>` : ''}
                </div>
                <div class="contact-actions">
                    <button class="contact-action" onclick="app.testContactAlert('${contact.id}')">Test</button>
                    <button class="contact-action danger" onclick="app.removeContact('${contact.id}')">Remove</button>
                </div>
            </div>
        `).join('');
    }

    async removeContact(contactId) {
        if (confirm('Are you sure you want to remove this contact?')) {
            try {
                await this.storageManager.removeContact(contactId);
                await this.loadUserData();
                this.showSuccess('Contact removed');
            } catch (error) {
                console.error('Failed to remove contact:', error);
                this.showError('Failed to remove contact');
            }
        }
    }

    async testContactAlert(contactId) {
        try {
            await this.emergencyManager.sendTestAlertToContact(contactId);
            this.showSuccess('Test alert sent to contact');
        } catch (error) {
            console.error('Failed to send test alert:', error);
            this.showError('Failed to send test alert');
        }
    }

    loadContactsView() {
        // Already loaded in loadUserData
    }

    async loadSettingsView() {
        try {
            const user = this.firebaseManager.getCurrentUser();
            if (user) {
                document.getElementById('user-id').textContent = user.email;
                document.getElementById('sign-in').style.display = 'none';
                document.getElementById('sign-out').style.display = 'block';
            } else {
                document.getElementById('user-id').textContent = 'Not logged in';
                document.getElementById('sign-in').style.display = 'block';
                document.getElementById('sign-out').style.display = 'none';
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    updateSOSDelay(e) {
        this.sosDelay = parseInt(e.target.value);
        document.getElementById('sos-delay-value').textContent = `${this.sosDelay}s`;
        
        // Save to storage
        this.storageManager.updateSetting('sosDelay', this.sosDelay);
    }

    async signIn() {
        try {
            await this.firebaseManager.signInWithGoogle();
            this.loadSettingsView();
            this.showSuccess('Signed in successfully');
        } catch (error) {
            console.error('Sign in failed:', error);
            this.showError('Sign in failed');
        }
    }

    async signOut() {
        try {
            await this.firebaseManager.signOut();
            this.loadSettingsView();
            this.showSuccess('Signed out successfully');
        } catch (error) {
            console.error('Sign out failed:', error);
            this.showError('Sign out failed');
        }
    }

    async clearData() {
        if (confirm('This will delete all your data including contacts and settings. Are you sure?')) {
            try {
                await this.storageManager.clearAllData();
                await this.loadUserData();
                this.showSuccess('All data cleared');
            } catch (error) {
                console.error('Failed to clear data:', error);
                this.showError('Failed to clear data');
            }
        }
    }

    applySettings(settings) {
        if (settings.sosDelay) {
            this.sosDelay = settings.sosDelay;
            document.getElementById('sos-delay').value = settings.sosDelay;
            document.getElementById('sos-delay-value').textContent = `${settings.sosDelay}s`;
        }

        if (settings.audioRecording !== undefined) {
            document.getElementById('audio-recording').checked = settings.audioRecording;
        }

        if (settings.locationTracking !== undefined) {
            document.getElementById('location-tracking').checked = settings.locationTracking;
        }
    }

    updateOnlineStatus() {
        const indicator = document.getElementById('online-status');
        const statusText = document.getElementById('internet-status');
        
        if (navigator.onLine) {
            indicator.classList.remove('offline');
            indicator.classList.add('online');
            statusText.textContent = 'Connected';
        } else {
            indicator.classList.remove('online');
            indicator.classList.add('offline');
            statusText.textContent = 'Offline';
        }
    }

    updateBluetoothStatus(available) {
        const indicator = document.getElementById('bluetooth-status');
        const statusText = document.getElementById('bluetooth-status-text');
        
        if (available) {
            indicator.classList.remove('offline');
            indicator.classList.add('online');
            statusText.textContent = 'Available';
        } else {
            indicator.classList.remove('online');
            indicator.classList.add('offline');
            statusText.textContent = 'Unavailable';
        }
    }

    updateLocationStatus(available) {
        const indicator = document.getElementById('location-status');
        const statusText = document.getElementById('location-status-text');
        
        if (available) {
            indicator.classList.remove('offline');
            indicator.classList.add('online');
            statusText.textContent = 'Available';
        } else {
            indicator.classList.remove('online');
            indicator.classList.add('offline');
            statusText.textContent = 'Denied';
        }
    }

    setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.installPromptEvent = e;
            this.showInstallPrompt();
        });
    }

    showInstallPrompt() {
        document.getElementById('install-prompt').style.display = 'block';
    }

    dismissInstallPrompt() {
        document.getElementById('install-prompt').style.display = 'none';
    }

    async installApp() {
        if (this.installPromptEvent) {
            this.installPromptEvent.prompt();
            const { outcome } = await this.installPromptEvent.userChoice;
            
            if (outcome === 'accepted') {
                this.showSuccess('App installed successfully');
            }
            
            this.installPromptEvent = null;
            this.dismissInstallPrompt();
        }
    }

    handleKeydown(e) {
        // Emergency shortcut: Ctrl+Shift+E
        if (e.ctrlKey && e.shiftKey && e.key === 'E') {
            e.preventDefault();
            this.activateEmergency();
        }
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Add toast styles dynamically
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 2000;
            max-width: 300px;
            word-wrap: break-word;
            animation: slideIn 0.3s ease;
            background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new StopitHarassmentApp();
});

// Handle PWA shortcuts
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('shortcut') === 'sos') {
    // Auto-activate emergency after app loads
    window.addEventListener('load', () => {
        setTimeout(() => {
            if (window.app) {
                window.app.activateEmergency();
            }
        }, 1000);
    });
}