/**
 * UploadScreen - Share a moment with photo and location
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../services/store';
import { useCurrentLocation, useReverseGeocode } from '../hooks/useLocation';
import { useCreatePost } from '../hooks/useData';
import { colors } from '../utils/helpers';

export default function UploadScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  
  const [image, setImage] = useState(null);
  const [caption, setCaption] = useState('');
  const [customLocation, setCustomLocation] = useState(null);
  
  const { location, requestLocation, loading: locationLoading } = useCurrentLocation();
  const { mutate: createPost, isPending: uploading } = useCreatePost();
  
  // Use custom location if set, otherwise use current location
  const activeLocation = customLocation || location;
  const { address } = useReverseGeocode(activeLocation?.latitude, activeLocation?.longitude);

  // Pick image from gallery
  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImage({
        uri: result.assets[0].uri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      });
    }
  }, []);

  // Take photo with camera
  const takePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImage({
        uri: result.assets[0].uri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      });
      
      // Also get fresh location when taking a photo
      requestLocation();
    }
  }, [requestLocation]);

  // Clear image
  const clearImage = useCallback(() => {
    setImage(null);
  }, []);

  // Submit post
  const handleSubmit = useCallback(() => {
    if (!image) {
      Alert.alert('Missing photo', 'Please select or take a photo');
      return;
    }

    if (!activeLocation) {
      Alert.alert('Missing location', 'Please wait for location or enable location services');
      return;
    }

    createPost(
      {
        file: image,
        latitude: activeLocation.latitude,
        longitude: activeLocation.longitude,
        caption: caption.trim() || null,
        timestamp: new Date().toISOString(),
      },
      {
        onSuccess: () => {
          Alert.alert('Shared!', 'Your moment has been posted', [
            { text: 'OK', onPress: () => navigation.navigate('Feed') }
          ]);
          setImage(null);
          setCaption('');
        },
        onError: (error) => {
          Alert.alert('Upload failed', error.message);
        },
      }
    );
  }, [image, activeLocation, caption, createPost, navigation]);

  const canSubmit = image && activeLocation && !uploading;

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Image Selection */}
        {!image ? (
          <View style={styles.imagePickerContainer}>
            <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
              <Ionicons name="images-outline" size={40} color={colors.textMuted} />
              <Text style={styles.imagePickerText}>Choose from library</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.imagePicker} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={40} color={colors.textMuted} />
              <Text style={styles.imagePickerText}>Take a photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: image.uri }} style={styles.imagePreview} />
            <TouchableOpacity style={styles.clearButton} onPress={clearImage}>
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Caption Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Caption</Text>
          <TextInput
            style={styles.textInput}
            placeholder="What's happening?"
            placeholderTextColor={colors.textMuted}
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={280}
          />
          <Text style={styles.charCount}>{caption.length}/280</Text>
        </View>

        {/* Location Display */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Location</Text>
          <TouchableOpacity style={styles.locationDisplay} onPress={requestLocation}>
            {locationLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : activeLocation ? (
              <>
                <Ionicons name="location" size={18} color={colors.primary} />
                <Text style={styles.locationText}>
                  {address?.formatted || `${activeLocation.latitude.toFixed(4)}, ${activeLocation.longitude.toFixed(4)}`}
                </Text>
                <Ionicons name="refresh" size={16} color={colors.textMuted} />
              </>
            ) : (
              <>
                <Ionicons name="location-outline" size={18} color={colors.textMuted} />
                <Text style={styles.locationTextMuted}>Tap to get location</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Neighborhood Badge */}
        {address?.neighborhood && (
          <View style={styles.neighborhoodBadge}>
            <Ionicons name="business" size={14} color={colors.primary} />
            <Text style={styles.neighborhoodText}>{address.neighborhood}</Text>
          </View>
        )}
      </ScrollView>

      {/* Submit Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity 
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="paper-plane" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Share to Kalulu</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },

  // Image Picker
  imagePickerContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  imagePicker: {
    flex: 1,
    height: 150,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imagePickerText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Image Preview
  imagePreviewContainer: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.card,
  },
  clearButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Input Groups
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#fff',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },

  // Location
  locationDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
  },
  locationTextMuted: {
    flex: 1,
    fontSize: 14,
    color: colors.textMuted,
  },

  // Neighborhood Badge
  neighborhoodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(102, 126, 234, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  neighborhoodText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },

  // Footer
  footer: {
    padding: 16,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
