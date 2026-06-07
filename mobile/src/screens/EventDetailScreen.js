/**
 * EventDetailScreen - Detailed view of an event with all its posts
 */

import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../services/api';
import { useEvent } from '../hooks/useData';
import { useCurrentLocation } from '../hooks/useLocation';
import { colors, formatTime, formatTimeAgo, getDistanceFromUser, getHeatEmoji } from '../utils/helpers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 2;
const GRID_COLUMNS = 3;
const GRID_ITEM_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

// Grid Photo Item
function GridPhoto({ post, onPress }) {
  return (
    <TouchableOpacity 
      style={styles.gridItem}
      onPress={() => onPress(post)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: api.getMediaUrl(post.media_url) }}
        style={styles.gridImage}
      />
    </TouchableOpacity>
  );
}

// Event Header Component
function EventHeader({ event, userLocation }) {
  const distance = getDistanceFromUser(event, userLocation);
  
  return (
    <View style={styles.header}>
      <View style={styles.headerMain}>
        <Text style={styles.eventName}>{event.name}</Text>
        
        <View style={styles.headerMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="location" size={14} color={colors.primary} />
            <Text style={styles.metaText}>{event.neighborhood || 'NYC'}</Text>
          </View>
          
          {distance && (
            <View style={styles.metaItem}>
              <Ionicons name="navigate" size={14} color={colors.textMuted} />
              <Text style={styles.metaTextMuted}>{distance} away</Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{event.post_count}</Text>
          <Text style={styles.statLabel}>Photos</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{getHeatEmoji(event.heat_score)}</Text>
          <Text style={styles.statLabel}>Heat</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {Math.round((new Date(event.end_time) - new Date(event.start_time)) / (1000 * 60 * 60))}h
          </Text>
          <Text style={styles.statLabel}>Duration</Text>
        </View>
      </View>

      {/* Time */}
      <View style={styles.timeRow}>
        <Ionicons name="time" size={14} color={colors.textMuted} />
        <Text style={styles.timeText}>
          {formatTime(event.start_time)} - {formatTime(event.end_time)}
        </Text>
      </View>

      {/* Photos Section Title */}
      <View style={styles.sectionTitle}>
        <Text style={styles.sectionTitleText}>All Photos</Text>
        <Text style={styles.sectionCount}>{event.posts?.length || 0}</Text>
      </View>
    </View>
  );
}

export default function EventDetailScreen({ route, navigation }) {
  const { eventId } = route.params;
  const { data: event, isLoading, error } = useEvent(eventId);
  const { location } = useCurrentLocation();

  const onPhotoPress = useCallback((post) => {
    navigation.navigate('PostDetail', { postId: post.id });
  }, [navigation]);

  const renderPhoto = useCallback(({ item, index }) => (
    <GridPhoto post={item} onPress={onPhotoPress} />
  ), [onPhotoPress]);

  const keyExtractor = useCallback((item) => item.id, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color={colors.error} />
        <Text style={styles.errorText}>Event not found</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={event.posts || []}
      renderItem={renderPhoto}
      keyExtractor={keyExtractor}
      numColumns={GRID_COLUMNS}
      ListHeaderComponent={<EventHeader event={event} userLocation={location} />}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      columnWrapperStyle={styles.gridRow}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 16,
    color: colors.textMuted,
  },

  // Header
  header: {
    padding: 16,
  },
  headerMain: {
    marginBottom: 20,
  },
  eventName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  headerMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  metaTextMuted: {
    fontSize: 14,
    color: colors.textMuted,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },

  // Time
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  timeText: {
    fontSize: 14,
    color: colors.textMuted,
  },

  // Section Title
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  sectionCount: {
    fontSize: 14,
    color: colors.textMuted,
  },

  // Grid
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
  },
  gridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.card,
  },
});
