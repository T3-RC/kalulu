# 📱 Kalulu Mobile App

React Native mobile app built with Expo for iOS and Android.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your phone (for testing)

### Installation

```bash
# Navigate to mobile directory
cd mobile

# Install dependencies
npm install

# Start Expo development server
npx expo start
```

### Running on Device

1. Install **Expo Go** from App Store or Google Play
2. Run `npx expo start`
3. Scan the QR code with your phone's camera (iOS) or Expo Go app (Android)

### Running on Simulator

```bash
# iOS Simulator (macOS only)
npx expo start --ios

# Android Emulator
npx expo start --android
```

## 🔧 Configuration

### API Server Connection

The app connects to the backend at `localhost:8000` by default. To change this:

1. Open the app
2. Go to **Profile** tab
3. Tap **API Server**
4. Enter your backend URL (e.g., `http://192.168.1.100:8000`)

**For physical device testing**, you must use your computer's local IP address instead of `localhost`.

Find your IP:
- macOS: `ipconfig getifaddr en0`
- Windows: `ipconfig`
- Linux: `hostname -I`

## 📱 Screens

| Screen | Description |
|--------|-------------|
| **Login** | Sign in / register (initial screen) |
| **Map** | Interactive map with event/post markers |
| **Feed** | Chronological list of all posts |
| **Upload** | Camera/gallery photo upload with location |
| **Events** | Auto-detected events with filtering |
| **Profile** | Settings and stats |
| **EventDetail** | Event with all its photos |
| **PostDetail** | Full photo view with metadata |

## 📦 Project Structure

```
mobile/
├── App.js                    # Entry point + navigation
├── app.json                  # Expo configuration
├── package.json              # Dependencies
├── babel.config.js           # Babel config
└── src/
    ├── screens/              # Screen components (8 total)
    │   ├── LoginScreen.js
    │   ├── MapScreen.js
    │   ├── FeedScreen.js
    │   ├── UploadScreen.js
    │   ├── EventsScreen.js
    │   ├── ProfileScreen.js
    │   ├── EventDetailScreen.js
    │   └── PostDetailScreen.js
    ├── services/
    │   ├── api.js            # Backend API client
    │   ├── auth.js           # Auth/token handling
    │   └── store.js          # Zustand global state
    ├── hooks/
    │   ├── useLocation.js    # Location hooks
    │   └── useData.js        # React Query data hooks
    └── utils/
        └── helpers.js        # Utility functions
```

## 🔑 Key Technologies

- **Expo** - React Native toolchain
- **React Navigation** - Navigation & routing
- **React Query** - Data fetching & caching
- **Zustand** - Global state management
- **React Native Maps** - Apple Maps (iOS) / Google Maps (Android)
- **Expo Location** - GPS location services
- **Expo Image Picker** - Camera & gallery access

## 🎨 Design

- Dark theme throughout
- Primary color: `#667eea` (purple-blue gradient)
- Card-based UI components
- Tab navigation with 5 main sections

## ⚠️ Known Limitations

- Google Maps (Android) requires an API key for production builds
- Location permissions required for core features
- Camera permissions required for photo upload
- Network connection required (no offline mode yet)

## 🏗️ Building for Production

### Expo Build (EAS)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

### Local Build

```bash
# iOS (requires macOS + Xcode)
npx expo run:ios

# Android (requires Android Studio)
npx expo run:android
```

## 📝 Environment Variables

For production, create an `app.config.js`:

```javascript
export default {
  expo: {
    // ... existing config
    extra: {
      apiUrl: process.env.API_URL || 'http://localhost:8000',
    },
  },
};
```

## 🐛 Troubleshooting

**"Network request failed"**
- Ensure backend is running
- Check API URL in Profile settings
- Use local IP instead of localhost on physical devices

**"Location permission denied"**
- Go to phone Settings > Kalulu > Location
- Enable "While Using"

**"Camera not working"**
- Go to phone Settings > Kalulu > Camera
- Enable camera access

## 📄 License

MIT - Part of the Kalulu project
