// Emergency manager for StopitHarassment PWA
export class EmergencyManager {
    constructor() {
        this.storage = null;
        this.firebase = null;
        this.bluetooth = null;
        this.audio = null;
        this.location = null;
        this.isEmergencyActive = false;
        this.currentEmergencyId = null;
        this.emergencyStartTime = null;
        this.retryAttempts = 3;
        this.retryDelay = 5000; // 5 seconds
    }

    init(managers) {
        this.storage = managers.storage;
        this.firebase = managers.firebase;
        this.bluetooth = managers.bluetooth;
        this.audio = managers.audio;
        this.location = managers.location;
        
        console.log('Emergency Manager initialized');
    }

    async activateEmergency() {
        if (this.isEmergencyActive) {
            console.warn('Emergency already active');
            return;
        }

        try {
            console.log('🚨 EMERGENCY ACTIVATED');
            this.isEmergencyActive = true;
            this.emergencyStartTime = Date.now();
            this.currentEmergencyId = this.generateEmergencyId();

            // Start all emergency procedures in parallel
            const emergencyData = await this.executeEmergencyProcedures();
            
            // Send alerts to all channels
            const alertResults = await this.sendEmergencyAlerts(emergencyData);
            
            // Store emergency record
            await this.storage.saveEmergency({
                id: this.currentEmergencyId,
                type: 'manual',
                data: emergencyData,
                alertResults: alertResults,
                timestamp: this.emergencyStartTime,
                status: 'active'
            });

            console.log('Emergency procedures completed');
            return {
                emergencyId: this.currentEmergencyId,
                alertsSent: alertResults.totalSent,
                location: emergencyData.location,
                recording: emergencyData.audioRecording
            };
        } catch (error) {
            console.error('Emergency activation failed:', error);
            this.isEmergencyActive = false;
            throw error;
        }
    }

    async executeEmergencyProcedures() {
        const procedures = [];
        
        // Start location tracking
        procedures.push(this.getEmergencyLocation());
        
        // Start audio recording
        procedures.push(this.startEmergencyAudioRecording());
        
        // Get trusted contacts
        procedures.push(this.getTrustedContacts());
        
        // Execute all procedures in parallel
        const [location, audioRecording, contacts] = await Promise.allSettled(procedures);
        
        return {
            location: location.status === 'fulfilled' ? location.value : null,
            audioRecording: audioRecording.status === 'fulfilled' ? audioRecording.value : null,
            contacts: contacts.status === 'fulfilled' ? contacts.value : [],
            timestamp: Date.now(),
            emergencyId: this.currentEmergencyId
        };
    }

    async getEmergencyLocation() {
        try {
            console.log('Getting emergency location...');
            
            // Try to get current location with high accuracy
            const location = await this.location.getCurrentLocation();
            
            if (location) {
                // Also get address if online
                if (navigator.onLine) {
                    try {
                        const address = await this.location.getAddressFromCoordinates(
                            location.latitude, 
                            location.longitude
                        );
                        location.address = address;
                    } catch (error) {
                        console.warn('Failed to get address:', error);
                    }
                }
                
                console.log('Emergency location obtained:', location);
                return location;
            } else {
                throw new Error('Location not available');
            }
        } catch (error) {
            console.error('Failed to get emergency location:', error);
            // Return last known location if available
            return this.location.getLocationForEmergency();
        }
    }

    async startEmergencyAudioRecording() {
        try {
            console.log('Starting emergency audio recording...');
            
            // Check if audio recording is enabled in settings
            const audioEnabled = await this.storage.getSetting('audioRecording');
            if (audioEnabled === false) {
                console.log('Audio recording disabled in settings');
                return null;
            }

            await this.audio.startRecording();
            
            // Auto-stop recording after 2 minutes for emergency
            setTimeout(async () => {
                if (this.audio.isRecording && this.isEmergencyActive) {
                    try {
                        const recording = await this.audio.stopRecording();
                        if (recording) {
                            // Save to storage
                            const recordingId = await this.storage.saveAudioRecording(
                                recording.blob, 
                                {
                                    emergencyId: this.currentEmergencyId,
                                    duration: recording.duration,
                                    type: 'emergency'
                                }
                            );
                            console.log('Emergency audio recording saved:', recordingId);
                        }
                    } catch (error) {
                        console.error('Failed to stop emergency recording:', error);
                    }
                }
            }, 120000); // 2 minutes
            
            return {
                started: true,
                startTime: Date.now(),
                maxDuration: 120000
            };
        } catch (error) {
            console.error('Failed to start emergency audio recording:', error);
            return {
                started: false,
                error: error.message
            };
        }
    }

    async getTrustedContacts() {
        try {
            const contacts = await this.storage.getContacts();
            console.log('Retrieved trusted contacts:', contacts.length);
            return contacts;
        } catch (error) {
            console.error('Failed to get trusted contacts:', error);
            return [];
        }
    }

    async sendEmergencyAlerts(emergencyData) {
        const results = {
            bluetooth: { sent: 0, failed: 0, errors: [] },
            firebase: { sent: 0, failed: 0, errors: [] },
            authorities: { sent: 0, failed: 0, errors: [] },
            totalSent: 0,
            totalFailed: 0
        };

        const alertPromises = [];

        // Send Bluetooth alerts
        if (this.bluetooth && emergencyData.contacts.length > 0) {
            alertPromises.push(this.sendBluetoothAlerts(emergencyData, results));
        }

        // Send Firebase alerts
        if (this.firebase && navigator.onLine && emergencyData.contacts.length > 0) {
            alertPromises.push(this.sendFirebaseAlerts(emergencyData, results));
        }

        // Notify authorities
        if (navigator.onLine) {
            alertPromises.push(this.notifyAuthorities(emergencyData, results));
        }

        // Execute all alert methods in parallel
        await Promise.allSettled(alertPromises);

        results.totalSent = results.bluetooth.sent + results.firebase.sent + results.authorities.sent;
        results.totalFailed = results.bluetooth.failed + results.firebase.failed + results.authorities.failed;

        console.log('Emergency alerts summary:', results);
        return results;
    }

    async sendBluetoothAlerts(emergencyData, results) {
        try {
            console.log('Sending Bluetooth emergency alerts...');
            
            const alertData = {
                type: 'emergency',
                emergencyId: emergencyData.emergencyId,
                location: emergencyData.location,
                timestamp: emergencyData.timestamp,
                message: 'Emergency alert from StopitHarassment user'
            };

            // Try to broadcast to all nearby devices
            await this.bluetooth.broadcastEmergency(alertData);
            results.bluetooth.sent++;
            
        } catch (error) {
            console.error('Bluetooth alert failed:', error);
            results.bluetooth.failed++;
            results.bluetooth.errors.push(error.message);
        }
    }

    async sendFirebaseAlerts(emergencyData, results) {
        try {
            console.log('Sending Firebase emergency alerts...');
            
            // Save emergency to Firebase
            const emergencyId = await this.firebase.saveEmergencyAlert({
                emergencyId: emergencyData.emergencyId,
                location: emergencyData.location,
                timestamp: emergencyData.timestamp,
                audioRecording: emergencyData.audioRecording,
                type: 'manual'
            });

            // Send notifications to each contact
            for (const contact of emergencyData.contacts) {
                try {
                    await this.firebase.sendEmergencyNotification(contact.id, {
                        emergencyId: emergencyData.emergencyId,
                        location: emergencyData.location,
                        timestamp: emergencyData.timestamp,
                        message: `Emergency alert from ${contact.name || 'a trusted contact'}`
                    });
                    results.firebase.sent++;
                } catch (error) {
                    console.error('Failed to send Firebase alert to contact:', contact.email, error);
                    results.firebase.failed++;
                    results.firebase.errors.push(`${contact.email}: ${error.message}`);
                }
            }
            
        } catch (error) {
            console.error('Firebase alerts failed:', error);
            results.firebase.failed++;
            results.firebase.errors.push(error.message);
        }
    }

    async notifyAuthorities(emergencyData, results) {
        try {
            console.log('Notifying authorities...');
            
            // Use Firebase Cloud Function to notify authorities
            if (this.firebase) {
                await this.firebase.sendEmergencyToAuthorities({
                    emergencyId: emergencyData.emergencyId,
                    location: emergencyData.location,
                    timestamp: emergencyData.timestamp,
                    audioUrl: emergencyData.audioRecording?.url
                });
                results.authorities.sent++;
            } else {
                // Fallback: Direct API call to emergency services
                const response = await fetch('/api/emergency/notify-authorities', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        location: emergencyData.location,
                        timestamp: emergencyData.timestamp,
                        emergencyId: emergencyData.emergencyId
                    })
                });

                if (response.ok) {
                    results.authorities.sent++;
                } else {
                    throw new Error(`Authority notification failed: ${response.status}`);
                }
            }
            
        } catch (error) {
            console.error('Failed to notify authorities:', error);
            results.authorities.failed++;
            results.authorities.errors.push(error.message);
        }
    }

    async sendTestAlert() {
        try {
            console.log('Sending test alert...');
            
            const testData = {
                type: 'test',
                timestamp: Date.now(),
                message: 'This is a test alert from StopitHarassment',
                location: await this.location.getCurrentLocation().catch(() => null)
            };

            const results = [];

            // Test Bluetooth
            if (this.bluetooth) {
                try {
                    await this.bluetooth.sendTestAlert();
                    results.push('Bluetooth: Success');
                } catch (error) {
                    results.push(`Bluetooth: Failed - ${error.message}`);
                }
            }

            // Test Firebase
            if (this.firebase && navigator.onLine) {
                try {
                    const contacts = await this.storage.getContacts();
                    if (contacts.length > 0) {
                        await this.firebase.sendEmergencyNotification(contacts[0].id, {
                            ...testData,
                            isTest: true
                        });
                        results.push('Firebase: Success');
                    } else {
                        results.push('Firebase: No contacts to test');
                    }
                } catch (error) {
                    results.push(`Firebase: Failed - ${error.message}`);
                }
            }

            console.log('Test alert results:', results);
            return results;
        } catch (error) {
            console.error('Test alert failed:', error);
            throw error;
        }
    }

    async sendTestAlertToContact(contactId) {
        try {
            const contact = await this.storage.getContact(contactId);
            if (!contact) {
                throw new Error('Contact not found');
            }

            const testData = {
                type: 'test',
                timestamp: Date.now(),
                message: `Test alert from StopitHarassment for ${contact.name}`,
                contact: contact
            };

            // Send via available channels
            const promises = [];

            if (this.bluetooth) {
                promises.push(this.bluetooth.sendTestAlert());
            }

            if (this.firebase && navigator.onLine) {
                promises.push(this.firebase.sendEmergencyNotification(contactId, {
                    ...testData,
                    isTest: true
                }));
            }

            await Promise.allSettled(promises);
            console.log('Test alert sent to contact:', contact.name);
        } catch (error) {
            console.error('Failed to send test alert to contact:', error);
            throw error;
        }
    }

    async cancelEmergency() {
        if (!this.isEmergencyActive) {
            console.warn('No active emergency to cancel');
            return;
        }

        try {
            console.log('Cancelling emergency...');
            
            // Stop audio recording if active
            if (this.audio && this.audio.isRecording) {
                try {
                    const recording = await this.audio.stopRecording();
                    if (recording) {
                        // Save the recording even though emergency was cancelled
                        await this.storage.saveAudioRecording(
                            recording.blob,
                            {
                                emergencyId: this.currentEmergencyId,
                                duration: recording.duration,
                                type: 'emergency-cancelled'
                            }
                        );
                    }
                } catch (error) {
                    console.error('Failed to stop recording during cancellation:', error);
                }
            }

            // Update emergency record
            if (this.currentEmergencyId) {
                try {
                    // Mark emergency as cancelled in storage
                    await this.storage.saveEmergency({
                        id: this.currentEmergencyId + '-cancelled',
                        originalId: this.currentEmergencyId,
                        type: 'cancellation',
                        timestamp: Date.now(),
                        duration: Date.now() - this.emergencyStartTime,
                        status: 'cancelled'
                    });
                } catch (error) {
                    console.error('Failed to save cancellation record:', error);
                }
            }

            // Send cancellation alerts
            await this.sendCancellationAlerts();

            this.isEmergencyActive = false;
            this.currentEmergencyId = null;
            this.emergencyStartTime = null;

            console.log('Emergency cancelled successfully');
        } catch (error) {
            console.error('Failed to cancel emergency:', error);
            throw error;
        }
    }

    async sendCancellationAlerts() {
        try {
            const cancellationData = {
                type: 'cancellation',
                originalEmergencyId: this.currentEmergencyId,
                timestamp: Date.now(),
                message: 'Emergency has been cancelled'
            };

            // Send via Bluetooth
            if (this.bluetooth) {
                try {
                    await this.bluetooth.sendMessage(cancellationData);
                } catch (error) {
                    console.error('Failed to send Bluetooth cancellation:', error);
                }
            }

            // Send via Firebase
            if (this.firebase && navigator.onLine) {
                try {
                    const contacts = await this.storage.getContacts();
                    for (const contact of contacts) {
                        await this.firebase.sendEmergencyNotification(contact.id, cancellationData);
                    }
                } catch (error) {
                    console.error('Failed to send Firebase cancellation:', error);
                }
            }

            console.log('Cancellation alerts sent');
        } catch (error) {
            console.error('Failed to send cancellation alerts:', error);
        }
    }

    async handleBluetoothEmergency(emergencyMessage) {
        try {
            console.log('Handling Bluetooth emergency:', emergencyMessage);
            
            // Store received emergency
            await this.storage.saveEmergency({
                id: emergencyMessage.id,
                type: 'received-bluetooth',
                data: emergencyMessage.data,
                timestamp: emergencyMessage.timestamp,
                source: 'bluetooth'
            });

            // Show notification to user
            this.showEmergencyNotification(emergencyMessage);
            
        } catch (error) {
            console.error('Failed to handle Bluetooth emergency:', error);
        }
    }

    showEmergencyNotification(emergencyData) {
        // Show browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification('Emergency Alert Received', {
                body: emergencyData.data?.message || 'A trusted contact needs help',
                icon: '/icons/icon-192x192.png',
                tag: 'emergency-received',
                requireInteraction: true,
                vibrate: [500, 200, 500, 200, 500],
                actions: [
                    { action: 'respond', title: 'Respond' },
                    { action: 'dismiss', title: 'Dismiss' }
                ]
            });

            notification.onclick = () => {
                window.focus();
                // Navigate to emergency view
                if (window.app) {
                    window.app.switchView('home');
                }
            };
        }

        // Trigger device vibration
        if ('vibrate' in navigator) {
            navigator.vibrate([500, 200, 500, 200, 500]);
        }
    }

    generateEmergencyId() {
        return 'emer_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
    }

    getEmergencyStatus() {
        return {
            isActive: this.isEmergencyActive,
            emergencyId: this.currentEmergencyId,
            startTime: this.emergencyStartTime,
            duration: this.isEmergencyActive ? Date.now() - this.emergencyStartTime : 0
        };
    }

    // Cleanup method
    destroy() {
        if (this.isEmergencyActive) {
            this.cancelEmergency();
        }
    }
}