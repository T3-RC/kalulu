/**
 * Kalulu API Service
 * Handles all communication with the backend
 */

// Change this to your backend URL
// For local development with Expo Go, use your computer's IP address
// e.g., 'http://192.168.1.100:8000'
const API_BASE_URL = 'http://localhost:8000';

class ApiService {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // Set the base URL (useful for switching between dev/prod)
  setBaseUrl(url) {
    this.baseUrl = url;
  }

  // Generic fetch wrapper with error handling
  async fetch(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Accept': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error.message);
      throw error;
    }
  }

  // ============== Posts ==============

  async getPosts({ minLat, maxLat, minLng, maxLng, eventId, neighborhood, limit = 100, offset = 0 } = {}) {
    const params = new URLSearchParams();
    
    if (minLat !== undefined) params.append('min_lat', minLat);
    if (maxLat !== undefined) params.append('max_lat', maxLat);
    if (minLng !== undefined) params.append('min_lng', minLng);
    if (maxLng !== undefined) params.append('max_lng', maxLng);
    if (eventId) params.append('event_id', eventId);
    if (neighborhood) params.append('neighborhood', neighborhood);
    params.append('limit', limit);
    params.append('offset', offset);

    return this.fetch(`/posts?${params.toString()}`);
  }

  async getPost(id) {
    return this.fetch(`/posts/${id}`);
  }

  async createPost({ file, latitude, longitude, timestamp, caption, tags, userId = 'anonymous' }) {
    const formData = new FormData();
    
    // Add the image file
    formData.append('file', {
      uri: file.uri,
      type: file.type || 'image/jpeg',
      name: file.name || 'photo.jpg',
    });
    
    formData.append('latitude', latitude.toString());
    formData.append('longitude', longitude.toString());
    formData.append('timestamp', timestamp || new Date().toISOString());
    
    if (caption) formData.append('caption', caption);
    if (tags) formData.append('tags', JSON.stringify(tags));
    formData.append('user_id', userId);

    const response = await fetch(`${this.baseUrl}/posts`, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Upload failed');
    }

    return response.json();
  }

  // ============== Events ==============

  async getEvents({ minLat, maxLat, minLng, maxLng, neighborhood, includePosts = false, limit = 50 } = {}) {
    const params = new URLSearchParams();
    
    if (minLat !== undefined) params.append('min_lat', minLat);
    if (maxLat !== undefined) params.append('max_lat', maxLat);
    if (minLng !== undefined) params.append('min_lng', minLng);
    if (maxLng !== undefined) params.append('max_lng', maxLng);
    if (neighborhood) params.append('neighborhood', neighborhood);
    params.append('include_posts', includePosts);
    params.append('limit', limit);

    return this.fetch(`/events?${params.toString()}`);
  }

  async getEvent(id, includePosts = true) {
    return this.fetch(`/events/${id}?include_posts=${includePosts}`);
  }

  // ============== Neighborhoods ==============

  async getNeighborhoods() {
    return this.fetch('/neighborhoods');
  }

  // ============== Stats ==============

  async getStats() {
    return this.fetch('/stats');
  }

  // ============== Clustering ==============

  async triggerClustering() {
    return this.fetch('/cluster', { method: 'POST' });
  }

  // ============== Helpers ==============

  getMediaUrl(path) {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${this.baseUrl}${path}`;
  }
}

// Export singleton instance
export const api = new ApiService();

// Export class for testing/custom instances
export default ApiService;
