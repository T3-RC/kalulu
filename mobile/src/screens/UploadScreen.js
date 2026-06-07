/**
 * UploadScreen — pick a photo, upload to Cloudinary, create a post (SpacetimeDB).
 */
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Alert, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { uploadImageAsync } from "../services/cloudinary";
import { useKalulu } from "../spacetime/connect";

const NYC = { lat: 40.7308, lng: -73.9973 };

export default function UploadScreen({ navigation }) {
  const { createPost } = useKalulu();
  const [image, setImage] = useState(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);

  async function pick() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo access to share a moment.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!res.canceled) setImage(res.assets[0]);
  }

  async function getLocation() {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return NYC;
      const pos = await Location.getCurrentPositionAsync({});
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      return NYC;
    }
  }

  async function submit() {
    if (!image) {
      Alert.alert("Pick a photo first");
      return;
    }
    setBusy(true);
    try {
      const { publicUrl } = await uploadImageAsync(image.uri);
      const loc = await getLocation();
      createPost(publicUrl, loc.lat, loc.lng, new Date(), caption || undefined);
      setImage(null);
      setCaption("");
      Alert.alert("Shared!", "Your moment is live.");
      navigation.navigate("Feed");
    } catch (e) {
      Alert.alert("Upload failed", String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <TouchableOpacity style={styles.picker} onPress={pick} activeOpacity={0.8}>
        {image ? (
          <Image source={{ uri: image.uri }} style={styles.preview} />
        ) : (
          <Text style={styles.pickText}>＋ Pick a photo</Text>
        )}
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Caption (optional)"
        placeholderTextColor="#666666"
        value={caption}
        onChangeText={setCaption}
      />

      <TouchableOpacity style={[styles.btn, busy && styles.btnDisabled]} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Share moment</Text>}
      </TouchableOpacity>

      <Text style={styles.hint}>Your location is attached so the moment lands on the map.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a0a0a", padding: 16 },
  picker: { height: 280, borderRadius: 12, borderWidth: 1, borderColor: "#222222", backgroundColor: "#161616", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  preview: { width: "100%", height: "100%" },
  pickText: { color: "#667eea", fontSize: 16, fontWeight: "600" },
  input: { marginTop: 14, backgroundColor: "#161616", borderWidth: 1, borderColor: "#222222", borderRadius: 10, color: "#fff", padding: 12 },
  btn: { marginTop: 14, backgroundColor: "#667eea", borderRadius: 10, padding: 14, alignItems: "center" },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  hint: { color: "#666666", fontSize: 12, marginTop: 12, textAlign: "center" },
});
