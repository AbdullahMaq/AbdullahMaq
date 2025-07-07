// Bluetooth manager for StopitHarassment PWA
export class BluetoothManager {
    constructor() {
        this.device = null;
        this.server = null;
        this.serviceUUID = '12345678-1234-1234-1234-123456789abc'; // Custom service UUID
        this.characteristicUUID = '87654321-4321-4321-4321-cba987654321'; // Custom characteristic UUID
        this.characteristic = null;
        this.isConnected = false;
        this.nearbyDevices = new Map();
        this.messageQueue = [];
        this.scanning = false;
    }

    async init() {
        try {
            console.log('Initializing Bluetooth Manager...');
            
            // Check if Web Bluetooth is supported
            if (!navigator.bluetooth) {
                console.warn('Web Bluetooth not supported in this browser');
                return false;
            }

            // Request notification permission for Bluetooth alerts
            if ('Notification' in window) {
                await Notification.requestPermission();
            }

            console.log('Bluetooth Manager initialized');
            return true;
        } catch (error) {
            console.error('Bluetooth initialization failed:', error);
            return false;
        }
    }

    async checkAvailability() {
        try {
            if (!navigator.bluetooth) {
                return false;
            }

            // Check if Bluetooth is available
            const available = await navigator.bluetooth.getAvailability();
            console.log('Bluetooth availability:', available);
            
            return available;
        } catch (error) {
            console.error('Failed to check Bluetooth availability:', error);
            return false;
        }
    }

    async requestDevice() {
        try {
            console.log('Requesting Bluetooth device...');
            
            this.device = await navigator.bluetooth.requestDevice({
                filters: [
                    { services: [this.serviceUUID] }
                ],
                optionalServices: ['battery_service', 'device_information']
            });

            console.log('Bluetooth device selected:', this.device.name);
            
            // Listen for device disconnection
            this.device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));
            
            return this.device;
        } catch (error) {
            console.error('Device request failed:', error);
            throw error;
        }
    }

    async connect() {
        try {
            if (!this.device) {
                await this.requestDevice();
            }

            console.log('Connecting to GATT server...');
            this.server = await this.device.gatt.connect();
            
            console.log('Getting service...');
            const service = await this.server.getPrimaryService(this.serviceUUID);
            
            console.log('Getting characteristic...');
            this.characteristic = await service.getCharacteristic(this.characteristicUUID);
            
            // Setup notifications
            await this.characteristic.startNotifications();
            this.characteristic.addEventListener('characteristicvaluechanged', this.handleNotification.bind(this));
            
            this.isConnected = true;
            console.log('Bluetooth connected successfully');
            
            // Process any queued messages
            this.processMessageQueue();
            
            return true;
        } catch (error) {
            console.error('Bluetooth connection failed:', error);
            this.isConnected = false;
            throw error;
        }
    }

    async disconnect() {
        try {
            if (this.device && this.device.gatt.connected) {
                await this.device.gatt.disconnect();
            }
            
            this.isConnected = false;
            this.server = null;
            this.characteristic = null;
            
            console.log('Bluetooth disconnected');
        } catch (error) {
            console.error('Disconnect failed:', error);
        }
    }

    onDisconnected(event) {
        console.log('Bluetooth device disconnected:', event.target.name);
        this.isConnected = false;
        this.server = null;
        this.characteristic = null;
        
        // Attempt to reconnect after a delay
        setTimeout(() => {
            this.attemptReconnect();
        }, 3000);
    }

    async attemptReconnect() {
        try {
            console.log('Attempting to reconnect...');
            await this.connect();
        } catch (error) {
            console.error('Reconnection failed:', error);
            // Try again in 10 seconds
            setTimeout(() => {
                this.attemptReconnect();
            }, 10000);
        }
    }

    async sendEmergencyAlert(alertData) {
        try {
            const message = {
                type: 'emergency',
                timestamp: Date.now(),
                data: alertData,
                id: this.generateMessageId()
            };

            return await this.sendMessage(message);
        } catch (error) {
            console.error('Failed to send emergency alert via Bluetooth:', error);
            throw error;
        }
    }

    async sendTestAlert() {
        try {
            const message = {
                type: 'test',
                timestamp: Date.now(),
                data: { message: 'This is a test alert from StopitHarassment' },
                id: this.generateMessageId()
            };

            return await this.sendMessage(message);
        } catch (error) {
            console.error('Failed to send test alert via Bluetooth:', error);
            throw error;
        }
    }

    async sendMessage(message) {
        try {
            if (!this.isConnected || !this.characteristic) {
                // Queue message for later sending
                this.messageQueue.push(message);
                console.log('Message queued (Bluetooth not connected)');
                return false;
            }

            // Convert message to ArrayBuffer
            const encoder = new TextEncoder();
            const data = encoder.encode(JSON.stringify(message));
            
            // Send via Bluetooth characteristic
            await this.characteristic.writeValue(data);
            
            console.log('Message sent via Bluetooth:', message.type);
            return true;
        } catch (error) {
            console.error('Failed to send Bluetooth message:', error);
            // Queue message for retry
            this.messageQueue.push(message);
            throw error;
        }
    }

    processMessageQueue() {
        if (this.messageQueue.length === 0) {
            return;
        }

        console.log(`Processing ${this.messageQueue.length} queued messages`);
        
        const queue = [...this.messageQueue];
        this.messageQueue = [];
        
        queue.forEach(async (message) => {
            try {
                await this.sendMessage(message);
            } catch (error) {
                console.error('Failed to send queued message:', error);
            }
        });
    }

    handleNotification(event) {
        try {
            const decoder = new TextDecoder();
            const value = decoder.decode(event.target.value);
            const message = JSON.parse(value);
            
            console.log('Bluetooth notification received:', message);
            
            switch (message.type) {
                case 'emergency':
                    this.handleEmergencyNotification(message);
                    break;
                case 'test':
                    this.handleTestNotification(message);
                    break;
                case 'ack':
                    this.handleAcknowledgment(message);
                    break;
                default:
                    console.log('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Failed to handle Bluetooth notification:', error);
        }
    }

    handleEmergencyNotification(message) {
        console.log('Emergency alert received via Bluetooth:', message);
        
        // Show browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Emergency Alert Received', {
                body: 'A nearby contact has sent an emergency alert',
                icon: '/icons/icon-192x192.png',
                tag: 'emergency-bluetooth',
                requireInteraction: true,
                vibrate: [300, 100, 300, 100, 300]
            });
        }

        // Trigger device vibration if available
        if ('vibrate' in navigator) {
            navigator.vibrate([300, 100, 300, 100, 300]);
        }

        // Send acknowledgment
        this.sendAcknowledgment(message.id);
        
        // Forward to emergency manager
        if (window.app && window.app.emergencyManager) {
            window.app.emergencyManager.handleBluetoothEmergency(message);
        }
    }

    handleTestNotification(message) {
        console.log('Test alert received via Bluetooth:', message);
        
        // Show toast notification
        if (window.app) {
            window.app.showSuccess('Test alert received via Bluetooth');
        }
        
        // Send acknowledgment
        this.sendAcknowledgment(message.id);
    }

    handleAcknowledgment(message) {
        console.log('Acknowledgment received:', message.originalId);
        // Handle acknowledgment of sent messages
    }

    async sendAcknowledgment(originalMessageId) {
        try {
            const ackMessage = {
                type: 'ack',
                originalId: originalMessageId,
                timestamp: Date.now(),
                id: this.generateMessageId()
            };

            await this.sendMessage(ackMessage);
        } catch (error) {
            console.error('Failed to send acknowledgment:', error);
        }
    }

    generateMessageId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Bluetooth scanning for nearby devices (experimental)
    async startScanning() {
        try {
            if (this.scanning) {
                return;
            }

            console.log('Starting Bluetooth scan...');
            this.scanning = true;

            // Note: This is a simplified version. Real implementation would require
            // more sophisticated scanning using Bluetooth advertisement APIs
            
            // Simulate scanning with Web Bluetooth
            if (navigator.bluetooth && navigator.bluetooth.requestLEScan) {
                const scan = await navigator.bluetooth.requestLEScan({
                    filters: [{ services: [this.serviceUUID] }]
                });

                navigator.bluetooth.addEventListener('advertisementreceived', this.handleAdvertisement.bind(this));
                
                // Stop scanning after 30 seconds
                setTimeout(() => {
                    scan.stop();
                    this.scanning = false;
                    console.log('Bluetooth scan stopped');
                }, 30000);
            }
        } catch (error) {
            console.error('Bluetooth scanning failed:', error);
            this.scanning = false;
        }
    }

    handleAdvertisement(event) {
        console.log('Bluetooth advertisement received:', event.device.name);
        
        // Add to nearby devices
        this.nearbyDevices.set(event.device.id, {
            device: event.device,
            rssi: event.rssi,
            lastSeen: Date.now()
        });
    }

    getNearbyDevices() {
        // Filter devices seen in the last 60 seconds
        const cutoff = Date.now() - 60000;
        const nearby = [];
        
        for (const [id, deviceInfo] of this.nearbyDevices) {
            if (deviceInfo.lastSeen > cutoff) {
                nearby.push(deviceInfo);
            } else {
                this.nearbyDevices.delete(id);
            }
        }
        
        return nearby;
    }

    async broadcastEmergency(alertData) {
        try {
            console.log('Broadcasting emergency via Bluetooth...');
            
            // First, try to send via connected device
            if (this.isConnected) {
                await this.sendEmergencyAlert(alertData);
            }
            
            // Then scan for and connect to nearby devices
            await this.startScanning();
            
            // Wait a bit for devices to be discovered
            setTimeout(async () => {
                const nearbyDevices = this.getNearbyDevices();
                console.log(`Found ${nearbyDevices.length} nearby devices`);
                
                // Try to connect and send to each nearby device
                for (const deviceInfo of nearbyDevices) {
                    try {
                        await this.connectToDevice(deviceInfo.device);
                        await this.sendEmergencyAlert(alertData);
                        console.log('Emergency sent to:', deviceInfo.device.name);
                    } catch (error) {
                        console.error('Failed to send to device:', deviceInfo.device.name, error);
                    }
                }
            }, 5000);
            
        } catch (error) {
            console.error('Failed to broadcast emergency:', error);
            throw error;
        }
    }

    async connectToDevice(device) {
        try {
            const server = await device.gatt.connect();
            const service = await server.getPrimaryService(this.serviceUUID);
            const characteristic = await service.getCharacteristic(this.characteristicUUID);
            
            return { server, service, characteristic };
        } catch (error) {
            console.error('Failed to connect to device:', error);
            throw error;
        }
    }

    // Get connection status
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            deviceName: this.device?.name || null,
            nearbyDevicesCount: this.getNearbyDevices().length,
            queuedMessages: this.messageQueue.length
        };
    }

    // Cleanup method
    destroy() {
        this.disconnect();
        this.nearbyDevices.clear();
        this.messageQueue = [];
        this.scanning = false;
    }
}