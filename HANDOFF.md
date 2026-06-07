# KALULU: AI Agent Development Handoff Document

**Project:** Kalulu - Event-Based Social Media Platform
**Status:** MVP Complete, Production Build Phase
**Database:** Migrating to SpacetimeDB
**Target:** SpacetimeDB 1.x / 2.0 (current stable API)
**Last Updated:** June 2026

> **Note on this revision:** The SpacetimeDB code in this document was updated to the
> current SpacetimeDB API. Earlier drafts used the deprecated `#[spacetimedb(table)]` /
> `#[spacetimedb(reducer)]` macros, the `Post::insert()` static-method style, and the
> `@spacetimedb/sdk` npm package — none of which exist in current SpacetimeDB. Because the
> SDK still evolves, always confirm snippets against the official docs at
> https://spacetimedb.com/docs before building.

---

## TABLE OF CONTENTS

1. [Project Vision](#1-project-vision)
2. [Core Concepts](#2-core-concepts)
3. [Technical Architecture](#3-technical-architecture)
4. [SpacetimeDB Strategy](#4-spacetimedb-strategy)
5. [Current Codebase](#5-current-codebase)
6. [What Needs Building](#6-what-needs-building)
7. [Coding Guidelines](#7-coding-guidelines)
8. [Step-by-Step Build Instructions](#8-step-by-step-build-instructions)
9. [Testing & Validation](#9-testing--validation)
10. [Common Pitfalls](#10-common-pitfalls)

---

## 1. PROJECT VISION

### The Core Idea

Kalulu is "the living memory of your city" — a social media platform where:

1. **Users upload photos** with exact location (GPS) and timestamp
2. **AI auto-clusters** nearby photos into "events" (raves, protests, weather events, etc.)
3. **Anyone can explore** the city through everyone's collective memories
4. **Serendipitous discovery** — find people who were at the same events as you

### What Makes It Different

| Traditional Social Media | Kalulu |
|-------------------------|--------|
| Personal feeds ("look at me") | Shared experiences ("look at what WE lived") |
| Followers/following centric | Location and event centric |
| Algorithmic timeline | Spatial + temporal exploration |
| Isolated moments | Collective memory of places |

### Target Market

- **Primary:** NYC (flagship market)
- **Users:** Festival-goers, nightlife enthusiasts, urban explorers (18-35)
- **Expansion:** LA, Chicago, Miami, then international (London, Berlin, Tokyo)

### Two Core Experiences

1. **Collaborative Memory-Making** — Everyone at an event contributes to a shared album
2. **Serendipitous Social Discovery** — "You were at the same rave as @user but never met"

---

## 2. CORE CONCEPTS

### 2.1 Posts

A post is a single photo with metadata:

```
Post {
  id: string
  user_id: string
  media_url: string
  latitude: float (-90 to 90)
  longitude: float (-180 to 180)
  timestamp: datetime (when photo was taken)
  caption: string (optional)
  neighborhood: string (auto-detected, e.g., "Williamsburg")
  event_id: string (null if not clustered yet)
  visibility: "public" | "private" | "hidden"
  tags: string[]
}
```

### 2.2 Events

An event is an auto-detected cluster of posts:

```
Event {
  id: string
  name: string (auto-generated, e.g., "East Village Night - Jan 15")
  center_lat: float
  center_lng: float
  radius_meters: float
  start_time: datetime
  end_time: datetime
  post_count: int
  heat_score: float (engagement metric)
  neighborhood: string
}
```

### 2.3 Event Detection Algorithm

We use DBSCAN (Density-Based Spatial Clustering):

```
ALGORITHM: Auto-cluster posts into events

INPUT: Posts from last 24 hours without event_id

PROCESS:
1. Convert (lat, lng) to meters:
   - lat_meters = lat * 111,000
   - lng_meters = lng * 85,000 (at NYC latitude)

2. Normalize time (1 hour = 100 "meters" equivalent)

3. Run DBSCAN:
   - eps = 150 (meters spatial + time factor)
   - min_samples = 3 (minimum posts to form event)

4. For each cluster:
   - Calculate center (mean lat/lng)
   - Calculate radius (max distance from center)
   - Generate name: "{neighborhood} {time_of_day} - {date}"
   - Assign event_id to all posts in cluster

OUTPUT: New event records + updated post.event_id
```

### 2.4 Neighborhoods

NYC neighborhoods are detected by bounding box:

```
neighborhoods = {
  "East Village": {min_lat: 40.72, max_lat: 40.735, min_lng: -73.995, max_lng: -73.975},
  "Williamsburg": {min_lat: 40.705, max_lat: 40.725, min_lng: -73.97, max_lng: -73.935},
  "Bushwick": {min_lat: 40.685, max_lat: 40.71, min_lng: -73.935, max_lng: -73.905},
  // ... 12 total neighborhoods
}

FUNCTION get_neighborhood(lat, lng):
  FOR each neighborhood:
    IF point_in_bounds(lat, lng, bounds):
      RETURN neighborhood.name
  RETURN "NYC" (default)
```

---

## 3. TECHNICAL ARCHITECTURE

### 3.1 Current Stack (MVP)

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
│     React Native (iOS/Android)     Web (Leaflet + Vanilla)   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                           │
│  • REST API                                                  │
│  • JWT Authentication                                        │
│  • DBSCAN Clustering                                         │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
    ┌──────────┐       ┌──────────┐       ┌──────────┐
    │  SQLite  │       │  Local   │       │   AWS    │
    │ + PostGIS│       │  Files   │       │Rekognition│
    │(planned) │       │ (images) │       │(optional)│
    └──────────┘       └──────────┘       └──────────┘
```

### 3.2 Target Stack (Production with SpacetimeDB)

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
│     React Native (iOS/Android)     Web (React + Leaflet)     │
│                  SpacetimeDB SDK (real-time sync)            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      SpacetimeDB                             │
│  • Real-time subscriptions (live events, posts)              │
│  • Server-side reducers (business logic)                     │
│  • Built-in auth                                             │
│  • Automatic client sync                                     │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
    ┌──────────┐       ┌──────────┐       ┌──────────┐
    │Cloudflare│       │   AWS    │       │  Worker  │
    │    R2    │       │Rekognition│      │(clustering)│
    │ (images) │       │   (AI)   │       │          │
    └──────────┘       └──────────┘       └──────────┘
```

---

## 4. SPACETIMEDB STRATEGY

### 4.1 Why SpacetimeDB

SpacetimeDB is ideal for Kalulu because:

| Need | SpacetimeDB Solution |
|------|---------------------|
| Real-time event updates | Built-in subscriptions |
| Live photo feeds | Automatic client sync |
| Social features (likes, comments) | Instant propagation |
| Multi-user events | Conflict-free updates |
| Geo queries | Custom reducers |
| Offline support | Client-side cache |

### 4.2 SpacetimeDB Schema Design

```rust
// FILE: server/src/lib.rs
//
// SpacetimeDB 1.x / 2.0 API. Tables are structs annotated with
// #[table(name = <snake_case>, public)]; reducers are functions annotated with
// #[reducer] whose first argument is `&ReducerContext`. Rows are read/written
// through `ctx.db.<table_name>()`.

use spacetimedb::{table, reducer, Table, ReducerContext, Identity, Timestamp};

// ==================== TABLES ====================

#[table(name = user, public)]
pub struct User {
    #[primary_key]
    pub id: Identity,
    #[unique]
    pub username: String,
    pub email: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub created_at: Timestamp,
}

#[table(name = post, public)]
pub struct Post {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub user_id: Identity,
    pub media_url: String,
    pub thumbnail_url: Option<String>,
    #[index(btree)]
    pub latitude: f64,
    pub longitude: f64,
    pub timestamp: Timestamp,
    pub caption: Option<String>,
    pub neighborhood: Option<String>,
    pub event_id: Option<u64>,
    pub visibility: String, // "public", "private", "hidden"
    pub created_at: Timestamp,
}

#[table(name = event, public)]
pub struct Event {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub name: String,
    pub center_lat: f64,
    pub center_lng: f64,
    pub radius_meters: f64,
    pub start_time: Timestamp,
    pub end_time: Timestamp,
    pub post_count: u32,
    pub heat_score: f64,
    pub neighborhood: Option<String>,
    pub created_at: Timestamp,
}

#[table(name = like, public)]
pub struct Like {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub user_id: Identity,
    pub post_id: u64,
    pub created_at: Timestamp,
}

#[table(name = comment, public)]
pub struct Comment {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub user_id: Identity,
    pub post_id: u64,
    pub content: String,
    pub created_at: Timestamp,
}

#[table(name = follow, public)]
pub struct Follow {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub follower_id: Identity,
    pub following_id: Identity,
    pub created_at: Timestamp,
}

// ==================== LIFECYCLE REDUCERS ====================

// Runs automatically the first time the module is published.
#[reducer(init)]
pub fn init(_ctx: &ReducerContext) {
    log::info!("Kalulu module initialized");
}

// Runs whenever a client connects. Create a User row on first connect.
#[reducer(client_connected)]
pub fn client_connected(ctx: &ReducerContext) {
    if ctx.db.user().id().find(ctx.sender).is_none() {
        ctx.db.user().insert(User {
            id: ctx.sender,
            username: format!("user_{}", &ctx.sender.to_hex_string()[..8]),
            email: String::new(),
            display_name: None,
            avatar_url: None,
            created_at: ctx.timestamp,
        });
    }
}

// ==================== REDUCERS ====================

#[reducer]
pub fn create_post(
    ctx: &ReducerContext,
    media_url: String,
    latitude: f64,
    longitude: f64,
    timestamp: Timestamp,
    caption: Option<String>,
) -> Result<(), String> {
    if media_url.is_empty() {
        return Err("Media URL is required".to_string());
    }

    // Detect neighborhood
    let neighborhood = detect_neighborhood(latitude, longitude);

    // Insert post (id is assigned by #[auto_inc])
    ctx.db.post().insert(Post {
        id: 0, // auto_inc
        user_id: ctx.sender,
        media_url,
        thumbnail_url: None,
        latitude,
        longitude,
        timestamp,
        caption,
        neighborhood: Some(neighborhood),
        event_id: None,
        visibility: "public".to_string(),
        created_at: ctx.timestamp,
    });

    // In production, run clustering on a scheduled reducer rather than inline.
    // See section 2.3 for the algorithm and "Common Pitfalls" for why.
    Ok(())
}

#[reducer]
pub fn like_post(ctx: &ReducerContext, post_id: u64) -> Result<(), String> {
    // Check if already liked
    if ctx.db.like().iter().any(|l| l.user_id == ctx.sender && l.post_id == post_id) {
        return Err("Already liked".to_string());
    }

    ctx.db.like().insert(Like {
        id: 0,
        user_id: ctx.sender,
        post_id,
        created_at: ctx.timestamp,
    });

    Ok(())
}

#[reducer]
pub fn unlike_post(ctx: &ReducerContext, post_id: u64) -> Result<(), String> {
    let existing: Vec<u64> = ctx
        .db
        .like()
        .iter()
        .filter(|l| l.user_id == ctx.sender && l.post_id == post_id)
        .map(|l| l.id)
        .collect();

    for id in existing {
        ctx.db.like().id().delete(id);
    }
    Ok(())
}

#[reducer]
pub fn follow_user(ctx: &ReducerContext, following_id: Identity) -> Result<(), String> {
    if ctx.sender == following_id {
        return Err("Cannot follow yourself".to_string());
    }

    ctx.db.follow().insert(Follow {
        id: 0,
        follower_id: ctx.sender,
        following_id,
        created_at: ctx.timestamp,
    });

    Ok(())
}

// ==================== HELPER FUNCTIONS ====================

// NOTE: keep this list in sync with `get_neighborhood()` in backend/main.py.
// Bounding boxes below mirror the MVP backend exactly (12 neighborhoods).
fn detect_neighborhood(lat: f64, lng: f64) -> String {
    // (name, min_lat, max_lat, min_lng, max_lng)
    let neighborhoods = [
        ("East Village", 40.7200, 40.7350, -73.9950, -73.9750),
        ("West Village", 40.7280, 40.7400, -74.0100, -73.9950),
        ("SoHo", 40.7180, 40.7280, -74.0050, -73.9900),
        ("Williamsburg", 40.7050, 40.7250, -73.9700, -73.9350),
        ("Bushwick", 40.6850, 40.7100, -73.9350, -73.9050),
        ("Lower East Side", 40.7100, 40.7220, -73.9900, -73.9750),
        ("Chelsea", 40.7400, 40.7550, -74.0100, -73.9900),
        ("Midtown", 40.7480, 40.7650, -74.0000, -73.9700),
        ("Times Square", 40.7550, 40.7620, -73.9900, -73.9820),
        ("Brooklyn Heights", 40.6880, 40.7020, -74.0050, -73.9850),
        ("DUMBO", 40.7000, 40.7080, -73.9950, -73.9800),
        ("Greenpoint", 40.7250, 40.7450, -73.9600, -73.9350),
    ];

    for (name, min_lat, max_lat, min_lng, max_lng) in neighborhoods {
        if lat >= min_lat && lat <= max_lat && lng >= min_lng && lng <= max_lng {
            return name.to_string();
        }
    }

    "NYC".to_string()
}
```

> **Scheduled clustering:** SpacetimeDB has no `trigger_clustering()` free function.
> Run DBSCAN on a cadence using a *scheduled reducer* — define a schedule table with
> `#[table(name = clustering_schedule, scheduled(run_clustering))]` and a
> `#[reducer] fn run_clustering(ctx: &ReducerContext, _args: ClusteringSchedule)` that
> performs the clustering. Avoid heavy work inside `create_post`.

### 4.3 SpacetimeDB Client Integration (TypeScript)

> **Package:** install `spacetimedb` (`npm install spacetimedb`). The old
> `@clockworklabs/spacetimedb-sdk` package was deprecated in 1.4.0, and
> `@spacetimedb/sdk` never existed. Generate per-module bindings with
> `spacetime generate --lang typescript --out-dir src/module_bindings --module-path ../server`.
> The connection is built with `DbConnection.builder()`; tables and reducers are
> reached through the generated `conn.db` and `conn.reducers` handles.

```typescript
// FILE: mobile/src/services/spacetimedb.ts

// Generated per-module bindings (created by `spacetime generate`)
import { DbConnection, type Post, type EventRow } from "../module_bindings";
// Shared SDK types
import { Identity } from "spacetimedb";

class KaluluDB {
  public conn: DbConnection | null = null;
  public identity: Identity | null = null;

  // Callbacks for real-time updates
  public onPostAdded: ((post: Post) => void) | null = null;
  public onEventUpdated: ((event: EventRow) => void) | null = null;

  async connect(uri: string, dbName: string, token?: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let builder = DbConnection.builder()
        .withUri(uri)              // e.g. "ws://localhost:3000"
        .withDatabaseName(dbName)  // e.g. "kalulu"
        .onConnect((conn, identity, _token) => {
          this.conn = conn;
          this.identity = identity;

          // Subscribe to the rows this client needs (filtered, not "everything")
          conn
            .subscriptionBuilder()
            .onApplied(() => resolve())
            .subscribe([
              "SELECT * FROM post WHERE visibility = 'public'",
              "SELECT * FROM event",
              "SELECT * FROM like",
              "SELECT * FROM comment",
            ]);

          // Row callbacks fire on every synced change
          conn.db.post.onInsert((_ctx, post) => this.onPostAdded?.(post));
          conn.db.event.onUpdate((_ctx, _old, next) => this.onEventUpdated?.(next));
        })
        .onConnectError((_ctx, err) => reject(err));

      if (token) builder = builder.withToken(token);
      builder.build();
    });
  }

  // ==================== QUERIES (read from the local cache) ====================

  getPostsInBounds(minLat: number, maxLat: number, minLng: number, maxLng: number): Post[] {
    if (!this.conn) return [];
    return Array.from(this.conn.db.post.iter()).filter(
      (post) =>
        post.latitude >= minLat &&
        post.latitude <= maxLat &&
        post.longitude >= minLng &&
        post.longitude <= maxLng &&
        post.visibility === "public"
    );
  }

  getEventPosts(eventId: bigint): Post[] {
    if (!this.conn) return [];
    return Array.from(this.conn.db.post.iter()).filter((p) => p.eventId === eventId);
  }

  // ==================== REDUCERS (write operations) ====================

  createPost(mediaUrl: string, latitude: number, longitude: number, timestamp: Date, caption?: string): void {
    this.conn?.reducers.createPost(mediaUrl, latitude, longitude, BigInt(timestamp.getTime()), caption ?? null);
  }

  likePost(postId: bigint): void {
    this.conn?.reducers.likePost(postId);
  }

  unlikePost(postId: bigint): void {
    this.conn?.reducers.unlikePost(postId);
  }

  followUser(userId: Identity): void {
    this.conn?.reducers.followUser(userId);
  }
}

export const db = new KaluluDB();
```

> The exact generated names (`conn.db.post`, `conn.reducers.createPost`, field casing
> like `eventId`, integer types as `bigint`) come from your schema and the binding
> generator — check `module_bindings/` after running `spacetime generate`. For React,
> SpacetimeDB also ships first-party hooks in `spacetimedb/react`.

### 4.4 React Native Integration

```typescript
// FILE: mobile/src/hooks/useSpacetimeDB.ts

import { useEffect, useState, useCallback } from 'react';
import { db } from '../services/spacetimedb';
import type { Post, EventRow } from '../module_bindings';

export function usePosts(bounds: {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Initial load
    const initialPosts = db.getPostsInBounds(
      bounds.minLat,
      bounds.maxLat,
      bounds.minLng,
      bounds.maxLng
    );
    setPosts(initialPosts);
    setLoading(false);
    
    // Real-time updates
    db.onPostAdded = (post) => {
      if (
        post.latitude >= bounds.minLat &&
        post.latitude <= bounds.maxLat &&
        post.longitude >= bounds.minLng &&
        post.longitude <= bounds.maxLng
      ) {
        setPosts((prev) => [post, ...prev]);
      }
    };
    
    return () => {
      db.onPostAdded = null;
    };
  }, [bounds.minLat, bounds.maxLat, bounds.minLng, bounds.maxLng]);
  
  return { posts, loading };
}

export function useEvent(eventId: bigint) {
  const [event, setEvent] = useState<EventRow | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  
  useEffect(() => {
    // Load event from the local cache
    const match = db.conn?.db.event.id.find(eventId) ?? null;
    if (match) setEvent(match);
    
    // Load posts
    setPosts(db.getEventPosts(eventId));
    
    // Real-time updates
    db.onEventUpdated = (updatedEvent) => {
      if (updatedEvent.id === eventId) {
        setEvent(updatedEvent);
      }
    };
    
    db.onPostAdded = (post) => {
      if (post.eventId === eventId) {
        setPosts((prev) => [...prev, post]);
      }
    };
    
    return () => {
      db.onEventUpdated = null;
      db.onPostAdded = null;
    };
  }, [eventId]);
  
  return { event, posts };
}
```

---

## 5. CURRENT CODEBASE

### 5.1 Directory Structure

```
kalulu/
├── backend/                    # Python FastAPI (MVP, to be replaced)
│   ├── main.py                # Core API endpoints
│   ├── auth.py                # JWT authentication
│   ├── social.py              # Likes, comments, follows
│   ├── search.py              # Search and trending
│   ├── moderation.py          # AI content moderation
│   ├── seed_data.py           # Demo data generator
│   └── requirements.txt
│
├── frontend/                   # Web app
│   └── index.html             # Leaflet map + vanilla JS
│
├── mobile/                     # React Native app
│   ├── App.js                 # Navigation setup
│   ├── src/
│   │   ├── screens/           # 8 screens (Map, Feed, Upload, etc.)
│   │   ├── services/          # API, auth, state (Zustand)
│   │   ├── hooks/             # useLocation, useData
│   │   └── utils/             # Helpers
│   ├── package.json
│   └── app.json               # Expo config
│
└── spacetimedb/               # TO BE CREATED
    ├── server/
    │   ├── src/
    │   │   └── lib.rs         # Schema + reducers
    │   └── Cargo.toml
    └── client/
        └── module_bindings/   # Auto-generated types
```

### 5.2 What Exists (Working)

| Component | Status | Notes |
|-----------|--------|-------|
| FastAPI backend | ✅ Complete | 20+ endpoints |
| SQLite database | ✅ Complete | Posts, events, users, social |
| DBSCAN clustering | ✅ Complete | Auto-detects events |
| JWT authentication | ✅ Complete | Register, login, tokens |
| Social features | ✅ Complete | Likes, comments, follows |
| Search | ✅ Complete | Full-text, geo, trending |
| AI moderation | ✅ Stubbed | AWS Rekognition ready |
| Web frontend | ✅ Complete | Map, feed, upload |
| Mobile app | ✅ Complete | 8 screens, all features |
| SpacetimeDB | ❌ Not started | Migration needed |

### 5.3 Key Files to Reference

**Clustering algorithm:** `backend/main.py` → `cluster_posts_into_events()` (~line 231) + `haversine_distance()` (~line 181)
**Neighborhood detection:** `backend/main.py` → `get_neighborhood()` (~line 195)
**Auth flow:** `backend/auth.py` (full file)
**Social features:** `backend/social.py` (full file)
**Mobile API client:** `mobile/src/services/api.js`
**Mobile state management:** `mobile/src/services/store.js`
**Map screen:** `mobile/src/screens/MapScreen.js`

---

## 6. WHAT NEEDS BUILDING

### 6.1 Priority Order

```
PHASE 1: SpacetimeDB Core (Week 1-2)
├── Set up SpacetimeDB server project
├── Define schema (tables)
├── Implement core reducers
├── Generate TypeScript bindings
└── Basic CRUD working

PHASE 2: Client Migration (Week 2-3)
├── Replace API calls with SpacetimeDB SDK
├── Implement real-time subscriptions
├── Update React hooks
├── Test offline support
└── Migrate web frontend

PHASE 3: Advanced Features (Week 3-4)
├── Real-time clustering
├── Geo-subscriptions (nearby events)
├── Push notification integration
├── Image upload pipeline (R2)
└── AI moderation integration

PHASE 4: Production (Week 4-5)
├── Load testing
├── Deploy SpacetimeDB cloud
├── CDN setup (Cloudflare)
├── Monitoring + logging
└── Beta launch
```

### 6.2 Specific Tasks

#### SpacetimeDB Server

```
[ ] Create Rust project: `spacetime init --lang rust server`
[ ] Define Post table with geo fields
[ ] Define Event table
[ ] Define User table with Identity
[ ] Define Like, Comment, Follow tables
[ ] Implement create_post reducer
[ ] Implement like_post, unlike_post reducers
[ ] Implement follow_user, unfollow_user reducers
[ ] Implement add_comment reducer
[ ] Port DBSCAN clustering to Rust
[ ] Implement neighborhood detection
[ ] Add scheduled clustering job
[ ] Test locally: `spacetime start`
```

#### TypeScript Client

```
[ ] Generate bindings: `spacetime generate --lang typescript`
[ ] Create KaluluDB service class
[ ] Implement connection handling
[ ] Implement subscription management
[ ] Create React hooks (usePosts, useEvents, etc.)
[ ] Handle offline/reconnection
[ ] Migrate mobile app API calls
[ ] Migrate web app API calls
[ ] Remove FastAPI backend dependency
```

#### Image Pipeline

```
[ ] Set up Cloudflare R2 bucket
[ ] Create upload endpoint (presigned URLs)
[ ] Implement client-side image compression
[ ] Generate thumbnails (R2 Worker)
[ ] Store media_url in SpacetimeDB
[ ] Implement CDN caching
```

---

## 7. CODING GUIDELINES

### 7.1 SpacetimeDB Best Practices

```rust
// DO: Use #[primary_key] and #[auto_inc] for IDs
#[table(name = post, public)]
pub struct Post {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    // ...
}

// DO: Use Identity for user references
pub user_id: Identity,

// DO: Use Timestamp for time fields
pub created_at: Timestamp,

// DON'T: Store large blobs in SpacetimeDB
// Instead, store URLs to external storage (R2)
pub media_url: String,  // ✅
pub image_data: Vec<u8>, // ❌

// DO: Keep reducers small and focused; first arg is &ReducerContext
#[reducer]
pub fn like_post(ctx: &ReducerContext, post_id: u64) -> Result<(), String> {
    // Single responsibility; read/write via ctx.db.<table>()
    Ok(())
}

// DON'T: Put complex queries in reducers
// Instead, query on client side from synced tables
```

### 7.2 TypeScript/React Native Guidelines

```typescript
// DO: Use hooks for real-time data
export function usePosts(bounds: Bounds) {
  const [posts, setPosts] = useState<Post[]>([]);
  
  useEffect(() => {
    // Subscribe to updates
    db.onPostAdded = (post) => { /* ... */ };
    return () => { db.onPostAdded = null; };
  }, []);
  
  return posts;
}

// DO: Handle loading and error states
const { posts, loading, error } = usePosts(bounds);
if (loading) return <Spinner />;
if (error) return <ErrorView error={error} />;

// DO: Optimistic updates for likes
const handleLike = async (postId: number) => {
  // Immediately update UI
  setLiked(true);
  setLikeCount(prev => prev + 1);
  
  try {
    await db.likePost(postId);
  } catch (error) {
    // Rollback on failure
    setLiked(false);
    setLikeCount(prev => prev - 1);
  }
};

// DON'T: Poll for updates
setInterval(() => fetchPosts(), 5000); // ❌
// Instead, use SpacetimeDB subscriptions

// DO: Batch location updates
const debouncedRegionChange = useMemo(
  () => debounce((region) => setMapRegion(region), 300),
  []
);
```

### 7.3 Error Handling

```rust
// Rust: Return Result<(), String> from reducers; an Err aborts the transaction
#[reducer]
pub fn create_post(ctx: &ReducerContext, media_url: String /* ... */) -> Result<(), String> {
    if media_url.is_empty() {
        return Err("Media URL is required".to_string());
    }
    // ...
    Ok(())
}
```

```typescript
// TypeScript: Wrap reducer calls in try-catch
async function createPost(data: PostData): Promise<boolean> {
  try {
    await db.createPost(
      data.mediaUrl,
      data.latitude,
      data.longitude,
      data.timestamp,
      data.caption
    );
    return true;
  } catch (error) {
    console.error("Failed to create post:", error);
    Alert.alert("Error", error.message);
    return false;
  }
}
```

### 7.4 File Organization

```
spacetimedb/
├── server/
│   ├── src/
│   │   ├── lib.rs           # Main entry, table definitions
│   │   ├── reducers/
│   │   │   ├── posts.rs     # Post-related reducers
│   │   │   ├── social.rs    # Likes, comments, follows
│   │   │   └── events.rs    # Event management
│   │   ├── utils/
│   │   │   ├── geo.rs       # Neighborhood detection
│   │   │   └── clustering.rs # DBSCAN implementation
│   │   └── mod.rs
│   └── Cargo.toml
│
└── client/
    ├── src/
    │   ├── db.ts            # SpacetimeDB client wrapper
    │   ├── hooks/
    │   │   ├── usePosts.ts
    │   │   ├── useEvents.ts
    │   │   └── useSocial.ts
    │   └── types/
    │       └── index.ts     # Re-export generated types
    └── package.json
```

---

## 8. STEP-BY-STEP BUILD INSTRUCTIONS

### 8.1 Setting Up SpacetimeDB

```bash
# Step 1: Install the SpacetimeDB CLI
# Follow the current installer at https://spacetimedb.com/install
# (macOS/Linux): curl -sSf https://spacetimedb.com/install | bash

# Step 2: Create the server module project
mkdir -p kalulu/spacetimedb
cd kalulu/spacetimedb
spacetime init --lang rust server

# Step 3: Edit server/src/lib.rs
# Copy the schema + reducers from section 4.2

# Step 4: Start a local SpacetimeDB instance (leave running in its own terminal)
spacetime start

# Step 5: In another terminal, build + publish the module to the local instance
spacetime publish --project-path server kalulu

# Step 6: Generate the TypeScript client bindings
spacetime generate --lang typescript \
  --out-dir ../client/src/module_bindings \
  --module-path server
```

### 8.2 Implementing Core Tables

```rust
// FILE: server/src/lib.rs

// Start with these tables in order:
// 1. User (identity management)
// 2. Post (core content)
// 3. Event (clustering results)
// 4. Like, Comment, Follow (social)

// Test each table before adding the next (table names are the snake_case
// `name = ...` from the #[table] macro, e.g. `user`, `post`):
spacetime sql kalulu "SELECT * FROM user"
spacetime sql kalulu "SELECT * FROM post"
```

### 8.3 Implementing Reducers

```rust
// Implement in this order:
// 1. create_user (called on first connection)
// 2. create_post (core functionality)
// 3. like_post, unlike_post
// 4. add_comment
// 5. follow_user, unfollow_user
// 6. Clustering (most complex, do last)

// Test each reducer (args are passed positionally, in declared order):
spacetime call kalulu create_post "https://example.com/a.jpg" 40.73 -73.99 0 "Test"
```

### 8.4 Client Migration

```typescript
// Step 1: Install SDK (Node 18-21 also needs `undici`)
npm install spacetimedb

// Step 2: Copy generated bindings to project
cp -r spacetimedb/client/src/module_bindings mobile/src/

// Step 3: Create db service
// See section 4.3 for implementation

// Step 4: Update hooks one at a time
// Start with usePosts, test, then useEvents, etc.

// Step 5: Remove old API calls
// Delete mobile/src/services/api.js when done
```

### 8.5 Testing Checklist

```
[ ] Can create user on connect
[ ] Can create post with location
[ ] Post appears on map immediately
[ ] Can like/unlike post
[ ] Like count updates in real-time
[ ] Can add comment
[ ] Comments appear immediately
[ ] Can follow/unfollow user
[ ] Following feed shows correct posts
[ ] Clustering groups nearby posts into events
[ ] Events update when new posts added
[ ] Offline mode works (data persists)
[ ] Reconnection syncs properly
```

---

## 9. TESTING & VALIDATION

### 9.1 Unit Tests (Rust)

```rust
// FILE: server/src/tests.rs

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_neighborhood_detection() {
        // East Village
        assert_eq!(detect_neighborhood(40.727, -73.985), "East Village");
        
        // Williamsburg
        assert_eq!(detect_neighborhood(40.715, -73.955), "Williamsburg");
        
        // Unknown -> NYC
        assert_eq!(detect_neighborhood(40.9, -74.1), "NYC");
    }
    
    #[test]
    fn test_clustering() {
        // Create test posts
        // Run clustering
        // Assert events created correctly
    }
}
```

### 9.2 Integration Tests

```typescript
// FILE: __tests__/spacetimedb.test.ts

describe("SpacetimeDB Integration", () => {
  beforeAll(async () => {
    // Use the ws:// (or wss://) scheme; connect resolves once the subscription applies
    await db.connect("ws://localhost:3000", "kalulu");
  });
  
  test("can create and retrieve post", async () => {
    await db.createPost(
      "https://example.com/image.jpg",
      40.73,
      -73.99,
      new Date(),
      "Test caption"
    );
    
    const posts = db.getPostsInBounds(40.72, 40.74, -74.0, -73.98);
    expect(posts.length).toBeGreaterThan(0);
  });
  
  test("real-time updates work", async () => {
    const receivedPosts: Post[] = [];
    db.onPostAdded = (post) => receivedPosts.push(post);
    
    // Create post from another client
    await otherClient.createPost(...);
    
    // Wait for sync
    await sleep(100);
    
    expect(receivedPosts.length).toBe(1);
  });
});
```

### 9.3 Load Testing

```bash
# There is no built-in benchmark subcommand. Drive load by scripting reducer calls:
for i in $(seq 1 1000); do
  spacetime call kalulu create_post "https://example.com/$i.jpg" 40.73 -73.99 0 "load test $i"
done

# Targets to watch (measure with `spacetime logs` + a subscribed client):
# - 1000 posts created in < 5 seconds
# - All subscribed clients receive updates in < 100ms
# - No dropped connections
```

---

## 10. COMMON PITFALLS

### 10.1 SpacetimeDB Gotchas

```rust
// PITFALL: Forgetting the #[table(name = ...)] attribute
struct Post { /* ... */ }  // ❌ Won't be a table
#[table(name = post, public)]
pub struct Post { /* ... */ }  // ✅

// PITFALL: Using wrong ID type
pub id: String,  // ❌ Use u64 with #[auto_inc]
#[auto_inc]
pub id: u64,  // ✅

// PITFALL: Blocking operations in reducers
std::thread::sleep(Duration::from_secs(1));  // ❌ Blocks entire module
// Use scheduled reducers for delayed operations

// PITFALL: Wrong case in SQL — table names are the snake_case `name = ...`
"SELECT * FROM Post"  // ❌ no such table; use lowercase `post`

// PITFALL: Large subscriptions
"SELECT * FROM post"  // ❌ Downloads everything
"SELECT * FROM post WHERE latitude BETWEEN ? AND ?"  // ✅ Filtered
```

### 10.2 Client-Side Gotchas

```typescript
// PITFALL: Not handling disconnection
await db.connect(...);  // ❌ No reconnection handling

// ✅ Handle reconnection
db.onDisconnect(() => {
  showReconnectingUI();
  setTimeout(() => db.connect(...), 1000);
});

// PITFALL: Memory leaks from subscriptions
useEffect(() => {
  db.onPostAdded = (post) => { ... };
  // ❌ Missing cleanup
});

// ✅ Clean up subscriptions
useEffect(() => {
  db.onPostAdded = (post) => { ... };
  return () => { db.onPostAdded = null; };
}, []);

// PITFALL: Not debouncing map movements
onRegionChange={(region) => loadPosts(region)}  // ❌ Too many calls

// ✅ Debounce
onRegionChangeComplete={debounce((region) => loadPosts(region), 300)}
```

### 10.3 Architecture Gotchas

```
PITFALL: Storing images in SpacetimeDB
- Images bloat the database
- Slow sync for all clients
SOLUTION: Store URLs only, use R2/S3 for actual files

PITFALL: Running clustering on every post
- CPU intensive
- Blocks other operations
SOLUTION: Run clustering on schedule (every 5 min) or use background worker

PITFALL: Not indexing geo queries
- Full table scans for every map move
SOLUTION: Use spatial indexes or pre-compute geohashes

PITFALL: Syncing all data to all clients
- Wastes bandwidth
- Privacy concerns
SOLUTION: Use filtered subscriptions based on location/follows
```

---

## APPENDIX: QUICK REFERENCE

### SpacetimeDB Commands

```bash
spacetime init --lang rust <dir>          # Scaffold a new module project
spacetime build --project-path <dir>      # Compile module to WASM
spacetime start                            # Run a local SpacetimeDB instance
spacetime publish --project-path <dir> <name>   # Build + deploy module (local or cloud)
spacetime sql <name> "<query>"            # Run a SQL query against a database
spacetime call <name> <reducer> <args...> # Call a reducer (positional args)
spacetime generate --lang typescript --out-dir <dir> --module-path <dir>  # Client bindings
spacetime logs <name>                      # View module logs
```

### Key Coordinates (NYC)

```
Manhattan Center:    40.7831, -73.9712
Times Square:        40.7580, -73.9855
Central Park:        40.7829, -73.9654
Brooklyn Bridge:     40.7061, -73.9969
Williamsburg:        40.7081, -73.9571
East Village:        40.7265, -73.9815
```

### API Response Format (Legacy)

```json
{
  "id": "abc123",
  "user_id": "user_xyz",
  "media_url": "/uploads/abc123.jpg",
  "latitude": 40.7265,
  "longitude": -73.9815,
  "timestamp": "2026-01-15T23:45:00Z",
  "caption": "Amazing night!",
  "neighborhood": "East Village",
  "event_id": "event_456",
  "created_at": "2026-01-15T23:46:00Z"
}
```

---

## END OF DOCUMENT

**For questions or clarifications, refer to:**
- SpacetimeDB docs: https://spacetimedb.com/docs
- Existing codebase: `kalulu/backend/` and `kalulu/mobile/`
- This document: `HANDOFF.md`

**Good luck, AI agent! Build something amazing. 🚀**
