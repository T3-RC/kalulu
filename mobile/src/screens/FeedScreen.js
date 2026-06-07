/**
 * FeedScreen - Chronological feed of all posts
 */

import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Text,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../services/api';
import { useFeed } from '../hooks/useData';
import { useCurrentLocation } from '../hooks/useLocation';
import { colors, formatTimeAgo, getDistanceFromUser } from '../utils/helpers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_WIDTH = SCREEN_WIDTH - 32;
const IMAGE_HEIGHT = IMAGE_WIDTH * 0.75;

// Post Card Component
function PostCard({ post, onPress, userLocation }) {
  const distance = getDistanceFromUser(post, userLocation);
  
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(post)} activeOpacity={0.9}>
      <Image
        source={{ uri: api.getMediaUrl(post.media_url) }}
        style={styles.cardImage}
        resizeMode="cover"
      />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.locationContainer}>
            <Ionicons name="location" size={14} color={colors.primary} />
            <Text style={styles.neighborhood}>{post.neighborhood || 'NYC'}</Text>
            {distance && (
              <Text style={styles.distance}>· {distance}</Text>
            )}
          </View>
          <Text style={styles.time}>{formatTimeAgo(post.timestamp)}</Text>
        </View>
        
        {post.caption && (
          <Text style={styles.caption} numberOfLines={2}>{post.caption}</Text>
        )}
        
        {post.event_id && (
          <View style={styles.eventBadge}>
            <Ionicons name="flame" size={12} color={colors.primary} />
            <Text style={styles.eventBadgeText}>Part of an event</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// Empty State Component
function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📸</Text>
      <Text style={styles.emptyTitle}>No posts yet</Text>
      <Text style={styles.emptySubtitle}>Be the first to share a moment!</Text>
    </View>
  );
}

export default function FeedScreen({ navigation }) {
  const { data: posts = [], isLoading, refetch } = useFeed(100);
  const { location } = useCurrentLocation();

  const onPostPress = useCallback((post) => {
    navigation.navigate('PostDetail', { postId: post.id });
  }, [navigation]);

  const renderPost = useCallback(({ item }) => (
    <PostCard 
      post={item} 
      onPress={onPostPress}
      userLocation={location}
    />
  ), [onPostPress, location]);

  const keyExtractor = useCallback((item) => item.id, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={!isLoading && <EmptyState />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  separator: {
    height: 16,
  },

  // Card
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardImage: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    backgroundColor: colors.cardHover,
  },
  cardContent: {
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  neighborhood: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  distance: {
    fontSize: 13,
    color: colors.textMuted,
  },
  time: {
    fontSize: 12,
    color: colors.textMuted,
  },
  caption: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    lineHeight: 20,
  },
  eventBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(102, 126, 234, 0.15)',
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  eventBadgeText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
