/**
 * EventsScreen - List of auto-detected events
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../services/api';
import { useEvents, useNeighborhoods } from '../hooks/useData';
import { useCurrentLocation } from '../hooks/useLocation';
import { colors, formatTimeAgo, getHeatEmoji, getHeatColor, getDistanceFromUser } from '../utils/helpers';

// Event Card Component
function EventCard({ event, onPress, userLocation }) {
  const distance = getDistanceFromUser(event, userLocation);
  const heatColor = getHeatColor(event.heat_score);
  
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(event)} activeOpacity={0.9}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.eventName}>{event.name}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="location" size={12} color={colors.textMuted} />
            <Text style={styles.metaText}>{event.neighborhood || 'NYC'}</Text>
            {distance && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>{distance}</Text>
              </>
            )}
          </View>
        </View>
        <View style={[styles.heatBadge, { backgroundColor: `${heatColor}20` }]}>
          <Text style={styles.heatEmoji}>{getHeatEmoji(event.heat_score)}</Text>
          <Text style={[styles.heatScore, { color: heatColor }]}>
            {Math.round(event.heat_score)}
          </Text>
        </View>
      </View>
      
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="images" size={14} color={colors.primary} />
          <Text style={styles.statText}>{event.post_count} photos</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="time" size={14} color={colors.textMuted} />
          <Text style={styles.statText}>{formatTimeAgo(event.start_time)}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.viewText}>View event</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
      </View>
    </TouchableOpacity>
  );
}

// Neighborhood Filter Pills
function NeighborhoodFilters({ neighborhoods, selected, onSelect }) {
  return (
    <FlatList
      horizontal
      data={[{ name: 'All', post_count: 0 }, ...neighborhoods]}
      keyExtractor={(item) => item.name}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filtersContainer}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[
            styles.filterPill,
            (selected === item.name || (selected === null && item.name === 'All')) && styles.filterPillActive
          ]}
          onPress={() => onSelect(item.name === 'All' ? null : item.name)}
        >
          <Text style={[
            styles.filterPillText,
            (selected === item.name || (selected === null && item.name === 'All')) && styles.filterPillTextActive
          ]}>
            {item.name}
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}

// Empty State Component
function EmptyState({ hasFilter }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🎉</Text>
      <Text style={styles.emptyTitle}>
        {hasFilter ? 'No events here' : 'No events yet'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {hasFilter 
          ? 'Try another neighborhood or check back later'
          : 'Events auto-detect when multiple people share from the same place'}
      </Text>
    </View>
  );
}

export default function EventsScreen({ navigation }) {
  const [selectedHood, setSelectedHood] = useState(null);
  
  const { location } = useCurrentLocation();
  const { data: neighborhoods = [] } = useNeighborhoods();
  const { data: events = [], isLoading, refetch } = useEvents({
    neighborhood: selectedHood,
    limit: 50,
  });

  const onEventPress = useCallback((event) => {
    navigation.navigate('EventDetail', { eventId: event.id });
  }, [navigation]);

  const renderEvent = useCallback(({ item }) => (
    <EventCard 
      event={item} 
      onPress={onEventPress}
      userLocation={location}
    />
  ), [onEventPress, location]);

  const keyExtractor = useCallback((item) => item.id, []);

  return (
    <View style={styles.container}>
      {/* Neighborhood Filters */}
      {neighborhoods.length > 0 && (
        <NeighborhoodFilters
          neighborhoods={neighborhoods}
          selected={selectedHood}
          onSelect={setSelectedHood}
        />
      )}

      {/* Events List */}
      <FlatList
        data={events}
        renderItem={renderEvent}
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
        ListEmptyComponent={!isLoading && <EmptyState hasFilter={!!selectedHood} />}
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
  
  // Filters
  filtersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  filterPillTextActive: {
    color: '#fff',
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  separator: {
    height: 12,
  },

  // Card
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardInfo: {
    flex: 1,
    marginRight: 12,
  },
  eventName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  metaDot: {
    fontSize: 13,
    color: colors.textMuted,
    marginHorizontal: 2,
  },
  heatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  heatEmoji: {
    fontSize: 12,
  },
  heatScore: {
    fontSize: 14,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  viewText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
