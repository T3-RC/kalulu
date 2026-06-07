/**
 * useLocation hook - handles location permissions and tracking
 */

import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { useStore } from '../services/store';

export function useCurrentLocation() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const location = useStore((state) => state.location);
  const setLocation = useStore((state) => state.setLocation);

  // Request permissions and get current location
  const requestLocation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setError('Location permission denied');
        return null;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const locationData = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        accuracy: currentLocation.coords.accuracy,
        timestamp: currentLocation.timestamp,
      };

      setLocation(locationData);
      return locationData;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [setLocation]);

  // Get location on mount
  useEffect(() => {
    if (!location) {
      requestLocation();
    }
  }, []);

  return {
    location,
    loading,
    error,
    requestLocation,
  };
}

// Hook for watching location continuously
export function useWatchLocation(enabled = true) {
  const [subscription, setSubscription] = useState(null);
  const setLocation = useStore((state) => state.setLocation);

  useEffect(() => {
    let sub = null;

    const startWatching = async () => {
      if (!enabled) return;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (newLocation) => {
          setLocation({
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
            accuracy: newLocation.coords.accuracy,
            timestamp: newLocation.timestamp,
          });
        }
      );
      setSubscription(sub);
    };

    startWatching();

    return () => {
      if (sub) {
        sub.remove();
      }
    };
  }, [enabled, setLocation]);

  return subscription;
}

// Reverse geocoding hook
export function useReverseGeocode(latitude, longitude) {
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const geocode = async () => {
      if (!latitude || !longitude) return;
      
      setLoading(true);
      try {
        const results = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });

        if (results.length > 0) {
          const result = results[0];
          setAddress({
            street: result.street,
            neighborhood: result.subregion || result.district,
            city: result.city,
            region: result.region,
            postalCode: result.postalCode,
            formatted: [
              result.street,
              result.subregion || result.district,
              result.city,
            ].filter(Boolean).join(', '),
          });
        }
      } catch (err) {
        console.error('Geocoding error:', err);
      } finally {
        setLoading(false);
      }
    };

    geocode();
  }, [latitude, longitude]);

  return { address, loading };
}
