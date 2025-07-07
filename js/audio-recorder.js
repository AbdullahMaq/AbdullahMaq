// Audio recorder for StopitHarassment PWA
export class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioContext = null;
        this.stream = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.recordingStartTime = null;
        this.maxRecordingDuration = 300000; // 5 minutes in milliseconds
        this.compressionFormat = 'audio/webm;codecs=opus';
        this.sampleRate = 44100;
    }

    async init() {
        try {
            console.log('Initializing Audio Recorder...');
            
            // Check if MediaRecorder is supported
            if (!window.MediaRecorder) {
                throw new Error('MediaRecorder not supported in this browser');
            }

            // Check supported audio formats
            this.compressionFormat = this.getSupportedFormat();
            
            console.log('Audio Recorder initialized with format:', this.compressionFormat);
            return true;
        } catch (error) {
            console.error('Audio Recorder initialization failed:', error);
            return false;
        }
    }

    getSupportedFormat() {
        const formats = [
            'audio/webm;codecs=opus',
            'audio/webm;codecs=vorbis',
            'audio/webm',
            'audio/mp4',
            'audio/mpeg',
            'audio/wav'
        ];

        for (const format of formats) {
            if (MediaRecorder.isTypeSupported(format)) {
                console.log('Supported audio format:', format);
                return format;
            }
        }

        return 'audio/webm'; // fallback
    }

    async requestPermissions() {
        try {
            console.log('Requesting microphone permissions...');
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: this.sampleRate
                } 
            });
            
            // Stop the stream immediately after permission is granted
            stream.getTracks().forEach(track => track.stop());
            
            console.log('Microphone permission granted');
            return true;
        } catch (error) {
            console.error('Microphone permission denied:', error);
            return false;
        }
    }

    async startRecording() {
        try {
            if (this.isRecording) {
                console.warn('Recording already in progress');
                return;
            }

            console.log('Starting audio recording...');

            // Get media stream
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: this.sampleRate
                } 
            });

            // Initialize MediaRecorder
            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: this.compressionFormat,
                audioBitsPerSecond: 128000 // 128 kbps for good quality/size balance
            });

            // Setup event handlers
            this.mediaRecorder.ondataavailable = this.handleDataAvailable.bind(this);
            this.mediaRecorder.onstop = this.handleRecordingStop.bind(this);
            this.mediaRecorder.onerror = this.handleRecordingError.bind(this);

            // Start recording
            this.audioChunks = [];
            this.mediaRecorder.start(1000); // Collect data every second
            this.isRecording = true;
            this.recordingStartTime = Date.now();

            console.log('Audio recording started');

            // Auto-stop after max duration
            setTimeout(() => {
                if (this.isRecording) {
                    console.log('Auto-stopping recording after max duration');
                    this.stopRecording();
                }
            }, this.maxRecordingDuration);

            return true;
        } catch (error) {
            console.error('Failed to start recording:', error);
            this.cleanup();
            throw error;
        }
    }

    async stopRecording() {
        try {
            if (!this.isRecording || !this.mediaRecorder) {
                console.warn('No recording in progress');
                return null;
            }

            console.log('Stopping audio recording...');

            this.mediaRecorder.stop();
            this.isRecording = false;

            // Return a promise that resolves when recording is processed
            return new Promise((resolve, reject) => {
                this.mediaRecorder.addEventListener('stop', () => {
                    try {
                        const audioBlob = this.createAudioBlob();
                        const duration = Date.now() - this.recordingStartTime;
                        
                        const result = {
                            blob: audioBlob,
                            duration: duration,
                            size: audioBlob.size,
                            type: audioBlob.type,
                            timestamp: this.recordingStartTime
                        };

                        console.log('Recording stopped:', result);
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                }, { once: true });
            });
        } catch (error) {
            console.error('Failed to stop recording:', error);
            this.cleanup();
            throw error;
        }
    }

    handleDataAvailable(event) {
        if (event.data.size > 0) {
            this.audioChunks.push(event.data);
        }
    }

    handleRecordingStop(event) {
        console.log('MediaRecorder stopped');
        this.cleanup();
    }

    handleRecordingError(event) {
        console.error('Recording error:', event.error);
        this.cleanup();
    }

    createAudioBlob() {
        const audioBlob = new Blob(this.audioChunks, { 
            type: this.compressionFormat 
        });
        return audioBlob;
    }

    cleanup() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        this.mediaRecorder = null;
        this.isRecording = false;
        this.recordingStartTime = null;
    }

    async compressAudio(audioBlob) {
        try {
            console.log('Compressing audio...');
            
            // For now, return the original blob
            // In a real implementation, you might use Web Audio API for compression
            return audioBlob;
        } catch (error) {
            console.error('Audio compression failed:', error);
            return audioBlob; // Return original if compression fails
        }
    }

    async convertToBase64(audioBlob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(audioBlob);
        });
    }

    async saveToStorage(audioBlob, metadata = {}) {
        try {
            const audioData = {
                id: this.generateId(),
                blob: audioBlob,
                metadata: {
                    ...metadata,
                    timestamp: Date.now(),
                    duration: metadata.duration || 0,
                    size: audioBlob.size,
                    type: audioBlob.type
                }
            };

            // Store in IndexedDB
            await this.storeInIndexedDB(audioData);
            
            console.log('Audio saved to storage:', audioData.id);
            return audioData.id;
        } catch (error) {
            console.error('Failed to save audio to storage:', error);
            throw error;
        }
    }

    async storeInIndexedDB(audioData) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('StopitHarassmentDB', 1);
            
            request.onerror = () => reject(request.error);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('audioRecordings')) {
                    const store = db.createObjectStore('audioRecordings', { keyPath: 'id' });
                    store.createIndex('timestamp', 'metadata.timestamp', { unique: false });
                }
            };
            
            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(['audioRecordings'], 'readwrite');
                const store = transaction.objectStore('audioRecordings');
                
                const addRequest = store.add(audioData);
                addRequest.onsuccess = () => resolve();
                addRequest.onerror = () => reject(addRequest.error);
            };
        });
    }

    async getRecordingsFromStorage() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('StopitHarassmentDB', 1);
            
            request.onerror = () => reject(request.error);
            
            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(['audioRecordings'], 'readonly');
                const store = transaction.objectStore('audioRecordings');
                
                const getAllRequest = store.getAll();
                getAllRequest.onsuccess = () => resolve(getAllRequest.result || []);
                getAllRequest.onerror = () => reject(getAllRequest.error);
            };
        });
    }

    async deleteRecording(recordingId) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('StopitHarassmentDB', 1);
            
            request.onerror = () => reject(request.error);
            
            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(['audioRecordings'], 'readwrite');
                const store = transaction.objectStore('audioRecordings');
                
                const deleteRequest = store.delete(recordingId);
                deleteRequest.onsuccess = () => resolve();
                deleteRequest.onerror = () => reject(deleteRequest.error);
            };
        });
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Audio analysis utilities
    async analyzeAudio(audioBlob) {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            const analysis = {
                duration: audioBuffer.duration,
                sampleRate: audioBuffer.sampleRate,
                numberOfChannels: audioBuffer.numberOfChannels,
                length: audioBuffer.length
            };

            // Calculate average volume
            const channelData = audioBuffer.getChannelData(0);
            let sum = 0;
            for (let i = 0; i < channelData.length; i++) {
                sum += Math.abs(channelData[i]);
            }
            analysis.averageVolume = sum / channelData.length;

            return analysis;
        } catch (error) {
            console.error('Audio analysis failed:', error);
            return null;
        }
    }

    // Get recording status
    getRecordingStatus() {
        return {
            isRecording: this.isRecording,
            duration: this.isRecording ? Date.now() - this.recordingStartTime : 0,
            chunksCount: this.audioChunks.length,
            format: this.compressionFormat
        };
    }

    // Test microphone functionality
    async testMicrophone() {
        try {
            console.log('Testing microphone...');
            
            await this.startRecording();
            
            // Record for 2 seconds
            setTimeout(async () => {
                const result = await this.stopRecording();
                if (result && result.blob.size > 0) {
                    console.log('Microphone test successful');
                    return true;
                } else {
                    console.error('Microphone test failed - no audio data');
                    return false;
                }
            }, 2000);
            
        } catch (error) {
            console.error('Microphone test failed:', error);
            return false;
        }
    }

    // Cleanup method
    destroy() {
        this.cleanup();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}