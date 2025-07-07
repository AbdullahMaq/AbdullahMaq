# StopitHarassment - Emergency Safety PWA �️

A powerful Progressive Web App (PWA) designed for emergency safety with offline capabilities, Bluetooth alerts, and comprehensive security features.

## 🚀 Features

### Core Emergency Features
- **Large SOS Button**: Easy-to-access emergency activation with customizable delay
- **Offline Functionality**: Works completely offline using service workers and IndexedDB
- **Bluetooth Nearby Connections**: Broadcast alerts to paired trusted contacts without internet
- **Audio Recording**: Automatic emergency audio recording with compression and storage
- **Location Tracking**: GPS location capture and storage, even without internet connection
- **Auto-Sync**: Automatically sends data when network is restored

### Security & Privacy
- **End-to-End Encryption**: All emergency data is encrypted
- **Offline-First**: All core features work without internet
- **Secure Storage**: Uses IndexedDB for encrypted local storage
- **Privacy Controls**: User controls all data sharing and permissions

### User Interface
- **Modern PWA Design**: Clean, accessible, and responsive interface
- **Dark Theme**: Emergency-focused dark theme with high contrast
- **Touch-Optimized**: Designed for mobile and touch interfaces
- **Keyboard Shortcuts**: Emergency activation via Ctrl+Shift+E
- **Install Prompt**: Native app-like installation experience

### Communication Channels
- **Bluetooth Web API**: Device-to-device emergency communication
- **Firebase Integration**: Cloud-based contact synchronization and alerts
- **Push Notifications**: Real-time emergency alerts
- **Emergency Services Integration**: Direct authority notification when possible

## 📱 Installation

### Quick Start
1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/stopit-harassment.git
   cd stopit-harassment
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm start
   ```

4. **Open in browser**:
   Navigate to `http://localhost:8000`

### PWA Installation
- **Desktop**: Click the install button in the address bar
- **Mobile**: Use "Add to Home Screen" from the browser menu
- **Automatic**: The app will prompt for installation after usage

## ⚙️ Configuration

### Firebase Setup (Optional)
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication and Firestore
3. Update `js/firebase-config.js` with your configuration:
   ```javascript
   const firebaseConfig = {
     apiKey: "your-api-key",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     // ... other config
   };
   ```

### Icon Generation
Generate PWA icons using any online tool or run:
```bash
# Example using a tool like PWA Asset Generator
npx pwa-asset-generator logo.svg icons/
```

Required icon sizes: 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512

## � Technical Architecture

### Technology Stack
- **Frontend**: Vanilla JavaScript (ES6+), CSS3, HTML5
- **Storage**: IndexedDB for offline data persistence
- **Communication**: Web Bluetooth API, Firebase SDK
- **Audio**: Web Audio API and MediaRecorder API
- **Location**: Geolocation API with offline caching
- **PWA**: Service Workers, Web App Manifest

### File Structure
```
stopit-harassment/
├── index.html              # Main application HTML
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker for offline functionality
├── css/
│   └── styles.css          # Application styles
├── js/
│   ├── app.js              # Main application logic
│   ├── firebase-config.js  # Firebase integration
│   ├── bluetooth.js        # Bluetooth communication
│   ├── audio-recorder.js   # Audio recording functionality
│   ├── location-tracker.js # GPS and location services
│   ├── storage.js          # IndexedDB storage management
│   └── emergency.js        # Emergency coordination
├── icons/                  # PWA icons
└── README.md              # This file
```

### Key Components

#### 1. Emergency Manager (`emergency.js`)
- Coordinates all emergency procedures
- Handles SOS activation and cancellation
- Manages alert distribution across all channels

#### 2. Bluetooth Manager (`bluetooth.js`)
- Web Bluetooth API implementation
- Device pairing and communication
- Offline emergency broadcasting

#### 3. Audio Recorder (`audio-recorder.js`)
- Web Audio API integration
- Automatic emergency recording
- Audio compression and storage

#### 4. Location Tracker (`location-tracker.js`)
- GPS location capture
- Offline location caching
- Geolocation accuracy management

#### 5. Storage Manager (`storage.js`)
- IndexedDB implementation
- Offline data persistence
- Data synchronization management

## � Usage Guide

### First-Time Setup
1. **Install the PWA** on your device
2. **Grant permissions** for microphone, location, and notifications
3. **Add trusted contacts** in the Contacts section
4. **Sign in with Google** (optional) for cloud synchronization
5. **Test the system** using the quick action buttons

### Emergency Activation
- **Hold the SOS button** for 3 seconds (configurable)
- **Use keyboard shortcut**: Ctrl+Shift+E
- **PWA shortcut**: Install app shortcut for quick access

### What Happens During Emergency
1. **Location captured** and stored locally
2. **Audio recording starts** automatically (if enabled)
3. **Bluetooth alerts** sent to nearby trusted contacts
4. **Firebase notifications** sent (if online)
5. **Authorities notified** via configured channels
6. **All data stored locally** for later synchronization

### Receiving Emergency Alerts
- **Browser notifications** with alert details
- **Device vibration** patterns
- **Bluetooth alerts** from nearby contacts
- **Action buttons** to respond or dismiss

## 🔐 Security Features

### Data Protection
- **Local encryption** for sensitive data
- **No cloud dependency** for core functionality
- **User-controlled permissions** for all features
- **Automatic data cleanup** after configurable periods

### Privacy Controls
- **Anonymous mode** available
- **Location sharing controls** per contact
- **Audio recording toggle** in settings
- **Data export/import** functionality

### Emergency Security
- **Multiple alert channels** for redundancy
- **Offline operation** when networks are compromised
- **Encrypted communication** via Bluetooth and Firebase
- **Emergency contact verification** systems

## 🌐 Browser Compatibility

### Supported Browsers
- ✅ **Chrome/Chromium 89+** (Full support)
- ✅ **Edge 89+** (Full support)
- ⚠️ **Firefox 85+** (Limited Bluetooth support)
- ⚠️ **Safari 14+** (Limited PWA features)

### Required APIs
- Service Workers (Offline functionality)
- IndexedDB (Data storage)
- Geolocation API (Location services)
- MediaRecorder API (Audio recording)
- Web Bluetooth API (Device communication)
- Push API (Notifications)

## 🔧 Development

### Development Setup
```bash
# Clone repository
git clone https://github.com/your-username/stopit-harassment.git
cd stopit-harassment

# Start development server
npm run dev

# Build for production
npm run build
```

### Testing
```bash
# Run tests (when implemented)
npm test

# Test PWA functionality
npm run test:pwa

# Test offline functionality
# Use Chrome DevTools > Application > Service Workers > Offline
```

### Contributing
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📋 Roadmap

### Planned Features
- [ ] **Video recording** during emergencies
- [ ] **Advanced encryption** for cloud storage
- [ ] **Multi-language support**
- [ ] **Emergency contact groups**
- [ ] **Integration with local emergency services**
- [ ] **Smartwatch companion app**
- [ ] **Advanced analytics** and reporting
- [ ] **Machine learning** threat detection

### Known Limitations
- Web Bluetooth API has limited browser support
- Some features require HTTPS for security
- Location accuracy depends on device capabilities
- Audio recording quality varies by device

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Support

### Getting Help
- **Issues**: [GitHub Issues](https://github.com/your-username/stopit-harassment/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/stopit-harassment/discussions)
- **Email**: support@stopitharassment.app

### Emergency Resources
- **US Emergency**: 911
- **UK Emergency**: 999
- **EU Emergency**: 112
- **Crisis Text Line**: Text HOME to 741741

### Privacy & Security
- This app is designed for emergency use
- No data is collected without explicit permission
- All emergency features work offline for maximum security
- Regular security audits are performed

## 🙏 Acknowledgments

- **Web Bluetooth Community** for API documentation
- **PWA Community** for best practices
- **Privacy advocates** for security guidance
- **Emergency responders** for feature feedback

---

**⚠️ Important**: This app is a safety tool and should supplement, not replace, traditional emergency services. Always call local emergency numbers (911, 999, 112) in life-threatening situations.
