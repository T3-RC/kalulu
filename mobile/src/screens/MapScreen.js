/**
 * MapScreen — posts on a native map (react-native-maps).
 */
import React from "react";
import { View, StyleSheet } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { usePosts } from "../spacetime/connect";

const NYC = { latitude: 40.7308, longitude: -73.9973, latitudeDelta: 0.08, longitudeDelta: 0.08 };

export default function MapScreen({ navigation }) {
  const posts = usePosts();
  return (
    <View style={styles.screen}>
      <MapView style={StyleSheet.absoluteFill} initialRegion={NYC}>
        {posts.map((p) => (
          <Marker
            key={String(p.id)}
            coordinate={{ latitude: p.latitude, longitude: p.longitude }}
            pinColor={p.eventId != null ? "#667eea" : "#9aa0a6"}
            title={p.neighborhood ?? "NYC"}
            description={p.caption ?? undefined}
            onCalloutPress={() => navigation.navigate("PostDetail", { id: String(p.id) })}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#0a0a0a" } });
