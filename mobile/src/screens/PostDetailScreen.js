/**
 * PostDetailScreen - Full view of a single post
 */

import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Share,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../services/api';
import { usePost } from '../hooks/useData';
import { useCurrentLocation } from '../hooks/useLocation';
import { colors, formatTime, formatDate, getDistanceFromUser } from '../utils/helpers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PostDetailScreen({ route, navigation }) {
  const { postId } = route.params;
  const insets = useSafeAreaInsets();
  
  const { data: post, isLoading, error } = usePost(postId);
  const { location: userLocation } = useCurrentLocation();

  const distance = post ? getDistanceFromUser(post, userLocation) : null;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this moment from ${post.neighborhood || 'NYC'} on Kalulu!`,
        url: api.getMediaUrl(post.media_url),
      });
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const handleViewEvent = () => {
    if (post.event_id) {
      navigation.navigate('EventDetail', { eventId: post.event_id });
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color={colors.error} />
        <Text style={styles.errorText}>Post not found</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
    >
      {/* Image */}
      <Image
        source={{ uri: api.getMediaUrl(post.media_url) }}
        style={styles.image}
        resizeMode="cover"
      />

      {/* Content */}
      <View style={styles.content}>
        {/* Location & Time */}
        <View style={styles.headerRow}>
          <View style={styles.locationContainer}>
            <Ionicons name="location" size={18} color={colors.primary} />
            <Text style={styles.neighborhood}>{post.neighborhood || 'NYC'}</Text>
          </View>
          {distance && (
            <Text style={styles.distance}>{distance} away</Text>
          )}
        </View>

        {/* Caption */}
        {post.caption && (
          <Text style={styles.caption}>{post.caption}</Text>
        )}

        {/* Time Details */}
        <View style={styles.timeContainer}>
          <Text style={styles.timeLabel}>Captured</Text>
          <Text style={styles.timeValue}>{formatTime(post.timestamp)}</Text>
          <Text style={styles.dateValue}>{formatDate(post.timestamp)}</Text>
        </View>

        {/* Coordinates */}
        <View style={styles.coordsContainer}>
          <Ionicons name="globe-outline" size={16} color={colors.textMuted} />
          <Text style={styles.coords}>
            {post.latitude.toFixed(6)}, {post.longitude.toFixed(6)}
          </Text>
        </View>

        {/* Event Link */}
        {post.event_id && (
          <TouchableOpacity style={styles.eventLink} onPress={handleViewEvent}>
            <View style={styles.eventLinkLeft}>
              <Ionicons name="flame" size={18} color={colors.primary} />
              <View>
                <Text style={styles.eventLinkLabel}>Part of an event</Text>
                <Text style={styles.eventLinkText}>View all photos from this event</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {post.tags.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={22} color="#fff" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* User Info */}
        <View style={styles.userContainer}>
          <View style={styles.userAvatar}>
            <Ionicons name="person" size={20} color={colors.textMuted} />
          </View>
          <View>
            <Text style={styles.userName}>{post.user_id}</Text>
            <Text style={styles.userMeta}>Posted {formatTime(post.created_at)}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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

  // Image
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.75,
    backgroundColor: colors.card,
  },

  // Content
  content: {
    padding: 16,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  neighborhood: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  distance: {
    fontSize: 14,
    color: colors.textMuted,
  },

  // Caption
  caption: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: 20,
  },

  // Time
  timeContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  timeLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 14,
    color: colors.textMuted,
  },

  // Coordinates
  coordsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  coords: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Event Link
  eventLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.2)',
  },
  eventLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventLinkLabel: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  eventLinkText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Tags
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  tag: {
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 13,
    color: colors.primary,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
  },

  // User
  userContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  userMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
