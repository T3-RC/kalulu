import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { useKaluluConnection, usePosts, useEvents, useLikes, useKalulu } from "@client/hooks";
import type { Post, EventRow } from "@client/kalulu";
import { uploadImage, bestEffortCaptureTime } from "./upload";
import exifr from "exifr";
import { LocationPicker } from "./LocationPicker";

const NYC: [number, number] = [40.7308, -73.9973];

const CONNECT_CFG = {
  uri: import.meta.env.VITE_STDB_URI as string,
  dbName: import.meta.env.VITE_STDB_DB as string,
  token: localStorage.getItem("stdb_token") ?? undefined,
  onToken: (t: string) => localStorage.setItem("stdb_token", t),
};

export default function App() {
  const { connected } = useKaluluConnection(CONNECT_CFG);
  const posts = usePosts();
  const events = useEvents();
  const [selected, setSelected] = useState<Post | null>(null);

  return (
    <div className="app">
      <header className="topbar">
        <h1>🌆 Kalulu</h1>
        <span className={connected ? "status ok" : "status"}>
          {connected ? "live" : "connecting…"}
        </span>
      </header>

      <div className="layout">
        <MapView posts={posts} events={events} onSelect={setSelected} />
        <aside className="sidebar">
          <UploadPanel />
          <h2>Events ({events.length})</h2>
          <ul className="events">
            {events
              .slice()
              .sort((a, b) => Number(b.heatScore - a.heatScore))
              .map((e) => (
                <li key={String(e.id)}>
                  <strong>{e.name}</strong>
                  <span>
                    {e.postCount} posts · heat {Math.round(e.heatScore)}
                  </span>
                </li>
              ))}
          </ul>

          <h2>Feed ({posts.length})</h2>
          <div className="feed">
            {posts
              .slice()
              .sort((a, b) => Number(b.id - a.id))
              .map((p) => (
                <PostCard key={String(p.id)} post={p} onOpen={() => setSelected(p)} />
              ))}
          </div>
        </aside>
      </div>

      {selected && <PostModal post={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function MapView({ posts, events, onSelect }: { posts: Post[]; events: EventRow[]; onSelect: (p: Post) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (mapRef.current || !ref.current) return;
    const map = L.map(ref.current).setView(NYC, 13);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "© OpenStreetMap, © CARTO",
      maxZoom: 20,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    // Event "heat" circles sit under the post markers.
    for (const e of events) {
      L.circle([e.centerLat, e.centerLng], {
        radius: Math.max(e.radiusMeters, 80),
        color: "#667eea",
        weight: 1,
        opacity: 0.5,
        fillColor: "#667eea",
        fillOpacity: Math.min(0.06 + e.heatScore / 600, 0.3),
      })
        .bindTooltip(e.name)
        .addTo(layer);
    }
    for (const p of posts) {
      const marker = L.circleMarker([p.latitude, p.longitude], {
        radius: 6,
        color: p.eventId != null ? "#667eea" : "#aaaaaa",
        fillColor: p.eventId != null ? "#667eea" : "#888888",
        fillOpacity: 0.8,
        weight: 1,
      });
      marker.on("click", () => onSelect(p));
      if (p.caption) marker.bindTooltip(p.caption);
      marker.addTo(layer);
    }
  }, [posts, events, onSelect]);

  return <div className="map" ref={ref} />;
}

function PostCard({ post, onOpen }: { post: Post; onOpen: () => void }) {
  const { count, likedByMe, toggle } = useLikes(post.id);
  const thumb = post.thumbnailUrl ?? post.mediaUrl;
  return (
    <div className="card">
      <img src={thumb} alt={post.caption ?? "post"} loading="lazy" onClick={onOpen} />
      <div className="card-body">
        <div className="meta">{post.neighborhood ?? "NYC"}</div>
        {post.caption && <p>{post.caption}</p>}
        <button className={likedByMe ? "like liked" : "like"} onClick={toggle}>
          ♥ {count}
        </button>
      </div>
    </div>
  );
}

function PostModal({ post, onClose }: { post: Post; onClose: () => void }) {
  const { count, likedByMe, toggle } = useLikes(post.id);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <img src={post.mediaUrl} alt={post.caption ?? "post"} />
        <div className="modal-body">
          <div className="meta">
            {post.neighborhood ?? "NYC"} · {post.latitude.toFixed(4)}, {post.longitude.toFixed(4)}
          </div>
          {post.caption && <p>{post.caption}</p>}
          <button className={likedByMe ? "like liked" : "like"} onClick={toggle}>
            ♥ {count}
          </button>
          <button className="close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadPanel() {
  const { createPost } = useKalulu();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: NYC[0], lng: NYC[1] });
  const [locSource, setLocSource] = useState<string>("");
  const [captureTime, setCaptureTime] = useState<Date>(new Date());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError(null);
    if (!f) return;
    setCaptureTime(bestEffortCaptureTime(f));

    // Prefer the photo's own EXIF GPS + capture time.
    try {
      const meta = await exifr.parse(f, ["GPSLatitude", "GPSLongitude", "DateTimeOriginal"]).catch(() => null);
      const gps = await exifr.gps(f).catch(() => null);
      if (meta?.DateTimeOriginal) setCaptureTime(new Date(meta.DateTimeOriginal));
      if (gps && typeof gps.latitude === "number") {
        setCoords({ lat: gps.latitude, lng: gps.longitude });
        setLocSource("📍 location read from the photo");
        return;
      }
    } catch {
      /* ignore */
    }

    // No GPS in the photo (e.g. downloaded from Google Photos) — fall back to
    // device location and let the user drag the pin.
    setLocSource("This photo has no GPS — drag the pin to where it was taken.");
    navigator.geolocation?.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setCoords({ lat: NYC[0], lng: NYC[1] }),
      { timeout: 5000 },
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { publicUrl } = await uploadImage(file);
      createPost(publicUrl, coords.lat, coords.lng, captureTime, caption || undefined);
      setFile(null);
      setCaption("");
      setLocSource("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="upload" onSubmit={handleSubmit}>
      <h2>Share a moment</h2>
      <input ref={fileRef} type="file" accept="image/*" required onChange={onPick} />
      {file && (
        <>
          <LocationPicker value={coords} onChange={setCoords} />
          {locSource && <div className="meta">{locSource}</div>}
        </>
      )}
      <input
        type="text"
        placeholder="Caption (optional)"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
      />
      <button type="submit" disabled={busy}>
        {busy ? "Uploading…" : "Post"}
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  );
}
