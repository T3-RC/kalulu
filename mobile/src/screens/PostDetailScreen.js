/**
 * PostDetailScreen — full photo, likes, and comments.
 */
import React, { useState } from "react";
import { View, Text, Image, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { usePosts, useLikes, useComments, useKalulu } from "../spacetime/connect";

export default function PostDetailScreen({ route }) {
  const id = BigInt(route.params.id);
  const posts = usePosts();
  const post = posts.find((p) => p.id === id);
  const { count, likedByMe, toggle } = useLikes(id);
  const comments = useComments(id);
  const { addComment } = useKalulu();
  const [text, setText] = useState("");

  if (!post) {
    return (
      <View style={styles.screen}>
        <Text style={styles.meta}>Post not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen}>
      <Image source={{ uri: post.mediaUrl }} style={styles.img} />
      <View style={styles.body}>
        <Text style={styles.meta}>
          {post.neighborhood ?? "NYC"} · {post.latitude.toFixed(4)}, {post.longitude.toFixed(4)}
        </Text>
        {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}

        <TouchableOpacity onPress={toggle} style={[styles.like, likedByMe && styles.liked]}>
          <Text style={styles.likeText}>♥ {count}</Text>
        </TouchableOpacity>

        <Text style={styles.section}>Comments</Text>
        {comments.length === 0 ? (
          <Text style={styles.meta}>No comments yet.</Text>
        ) : (
          comments.map((c, i) => (
            <Text key={i} style={styles.comment}>{c.content}</Text>
          ))
        )}

        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            placeholder="Add a comment"
            placeholderTextColor="#666666"
            value={text}
            onChangeText={setText}
          />
          <TouchableOpacity
            style={styles.send}
            onPress={() => {
              const t = text.trim();
              if (t) {
                addComment(id, t);
                setText("");
              }
            }}
          >
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a0a0a" },
  img: { width: "100%", aspectRatio: 1, backgroundColor: "#000" },
  body: { padding: 16 },
  meta: { color: "#888888", fontSize: 13 },
  caption: { color: "#ffffff", fontSize: 16, marginTop: 6 },
  like: { alignSelf: "flex-start", marginTop: 12, backgroundColor: "#1a1a1a", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  liked: { backgroundColor: "#667eea" },
  likeText: { color: "#ffffff", fontWeight: "700" },
  section: { color: "#aaaaaa", fontWeight: "700", marginTop: 20, marginBottom: 8, textTransform: "uppercase", fontSize: 12 },
  comment: { color: "#ffffff", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  addRow: { flexDirection: "row", marginTop: 12, gap: 8 },
  input: { flex: 1, backgroundColor: "#161616", borderWidth: 1, borderColor: "#222222", borderRadius: 10, color: "#fff", padding: 10 },
  send: { backgroundColor: "#667eea", borderRadius: 10, paddingHorizontal: 16, justifyContent: "center" },
  sendText: { color: "#fff", fontWeight: "700" },
});
