/**
 * Utility functions
 */

import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';

// ============== Time Formatting ==============

export function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  return formatDistanceToNow(date, { addSuffix: true });
}

export function formatTime(timestamp) {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  
  if (isToday(date)) {
    return `Today at ${format(date, 'h:mm a')}`;
  }
  
  if (isYesterday(date)) {
    return `Yesterday at ${format(date, 'h:mm a')}`;
  }
  
  return format(date, 'MMM d, h:mm a');
}

export function formatDate(timestamp) {
  if (!timestamp) return '';
  return format(new Date(timestamp), 'MMMM d, yyyy');
}

// ============== Distance ==============

export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180;
  
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

export function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

export function getDistanceFromUser(location, userLocation) {
  if (!location || !userLocation) return null;
  
  const distance = haversineDistance(
    userLocation.latitude,
    userLocation.longitude,
    location.latitude || location.center_lat,
    location.longitude || location.center_lng
  );
  
  return formatDistance(distance);
}

// ============== Map ==============

export function getBoundsFromRegion(region) {
  return {
    minLat: region.latitude - region.latitudeDelta / 2,
    maxLat: region.latitude + region.latitudeDelta / 2,
    minLng: region.longitude - region.longitudeDelta / 2,
    maxLng: region.longitude + region.longitudeDelta / 2,
  };
}

export function getRegionForCoordinates(points, padding = 1.2) {
  if (!points || points.length === 0) {
    return {
      latitude: 40.7128,
      longitude: -74.0060,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }

  const lats = points.map((p) => p.latitude || p.center_lat);
  const lngs = points.map((p) => p.longitude || p.center_lng);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const midLat = (minLat + maxLat) / 2;
  const midLng = (minLng + maxLng) / 2;

  const deltaLat = (maxLat - minLat) * padding || 0.01;
  const deltaLng = (maxLng - minLng) * padding || 0.01;

  return {
    latitude: midLat,
    longitude: midLng,
    latitudeDelta: Math.max(deltaLat, 0.01),
    longitudeDelta: Math.max(deltaLng, 0.01),
  };
}

// ============== Colors ==============

export const colors = {
  primary: '#667eea',
  secondary: '#764ba2',
  background: '#0a0a0a',
  card: '#111111',
  cardHover: '#1a1a1a',
  border: '#222222',
  text: '#ffffff',
  textSecondary: '#999999',
  textMuted: '#666666',
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
  
  gradient: {
    primary: ['#667eea', '#764ba2'],
    hot: ['#f59e0b', '#ef4444'],
  },
};

// ============== Heat Score ==============

export function getHeatColor(score) {
  if (score >= 100) return '#ef4444'; // Red hot
  if (score >= 50) return '#f59e0b';  // Orange
  if (score >= 20) return '#eab308';  // Yellow
  return '#667eea'; // Default purple
}

export function getHeatEmoji(score) {
  if (score >= 100) return '🔥🔥';
  if (score >= 50) return '🔥';
  if (score >= 20) return '✨';
  return '📍';
}

// ============== Validation ==============

export function isValidLocation(location) {
  return (
    location &&
    typeof location.latitude === 'number' &&
    typeof location.longitude === 'number' &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    location.longitude >= -180 &&
    location.longitude <= 180
  );
}

// ============== Image ==============

export function getImageDimensions(width, maxWidth = 400) {
  const aspectRatio = 4 / 3;
  const calculatedWidth = Math.min(width, maxWidth);
  return {
    width: calculatedWidth,
    height: calculatedWidth / aspectRatio,
  };
}
