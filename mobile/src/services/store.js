/**
 * Kalulu Global State Store (Zustand)
 */

import { create } from 'zustand';

export const useStore = create((set, get) => ({
  // User state
  user: {
    id: 'anonymous',
    username: null,
    avatar: null,
  },
  setUser: (user) => set({ user }),

  // Current location
  location: null,
  setLocation: (location) => set({ location }),

  // Map region (for syncing between screens)
  mapRegion: {
    latitude: 40.7128,
    longitude: -74.0060,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  },
  setMapRegion: (region) => set({ mapRegion: region }),

  // Selected event/post for detail views
  selectedEvent: null,
  setSelectedEvent: (event) => set({ selectedEvent: event }),
  
  selectedPost: null,
  setSelectedPost: (post) => set({ selectedPost: post }),

  // Upload state
  uploadDraft: {
    image: null,
    location: null,
    caption: '',
    tags: [],
  },
  setUploadDraft: (draft) => set((state) => ({
    uploadDraft: { ...state.uploadDraft, ...draft }
  })),
  clearUploadDraft: () => set({
    uploadDraft: {
      image: null,
      location: null,
      caption: '',
      tags: [],
    }
  }),

  // Filter state
  filters: {
    neighborhood: null,
    timeRange: 'all', // 'today', 'week', 'month', 'all'
  },
  setFilters: (filters) => set((state) => ({
    filters: { ...state.filters, ...filters }
  })),

  // UI state
  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),
  
  error: null,
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  // Stats cache
  stats: {
    total_posts: 0,
    total_events: 0,
    neighborhoods_active: 0,
  },
  setStats: (stats) => set({ stats }),
}));

// Selector hooks for convenience
export const useUser = () => useStore((state) => state.user);
export const useLocation = () => useStore((state) => state.location);
export const useMapRegion = () => useStore((state) => state.mapRegion);
export const useUploadDraft = () => useStore((state) => state.uploadDraft);
export const useFilters = () => useStore((state) => state.filters);
export const useStats = () => useStore((state) => state.stats);
