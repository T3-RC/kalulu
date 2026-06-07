/**
 * MapScreen - Main map view with posts and events
 */

import React, { useRef, useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../services/store';
import { api } from '../services/api';
import { useCurrentLocation } from '../hooks/useLocation';
import { usePostsByRegion, useEventsByRegion, useStats } from '../hooks/useData';
import { colors, formatTimeAgo, getHeatEmoji } from '../utils/helpers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Dark map style
const mapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#666666' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#555555' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d0d0d' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

export default function MapScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  
  const [viewMode, setViewMode] = useState('events'); // 'events' or 'posts'
  
  const mapRegion = useStore((state) => state.mapRegion);
  const setMapRegion = useStore((state) => state.setMapRegion);
  
  const { location, requestLocation } = useCurrentLocation();
  const { data: stats } = useStats();
  
  // Fetch data based on current region
  const { data: posts = [], isLoading: postsLoading } = usePostsByRegion(mapRegion);
  const { data: events = [], isLoading: eventsLoading } = useEventsByRegion(mapRegion);

  const isLoading = viewMode === 'posts' ? postsLoading : eventsLoading;

  // Handle region change
  const onRegionChangeComplete = useCallback((region) => {
    setMapRegion(region);
  }, [setMapRegion]);

  // Center on user location
  const centerOnUser = useCallback(async () => {
    const loc = await requestLocation();
    if (loc && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: loc.latitude,
        longitude: loc.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }
  }, [requestLocation]);

  // Navigate to event detail
  const onEventPress = useCallback((event) => {
    navigation.navigate('EventDetail', { eventId: event.id });
  }, [navigation]);

  // Navigate to post detail
  const onPostPress = useCallback((post) => {
    navigation.navigate('PostDetail', { postId: post.id });
  }, [navigation]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={mapStyle}
        initialRegion={mapRegion}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
      >
        {/* Event Markers */}
        {viewMode === 'events' && events.map((event) => (
          <Marker
            key={event.id}
            coordinate={{
              latitude: event.center_lat,
              longitude: event.center_lng,
            }}
            onPress={() => onEventPress(event)}
          >
            <View style={styles.eventMarker}>
              <Text style={styles.eventMarkerText}>{event.post_count}</Text>
            </View>
            <Callout tooltip onPress={() => onEventPress(event)}>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{event.name}</Text>
                <Text style={styles.calloutMeta}>
                  {getHeatEmoji(event.heat_score)} {event.post_count} photos · {event.neighborhood}
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}

        {/* Post Markers */}
        {viewMode === 'posts' && posts.slice(0, 100).map((post) => (
          <Marker
            key={post.id}
            coordinate={{
              latitude: post.latitude,
              longitude: post.longitude,
            }}
            onPress={() => onPostPress(post)}
          >
            <View style={styles.postMarker}>
              <Image
                source={{ uri: api.getMediaUrl(post.media_url) }}
                style={styles.postMarkerImage}
              />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>Kalulu</Text>
          <Text style={styles.tagline}>NYC</Text>
        </View>
        
        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{stats?.total_posts || 0}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{stats?.total_events || 0}</Text>
            <Text style={styles.statLabel}>Events</Text>
          </View>
        </View>
      </View>

      {/* View Mode Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'events' && styles.toggleButtonActive]}
          onPress={() => setViewMode('events')}
        >
          <Ionicons 
            name="flame" 
            size={18} 
            color={viewMode === 'events' ? '#fff' : '#666'} 
          />
          <Text style={[styles.toggleText, viewMode === 'events' && styles.toggleTextActive]}>
            Events
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'posts' && styles.toggleButtonActive]}
          onPress={() => setViewMode('posts')}
        >
          <Ionicons 
            name="images" 
            size={18} 
            color={viewMode === 'posts' ? '#fff' : '#666'} 
          />
          <Text style={[styles.toggleText, viewMode === 'posts' && styles.toggleTextActive]}>
            Posts
          </Text>
        </TouchableOpacity>
      </View>

      {/* Location Button */}
      <TouchableOpacity style={styles.locationButton} onPress={centerOnUser}>
        <Ionicons name="locate" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Loading Indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    flex: 1,
  },
  
  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: 'rgba(10, 10, 10, 0.9)',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  logo: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  tagline: {
    fontSize: 14,
    color: colors.textMuted,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },

  // Toggle
  toggleContainer: {
    position: 'absolute',
    top: 110,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(17, 17, 17, 0.95)',
    borderRadius: 25,
    padding: 4,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textMuted,
  },
  toggleTextActive: {
    color: '#fff',
  },

  // Markers
  eventMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  eventMarkerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  postMarker: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  postMarkerImage: {
    width: '100%',
    height: '100%',
  },

  // Callout
  callout: {
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 8,
    minWidth: 150,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  calloutMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },

  // Location Button
  locationButton: {
    position: 'absolute',
    bottom: 30,
    right: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },

  // Loading
  loadingContainer: {
    position: 'absolute',
    top: 160,
    alignSelf: 'center',
    backgroundColor: colors.card,
    padding: 8,
    borderRadius: 20,
  },
});
