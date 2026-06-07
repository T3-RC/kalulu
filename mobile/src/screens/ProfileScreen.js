/**
 * ProfileScreen — your identity, following feed, reset identity.
 */
import React from "react";
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { kalulu, useFollowingFeed, signOut } from "../spacetime/connect";

export default function ProfileScreen() {
  const feed = useFollowingFeed();
  const id = kalulu.identity ? kalulu.identity.toHexString().slice(0, 12) : "—";

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>You</Text>
        <Text style={styles.meta}>id: {id}…</Text>
      </View>

      <Text style={styles.section}>Following feed</Text>
      {feed.length === 0 ? (
        <Text style={styles.metaPad}>Follow people to see their moments here.</Text>
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(p) => String(p.id)}
          numColumns={3}
          contentContainerStyle={{ padding: 6 }}
          renderItem={({ item }) => <Image source={{ uri: item.thumbnailUrl ?? item.mediaUrl }} style={styles.tile} />}
        />
      )}

      <TouchableOpacity
        style={styles.signout}
        onPress={async () => {
          await signOut();
          Alert.alert("Identity reset", "Restart the app to reconnect with a fresh identity.");
        }}
      >
        <Text style={styles.signoutText}>Reset identity</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a0a0a" },
  header: { padding: 16 },
  title: { color: "#ffffff", fontSize: 22, fontWeight: "800" },
  meta: { color: "#888888", marginTop: 4 },
  metaPad: { color: "#888888", padding: 16 },
  section: { color: "#aaaaaa", fontWeight: "700", paddingHorizontal: 16, marginTop: 8, textTransform: "uppercase", fontSize: 12 },
  tile: { flex: 1 / 3, aspectRatio: 1, margin: 3, borderRadius: 6, backgroundColor: "#161616" },
  signout: { margin: 16, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#333", alignItems: "center" },
  signoutText: { color: "#f87171", fontWeight: "700" },
});
