/**
 * EventsScreen — auto-detected events, hottest first.
 */
import React from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useEvents } from "../spacetime/connect";

export default function EventsScreen({ navigation }) {
  const events = useEvents();
  const sorted = [...events].sort((a, b) => Number(b.heatScore - a.heatScore));

  if (sorted.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No events yet.{"\n"}They form automatically when several photos cluster nearby.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={{ padding: 12 }}
      data={sorted}
      keyExtractor={(e) => String(e.id)}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate("EventDetail", { id: String(item.id) })}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>{item.postCount} posts · heat {Math.round(item.heatScore)} · {item.neighborhood ?? "NYC"}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a0a0a" },
  empty: { flex: 1, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { color: "#888888", textAlign: "center", lineHeight: 22 },
  row: { backgroundColor: "#161616", borderWidth: 1, borderColor: "#222222", borderRadius: 10, padding: 14, marginBottom: 10 },
  name: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
  meta: { color: "#888888", fontSize: 12, marginTop: 4 },
});
