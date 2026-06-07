/**
 * ProfileScreen - User profile and settings
 */

import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../services/store';
import { useStats } from '../hooks/useData';
import { colors } from '../utils/helpers';
import { api } from '../services/api';

// Menu Item Component
function MenuItem({ icon, label, value, onPress, showArrow = true }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} disabled={!onPress}>
      <View style={styles.menuItemLeft}>
        <View style={styles.menuIconContainer}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
        <Text style={styles.menuLabel}>{label}</Text>
      </View>
      <View style={styles.menuItemRight}>
        {value && <Text style={styles.menuValue}>{value}</Text>}
        {showArrow && onPress && (
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        )}
      </View>
    </TouchableOpacity>
  );
}

// Stats Card Component
function StatsCard({ stats }) {
  return (
    <View style={styles.statsCard}>
      <Text style={styles.statsTitle}>Platform Stats</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats?.total_posts || 0}</Text>
          <Text style={styles.statLabel}>Total Posts</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats?.total_events || 0}</Text>
          <Text style={styles.statLabel}>Events</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats?.neighborhoods_active || 0}</Text>
          <Text style={styles.statLabel}>Neighborhoods</Text>
        </View>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { data: stats } = useStats();
  const user = useStore((state) => state.user);

  const handleServerSettings = () => {
    Alert.prompt(
      'API Server URL',
      'Enter your backend server URL',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: (url) => {
            if (url) {
              api.setBaseUrl(url);
              Alert.alert('Saved', `Server set to ${url}`);
            }
          },
        },
      ],
      'plain-text',
      api.baseUrl
    );
  };

  const handleAbout = () => {
    Alert.alert(
      'About Kalulu',
      'The living memory of your city.\n\nVersion 1.0.0\n\nBuilt with ❤️ in NYC',
      [{ text: 'OK' }]
    );
  };

  const handleFeedback = () => {
    Linking.openURL('mailto:feedback@kalulu.app?subject=Kalulu%20Feedback');
  };

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
    >
      {/* User Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color={colors.textMuted} />
          </View>
        </View>
        <Text style={styles.username}>{user.username || 'Anonymous'}</Text>
        <Text style={styles.userId}>ID: {user.id}</Text>
      </View>

      {/* Stats */}
      <StatsCard stats={stats} />

      {/* Menu Sections */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.menuGroup}>
          <MenuItem
            icon="server-outline"
            label="API Server"
            value="localhost:8000"
            onPress={handleServerSettings}
          />
          <MenuItem
            icon="notifications-outline"
            label="Notifications"
            value="On"
            onPress={() => Alert.alert('Coming soon', 'Notification settings will be available in a future update')}
          />
          <MenuItem
            icon="location-outline"
            label="Location"
            value="While using"
            onPress={() => Linking.openSettings()}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.menuGroup}>
          <MenuItem
            icon="information-circle-outline"
            label="About Kalulu"
            onPress={handleAbout}
          />
          <MenuItem
            icon="chatbubble-outline"
            label="Send Feedback"
            onPress={handleFeedback}
          />
          <MenuItem
            icon="document-text-outline"
            label="Privacy Policy"
            onPress={() => Linking.openURL('https://kalulu.app/privacy')}
          />
          <MenuItem
            icon="shield-checkmark-outline"
            label="Terms of Service"
            onPress={() => Linking.openURL('https://kalulu.app/terms')}
          />
        </View>
      </View>

      {/* Version */}
      <View style={styles.footer}>
        <Text style={styles.version}>Version 1.0.0 (MVP)</Text>
        <Text style={styles.copyright}>© 2024 Kalulu</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.primary,
  },
  username: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  userId: {
    fontSize: 13,
    color: colors.textMuted,
  },

  // Stats Card
  statsCard: {
    margin: 16,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
  },
  statsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },

  // Sections
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  menuGroup: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Menu Items
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(102, 126, 234, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    fontSize: 15,
    color: '#fff',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuValue: {
    fontSize: 14,
    color: colors.textMuted,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  version: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 4,
  },
  copyright: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
