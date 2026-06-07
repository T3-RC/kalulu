// Polyfills MUST load before anything that touches the SpacetimeDB SDK.
import "./src/polyfills";

import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { ensureConnected, kalulu } from "./src/spacetime/connect";
import MapScreen from "./src/screens/MapScreen";
import FeedScreen from "./src/screens/FeedScreen";
import UploadScreen from "./src/screens/UploadScreen";
import EventsScreen from "./src/screens/EventsScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import EventDetailScreen from "./src/screens/EventDetailScreen";
import PostDetailScreen from "./src/screens/PostDetailScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: "#667eea",
    background: "#0a0a0a",
    card: "#111111",
    text: "#ffffff",
    border: "#222222",
    notification: "#667eea",
  },
};

const ICONS = { Map: "map", Feed: "grid", Upload: "add-circle", Events: "flame", Profile: "person" };

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: "#111111" },
        headerTintColor: "#ffffff",
        tabBarStyle: { backgroundColor: "#111111", borderTopColor: "#222222" },
        tabBarActiveTintColor: "#667eea",
        tabBarInactiveTintColor: "#666666",
        tabBarIcon: ({ color, size }) => <Ionicons name={ICONS[route.name] || "ellipse"} size={size} color={color} />,
      })}
    >
      <Tab.Screen name="Map" component={MapScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Feed" component={FeedScreen} options={{ title: "Kalulu" }} />
      <Tab.Screen name="Upload" component={UploadScreen} options={{ title: "Share" }} />
      <Tab.Screen name="Events" component={EventsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function useConnection() {
  const [connected, setConnected] = useState(kalulu.connected);
  const [error, setError] = useState(null);
  useEffect(() => {
    const off = kalulu.onChange(() => setConnected(kalulu.connected));
    ensureConnected().catch((e) => setError(e?.message ?? String(e)));
    return off;
  }, []);
  return { connected, error };
}

export default function App() {
  const { connected, error } = useConnection();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {!connected ? (
          <View style={styles.center}>
            <ActivityIndicator color="#667eea" size="large" />
            <Text style={styles.muted}>{error ? `Connection error:\n${error}` : "Connecting to Kalulu…"}</Text>
          </View>
        ) : (
          <NavigationContainer theme={theme}>
            <Stack.Navigator
              screenOptions={{ headerStyle: { backgroundColor: "#111111" }, headerTintColor: "#fff" }}
            >
              <Stack.Screen name="Main" component={Tabs} options={{ headerShown: false }} />
              <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: "Event" }} />
              <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: "Moment" }} />
            </Stack.Navigator>
          </NavigationContainer>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center", padding: 24 },
  muted: { color: "#888888", marginTop: 14, textAlign: "center" },
});
