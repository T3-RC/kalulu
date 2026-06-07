/**
 * EventDetailScreen — an event + its photos.
 */
import React from "react";
import { View, Text, FlatList, Image, StyleSheet } from "react-native";
import { useEvent } from "../spacetime/connect";

export default function EventDetailScreen({ route }) {
  const id = BigInt(route.params.id);
  const { event, posts } = useEvent(id);

  return (
    <FlatList
      style={styles.screen}
      numColumns={2}
      contentContainerStyle={{ padding: 8 }}
      ListHeaderComponent={
        event ? (
          <View style={styles.header}>
            <Text style={styles.name}>{event.name}</Text>
            <Text style={styles.meta}>{event.postCount} posts · {event.neighborhood ?? "NYC"}</Text>
          </View>
        ) : null
      }
      data={posts}
      keyExtractor={(p) => String(p.id)}
      renderItem={({ item }) => (
        <Image source={{ uri: item.thumbnailUrl ?? item.mediaUrl }} style={styles.tile} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a0a0a" },
  header: { padding: 8, paddingBottom: 4 },
  name: { color: "#ffffff", fontWeight: "700", fontSize: 18 },
  meta: { color: "#888888", marginTop: 4 },
  tile: { flex: 1, aspectRatio: 1, margin: 4, borderRadius: 8, backgroundColor: "#161616" },
});
