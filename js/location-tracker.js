// Location tracker for StopitHarassment PWA
export class LocationTracker {
    constructor() {
        this.watchId = null;
        this.currentLocation = null;
        this.lastKnownLocation = null;
        this.locationHistory = [];
        this.tracking = false;
        this.highAccuracy = true;
        this.timeout = 15000; // 15 seconds
        this.maximumAge = 60000; // 1 minute
        this.maxHistorySize = 100;
    }

    async init() {
        try {
            console.log('Initializing Location Tracker...');
            
            // Check if Geolocation is supported
            if (!navigator.geolocation) {
                throw new Error('Geolocation not supported in this browser');
            }

            // Load cached location data
            await this.loadLocationHistory();
            
            // Get initial location
            await this.getCurrentLocation();
            
            console.log('Location Tracker initialized');
            return true;
        } catch (error) {
            console.error('Location Tracker initialization failed:', error);
            return false;
        }
    }

    async checkPermissions() {
        try {
            if (!navigator.permissions) {
                // Fallback: try to get location directly
                await this.getCurrentLocation();
                return true;
            }

            const permission = await navigator.permissions.query({ name: 'geolocation' });
            
            switch (permission.state) {
                case 'granted':
                    console.log('Geolocation permission granted');
                    return true;
                case 'denied':
                    console.log('Geolocation permission denied');
                    return false;
                case 'prompt':
                    console.log('Geolocation permission needs to be requested');
                    // Try to get location to trigger permission prompt
                    try {
                        await this.getCurrentLocation();
                        return true;
                    } catch (error) {
                        return false;
                    }
                default:
                    return false;
            }
        } catch (error) {
            console.error('Failed to check geolocation permissions:', error);
            return false;
        }
    }

    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not available'));
                return;
            }

            const options = {
                enableHighAccuracy: this.highAccuracy,
                timeout: this.timeout,
                maximumAge: this.maximumAge
            };

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        altitude: position.coords.altitude,
                        altitudeAccuracy: position.coords.altitudeAccuracy,
                        heading: position.coords.heading,
                        speed: position.coords.speed,
                        timestamp: position.timestamp
                    };

                    this.currentLocation = location;
                    this.lastKnownLocation = location;
                    this.addToHistory(location);

                    console.log('Current location obtained:', location);
                    resolve(location);
                },
                (error) => {
                    console.error('Failed to get current location:', error);
                    
                    // Return last known location if available
                    if (this.lastKnownLocation) {
                        console.log('Returning last known location');
                        resolve(this.lastKnownLocation);
                    } else {
                        reject(error);
                    }
                },
                options
            );
        });
    }

    startTracking() {
        if (this.tracking) {
            console.warn('Location tracking already active');
            return;
        }

        try {
            console.log('Starting location tracking...');

            const options = {
                enableHighAccuracy: this.highAccuracy,
                timeout: this.timeout,
                maximumAge: this.maximumAge
            };

            this.watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const location = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        altitude: position.coords.altitude,
                        altitudeAccuracy: position.coords.altitudeAccuracy,
                        heading: position.coords.heading,
                        speed: position.coords.speed,
                        timestamp: position.timestamp
                    };

                    this.currentLocation = location;
                    this.lastKnownLocation = location;
                    this.addToHistory(location);

                    console.log('Location updated:', location);
                },
                (error) => {
                    console.error('Location tracking error:', error);
                },
                options
            );

            this.tracking = true;
            console.log('Location tracking started');
        } catch (error) {
            console.error('Failed to start location tracking:', error);
            throw error;
        }
    }

    stopTracking() {
        if (!this.tracking || !this.watchId) {
            console.warn('Location tracking not active');
            return;
        }

        try {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
            this.tracking = false;
            
            console.log('Location tracking stopped');
        } catch (error) {
            console.error('Failed to stop location tracking:', error);
        }
    }

    addToHistory(location) {
        // Add timestamp if not present
        if (!location.timestamp) {
            location.timestamp = Date.now();
        }

        this.locationHistory.unshift(location);

        // Limit history size
        if (this.locationHistory.length > this.maxHistorySize) {
            this.locationHistory = this.locationHistory.slice(0, this.maxHistorySize);
        }

        // Save to storage
        this.saveLocationHistory();
    }

    async saveLocationHistory() {
        try {
            localStorage.setItem('stopitharassment-location-history', JSON.stringify({
                history: this.locationHistory,
                lastKnownLocation: this.lastKnownLocation,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.error('Failed to save location history:', error);
        }
    }

    async loadLocationHistory() {
        try {
            const stored = localStorage.getItem('stopitharassment-location-history');
            if (stored) {
                const data = JSON.parse(stored);
                this.locationHistory = data.history || [];
                this.lastKnownLocation = data.lastKnownLocation;
                
                console.log('Location history loaded:', this.locationHistory.length, 'entries');
            }
        } catch (error) {
            console.error('Failed to load location history:', error);
        }
    }

    getLocationForEmergency() {
        // Return the most accurate recent location
        if (this.currentLocation) {
            return this.currentLocation;
        }

        if (this.lastKnownLocation) {
            return this.lastKnownLocation;
        }

        // Look for the most recent location in history
        if (this.locationHistory.length > 0) {
            return this.locationHistory[0];
        }

        return null;
    }

    async getAddressFromCoordinates(latitude, longitude) {
        try {
            // Use a reverse geocoding service
            // Note: In production, you'd use a proper geocoding service
            const response = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );

            if (response.ok) {
                const data = await response.json();
                return {
                    formattedAddress: data.displayName || 'Address not found',
                    city: data.city || '',
                    state: data.principalSubdivision || '',
                    country: data.countryName || '',
                    postalCode: data.postcode || ''
                };
            } else {
                throw new Error('Geocoding request failed');
            }
        } catch (error) {
            console.error('Reverse geocoding failed:', error);
            return {
                formattedAddress: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
                city: '',
                state: '',
                country: '',
                postalCode: ''
            };
        }
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        // Haversine formula to calculate distance between two coordinates
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distance in meters
    }

    getLocationAccuracy(location) {
        if (!location || !location.accuracy) {
            return 'unknown';
        }

        if (location.accuracy <= 10) {
            return 'high';
        } else if (location.accuracy <= 100) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    formatLocationForDisplay(location) {
        if (!location) {
            return 'Location unavailable';
        }

        const lat = location.latitude.toFixed(6);
        const lon = location.longitude.toFixed(6);
        const accuracy = location.accuracy ? `±${Math.round(location.accuracy)}m` : '';
        
        return `${lat}, ${lon} ${accuracy}`;
    }

    async shareLocation(contactId) {
        try {
            const location = await this.getCurrentLocation();
            if (!location) {
                throw new Error('Location not available');
            }

            const locationData = {
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
                timestamp: location.timestamp || Date.now(),
                sharedWith: contactId,
                sharedAt: Date.now()
            };

            console.log('Sharing location with contact:', contactId, locationData);
            return locationData;
        } catch (error) {
            console.error('Failed to share location:', error);
            throw error;
        }
    }

    getLocationHistory(limit = 50) {
        return this.locationHistory.slice(0, limit);
    }

    clearLocationHistory() {
        this.locationHistory = [];
        this.lastKnownLocation = null;
        this.currentLocation = null;
        
        try {
            localStorage.removeItem('stopitharassment-location-history');
            console.log('Location history cleared');
        } catch (error) {
            console.error('Failed to clear location history:', error);
        }
    }

    // Generate emergency location report
    generateEmergencyLocationReport() {
        const location = this.getLocationForEmergency();
        
        if (!location) {
            return {
                available: false,
                message: 'Location not available'
            };
        }

        return {
            available: true,
            coordinates: {
                latitude: location.latitude,
                longitude: location.longitude
            },
            accuracy: location.accuracy,
            timestamp: location.timestamp,
            age: Date.now() - (location.timestamp || 0),
            formatted: this.formatLocationForDisplay(location),
            qualityLevel: this.getLocationAccuracy(location)
        };
    }

    // Get tracking status
    getTrackingStatus() {
        return {
            tracking: this.tracking,
            watchId: this.watchId,
            currentLocation: this.currentLocation,
            lastKnownLocation: this.lastKnownLocation,
            historyCount: this.locationHistory.length,
            settings: {
                highAccuracy: this.highAccuracy,
                timeout: this.timeout,
                maximumAge: this.maximumAge
            }
        };
    }

    // Update tracking settings
    updateSettings(settings) {
        if (settings.highAccuracy !== undefined) {
            this.highAccuracy = settings.highAccuracy;
        }
        if (settings.timeout !== undefined) {
            this.timeout = settings.timeout;
        }
        if (settings.maximumAge !== undefined) {
            this.maximumAge = settings.maximumAge;
        }

        // Restart tracking if active to apply new settings
        if (this.tracking) {
            this.stopTracking();
            this.startTracking();
        }

        console.log('Location tracking settings updated:', settings);
    }

    // Cleanup method
    destroy() {
        this.stopTracking();
        this.clearLocationHistory();
    }
}