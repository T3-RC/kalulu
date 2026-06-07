/**
 * Data fetching hooks using React Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useStore } from '../services/store';

// ============== Posts ==============

export function usePosts(params = {}) {
  return useQuery({
    queryKey: ['posts', params],
    queryFn: () => api.getPosts(params),
    staleTime: 30000, // 30 seconds
  });
}

export function usePostsByRegion(region) {
  const params = region ? {
    minLat: region.latitude - region.latitudeDelta / 2,
    maxLat: region.latitude + region.latitudeDelta / 2,
    minLng: region.longitude - region.longitudeDelta / 2,
    maxLng: region.longitude + region.longitudeDelta / 2,
  } : {};

  return usePosts(params);
}

export function usePost(id) {
  return useQuery({
    queryKey: ['post', id],
    queryFn: () => api.getPost(id),
    enabled: !!id,
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  const clearUploadDraft = useStore((state) => state.clearUploadDraft);

  return useMutation({
    mutationFn: (postData) => api.createPost(postData),
    onSuccess: () => {
      // Invalidate posts queries to refetch
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      
      // Clear the upload draft
      clearUploadDraft();
    },
  });
}

// ============== Events ==============

export function useEvents(params = {}) {
  return useQuery({
    queryKey: ['events', params],
    queryFn: () => api.getEvents(params),
    staleTime: 30000,
  });
}

export function useEventsByRegion(region) {
  const params = region ? {
    minLat: region.latitude - region.latitudeDelta / 2,
    maxLat: region.latitude + region.latitudeDelta / 2,
    minLng: region.longitude - region.longitudeDelta / 2,
    maxLng: region.longitude + region.longitudeDelta / 2,
  } : {};

  return useEvents(params);
}

export function useEvent(id) {
  return useQuery({
    queryKey: ['event', id],
    queryFn: () => api.getEvent(id, true),
    enabled: !!id,
  });
}

// ============== Neighborhoods ==============

export function useNeighborhoods() {
  return useQuery({
    queryKey: ['neighborhoods'],
    queryFn: () => api.getNeighborhoods(),
    staleTime: 300000, // 5 minutes
  });
}

// ============== Stats ==============

export function useStats() {
  const setStats = useStore((state) => state.setStats);

  return useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const stats = await api.getStats();
      setStats(stats);
      return stats;
    },
    staleTime: 60000, // 1 minute
  });
}

// ============== Feed (combined posts sorted by time) ==============

export function useFeed(limit = 50) {
  return useQuery({
    queryKey: ['feed', limit],
    queryFn: () => api.getPosts({ limit }),
    staleTime: 30000,
  });
}

// ============== Nearby ==============

export function useNearbyPosts(location, radiusKm = 1) {
  const enabled = !!location?.latitude && !!location?.longitude;
  
  // Convert km to approximate degree delta
  const delta = radiusKm / 111; // ~111km per degree

  return useQuery({
    queryKey: ['nearby', location?.latitude, location?.longitude, radiusKm],
    queryFn: () => api.getPosts({
      minLat: location.latitude - delta,
      maxLat: location.latitude + delta,
      minLng: location.longitude - delta,
      maxLng: location.longitude + delta,
      limit: 100,
    }),
    enabled,
    staleTime: 30000,
  });
}

export function useNearbyEvents(location, radiusKm = 2) {
  const enabled = !!location?.latitude && !!location?.longitude;
  const delta = radiusKm / 111;

  return useQuery({
    queryKey: ['nearbyEvents', location?.latitude, location?.longitude, radiusKm],
    queryFn: () => api.getEvents({
      minLat: location.latitude - delta,
      maxLat: location.latitude + delta,
      minLng: location.longitude - delta,
      maxLng: location.longitude + delta,
      limit: 20,
    }),
    enabled,
    staleTime: 30000,
  });
}
