"""
Kalulu Backend - MVP Demo
Event-based photo sharing with location and auto-clustering
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import sqlite3
import os
import uuid
import math
from sklearn.cluster import DBSCAN
import numpy as np
from contextlib import contextmanager
import json

app = FastAPI(title="Kalulu API", version="0.2.0", description="The living memory of your city")

# Import and include routers (after app is created)
try:
    from auth import router as auth_router
    from social import router as social_router
    from search import router as search_router
    from moderation import router as moderation_router, moderate_image
    
    app.include_router(auth_router)
    app.include_router(social_router)
    app.include_router(search_router)
    app.include_router(moderation_router)
    ROUTERS_LOADED = True
except ImportError as e:
    print(f"Optional routers not loaded: {e}")
    ROUTERS_LOADED = False

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
UPLOAD_DIR = "uploads"
DB_PATH = "kalulu.db"
FRONTEND_DIR = "../frontend"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mount static files for serving uploaded images
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Serve frontend
from fastapi.responses import FileResponse

@app.get("/app")
@app.get("/app/")
def serve_frontend():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


# ============== Database Setup ==============

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Posts table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS posts (
            id TEXT PRIMARY KEY,
            user_id TEXT DEFAULT 'anonymous',
            media_url TEXT NOT NULL,
            thumbnail_url TEXT,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            timestamp DATETIME NOT NULL,
            caption TEXT,
            neighborhood TEXT,
            event_id TEXT,
            tags TEXT,
            ai_tags TEXT,
            visibility TEXT DEFAULT 'public',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Events table (auto-generated clusters)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            name TEXT,
            description TEXT,
            center_lat REAL,
            center_lng REAL,
            radius_meters REAL,
            start_time DATETIME,
            end_time DATETIME,
            post_count INTEGER DEFAULT 0,
            heat_score REAL DEFAULT 0,
            neighborhood TEXT,
            tags TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Users table (simplified for MVP)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE,
            display_name TEXT,
            avatar_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_posts_location ON posts(latitude, longitude)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_posts_timestamp ON posts(timestamp)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_posts_event ON posts(event_id)")
    
    conn.commit()
    conn.close()

init_db()


# ============== Models ==============

class PostCreate(BaseModel):
    latitude: float
    longitude: float
    timestamp: Optional[datetime] = None
    caption: Optional[str] = None
    tags: Optional[List[str]] = None
    user_id: Optional[str] = "anonymous"

class PostResponse(BaseModel):
    id: str
    user_id: str
    media_url: str
    thumbnail_url: Optional[str]
    latitude: float
    longitude: float
    timestamp: datetime
    caption: Optional[str]
    neighborhood: Optional[str]
    event_id: Optional[str]
    tags: List[str]
    created_at: datetime

class EventResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    center_lat: float
    center_lng: float
    radius_meters: float
    start_time: datetime
    end_time: datetime
    post_count: int
    heat_score: float
    neighborhood: Optional[str]
    posts: Optional[List[PostResponse]] = None


# ============== Geo Utilities ==============

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in meters"""
    R = 6371000  # Earth's radius in meters
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def get_neighborhood(lat: float, lng: float) -> str:
    """Simple NYC neighborhood detection based on coordinates"""
    # Simplified bounding boxes for major NYC neighborhoods
    neighborhoods = {
        "East Village": {"min_lat": 40.7200, "max_lat": 40.7350, "min_lng": -73.9950, "max_lng": -73.9750},
        "West Village": {"min_lat": 40.7280, "max_lat": 40.7400, "min_lng": -74.0100, "max_lng": -73.9950},
        "SoHo": {"min_lat": 40.7180, "max_lat": 40.7280, "min_lng": -74.0050, "max_lng": -73.9900},
        "Williamsburg": {"min_lat": 40.7050, "max_lat": 40.7250, "min_lng": -73.9700, "max_lng": -73.9350},
        "Bushwick": {"min_lat": 40.6850, "max_lat": 40.7100, "min_lng": -73.9350, "max_lng": -73.9050},
        "Lower East Side": {"min_lat": 40.7100, "max_lat": 40.7220, "min_lng": -73.9900, "max_lng": -73.9750},
        "Chelsea": {"min_lat": 40.7400, "max_lat": 40.7550, "min_lng": -74.0100, "max_lng": -73.9900},
        "Midtown": {"min_lat": 40.7480, "max_lat": 40.7650, "min_lng": -74.0000, "max_lng": -73.9700},
        "Times Square": {"min_lat": 40.7550, "max_lat": 40.7620, "min_lng": -73.9900, "max_lng": -73.9820},
        "Brooklyn Heights": {"min_lat": 40.6880, "max_lat": 40.7020, "min_lng": -74.0050, "max_lng": -73.9850},
        "DUMBO": {"min_lat": 40.7000, "max_lat": 40.7080, "min_lng": -73.9950, "max_lng": -73.9800},
        "Greenpoint": {"min_lat": 40.7250, "max_lat": 40.7450, "min_lng": -73.9600, "max_lng": -73.9350},
    }
    
    for name, bounds in neighborhoods.items():
        if (bounds["min_lat"] <= lat <= bounds["max_lat"] and 
            bounds["min_lng"] <= lng <= bounds["max_lng"]):
            return name
    
    # Default based on rough borough detection
    if lng < -73.95 and lat > 40.70:
        return "Manhattan"
    elif lng > -73.95 and lat < 40.73:
        return "Brooklyn"
    elif lat > 40.75:
        return "Upper Manhattan"
    else:
        return "NYC"


# ============== Event Clustering ==============

def cluster_posts_into_events():
    """Run DBSCAN clustering on recent posts to detect events"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Get posts from last 24 hours without event assignment
    cutoff = datetime.now() - timedelta(hours=24)
    cursor.execute("""
        SELECT id, latitude, longitude, timestamp 
        FROM posts 
        WHERE timestamp > ? AND event_id IS NULL
        ORDER BY timestamp
    """, (cutoff.isoformat(),))
    
    posts = cursor.fetchall()
    
    if len(posts) < 3:
        conn.close()
        return []
    
    # Prepare data for clustering
    # Combine spatial and temporal features
    coords = []
    post_ids = []
    timestamps = []
    
    for post in posts:
        coords.append([post['latitude'], post['longitude']])
        post_ids.append(post['id'])
        ts = datetime.fromisoformat(post['timestamp']) if isinstance(post['timestamp'], str) else post['timestamp']
        timestamps.append(ts.timestamp())
    
    coords = np.array(coords)
    timestamps = np.array(timestamps)
    
    # Normalize coordinates to roughly meter scale
    # 1 degree lat ≈ 111km, 1 degree lng ≈ 85km at NYC latitude
    coords_scaled = coords.copy()
    coords_scaled[:, 0] *= 111000  # lat to meters
    coords_scaled[:, 1] *= 85000   # lng to meters (approximate for NYC)
    
    # Add time as a dimension (1 hour = 100 meters equivalent)
    time_scaled = (timestamps - timestamps.min()) / 36  # 1 hour = 100 "meters"
    
    features = np.column_stack([coords_scaled, time_scaled])
    
    # Run DBSCAN
    # eps=150 means ~150m spatial distance + time factor
    # min_samples=3 means at least 3 posts to form an event
    clustering = DBSCAN(eps=150, min_samples=3).fit(features)
    
    labels = clustering.labels_
    unique_labels = set(labels)
    
    new_events = []
    
    for label in unique_labels:
        if label == -1:  # Noise points
            continue
            
        # Get posts in this cluster
        mask = labels == label
        cluster_post_ids = [post_ids[i] for i in range(len(post_ids)) if mask[i]]
        cluster_coords = coords[mask]
        cluster_times = [timestamps[i] for i in range(len(timestamps)) if mask[i]]
        
        # Calculate event properties
        center_lat = float(np.mean(cluster_coords[:, 0]))
        center_lng = float(np.mean(cluster_coords[:, 1]))
        
        # Calculate radius (max distance from center)
        distances = [haversine_distance(center_lat, center_lng, c[0], c[1]) for c in cluster_coords]
        radius = max(distances) if distances else 100
        
        start_time = datetime.fromtimestamp(min(cluster_times))
        end_time = datetime.fromtimestamp(max(cluster_times))
        
        neighborhood = get_neighborhood(center_lat, center_lng)
        
        # Generate event name
        time_of_day = "Night" if start_time.hour >= 20 or start_time.hour < 4 else \
                      "Evening" if start_time.hour >= 17 else \
                      "Afternoon" if start_time.hour >= 12 else "Morning"
        
        event_name = f"{neighborhood} {time_of_day} - {start_time.strftime('%b %d')}"
        
        # Create event
        event_id = str(uuid.uuid4())[:8]
        
        cursor.execute("""
            INSERT INTO events (id, name, center_lat, center_lng, radius_meters, 
                               start_time, end_time, post_count, neighborhood, heat_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (event_id, event_name, center_lat, center_lng, radius,
              start_time.isoformat(), end_time.isoformat(), len(cluster_post_ids), 
              neighborhood, len(cluster_post_ids) * 10))
        
        # Update posts with event_id
        for post_id in cluster_post_ids:
            cursor.execute("UPDATE posts SET event_id = ? WHERE id = ?", (event_id, post_id))
        
        new_events.append(event_id)
    
    conn.commit()
    conn.close()
    
    return new_events


# ============== API Routes ==============

@app.get("/")
def root():
    return {"message": "Kalulu API", "version": "0.1.0", "status": "running"}


@app.post("/posts", response_model=PostResponse)
async def create_post(
    file: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    timestamp: Optional[str] = Form(None),
    caption: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    user_id: Optional[str] = Form("anonymous")
):
    """Upload a photo with location data"""
    
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Generate unique filename
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    file_id = str(uuid.uuid4())[:12]
    filename = f"{file_id}.{file_ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    # Save file
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    
    # Parse timestamp
    if timestamp:
        try:
            post_timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except:
            post_timestamp = datetime.now()
    else:
        post_timestamp = datetime.now()
    
    # Parse tags
    tag_list = json.loads(tags) if tags else []
    
    # Get neighborhood
    neighborhood = get_neighborhood(latitude, longitude)
    
    # Create post record
    post_id = str(uuid.uuid4())[:8]
    media_url = f"/uploads/{filename}"
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO posts (id, user_id, media_url, latitude, longitude, timestamp, 
                          caption, neighborhood, tags, visibility)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'public')
    """, (post_id, user_id, media_url, latitude, longitude, 
          post_timestamp.isoformat(), caption, neighborhood, json.dumps(tag_list)))
    
    conn.commit()
    conn.close()
    
    # Trigger clustering (in production, this would be async/queued)
    cluster_posts_into_events()
    
    return PostResponse(
        id=post_id,
        user_id=user_id,
        media_url=media_url,
        thumbnail_url=media_url,
        latitude=latitude,
        longitude=longitude,
        timestamp=post_timestamp,
        caption=caption,
        neighborhood=neighborhood,
        event_id=None,
        tags=tag_list,
        created_at=datetime.now()
    )


@app.get("/posts", response_model=List[PostResponse])
def get_posts(
    min_lat: Optional[float] = Query(None),
    max_lat: Optional[float] = Query(None),
    min_lng: Optional[float] = Query(None),
    max_lng: Optional[float] = Query(None),
    event_id: Optional[str] = Query(None),
    neighborhood: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0)
):
    """Get posts with optional geographic and event filters"""
    
    conn = get_db()
    cursor = conn.cursor()
    
    query = "SELECT * FROM posts WHERE visibility = 'public'"
    params = []
    
    if min_lat is not None:
        query += " AND latitude >= ?"
        params.append(min_lat)
    if max_lat is not None:
        query += " AND latitude <= ?"
        params.append(max_lat)
    if min_lng is not None:
        query += " AND longitude >= ?"
        params.append(min_lng)
    if max_lng is not None:
        query += " AND longitude <= ?"
        params.append(max_lng)
    if event_id:
        query += " AND event_id = ?"
        params.append(event_id)
    if neighborhood:
        query += " AND neighborhood = ?"
        params.append(neighborhood)
    
    query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    posts = []
    for row in rows:
        tags = json.loads(row['tags']) if row['tags'] else []
        posts.append(PostResponse(
            id=row['id'],
            user_id=row['user_id'],
            media_url=row['media_url'],
            thumbnail_url=row['thumbnail_url'],
            latitude=row['latitude'],
            longitude=row['longitude'],
            timestamp=datetime.fromisoformat(row['timestamp']),
            caption=row['caption'],
            neighborhood=row['neighborhood'],
            event_id=row['event_id'],
            tags=tags,
            created_at=datetime.fromisoformat(row['created_at'])
        ))
    
    return posts


@app.get("/posts/{post_id}", response_model=PostResponse)
def get_post(post_id: str):
    """Get a single post by ID"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM posts WHERE id = ?", (post_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Post not found")
    
    tags = json.loads(row['tags']) if row['tags'] else []
    return PostResponse(
        id=row['id'],
        user_id=row['user_id'],
        media_url=row['media_url'],
        thumbnail_url=row['thumbnail_url'],
        latitude=row['latitude'],
        longitude=row['longitude'],
        timestamp=datetime.fromisoformat(row['timestamp']),
        caption=row['caption'],
        neighborhood=row['neighborhood'],
        event_id=row['event_id'],
        tags=tags,
        created_at=datetime.fromisoformat(row['created_at'])
    )


@app.get("/events", response_model=List[EventResponse])
def get_events(
    min_lat: Optional[float] = Query(None),
    max_lat: Optional[float] = Query(None),
    min_lng: Optional[float] = Query(None),
    max_lng: Optional[float] = Query(None),
    neighborhood: Optional[str] = Query(None),
    include_posts: bool = Query(False),
    limit: int = Query(50, le=200)
):
    """Get events/clusters with optional filters"""
    
    conn = get_db()
    cursor = conn.cursor()
    
    query = "SELECT * FROM events WHERE 1=1"
    params = []
    
    if min_lat is not None:
        query += " AND center_lat >= ?"
        params.append(min_lat)
    if max_lat is not None:
        query += " AND center_lat <= ?"
        params.append(max_lat)
    if min_lng is not None:
        query += " AND center_lng >= ?"
        params.append(min_lng)
    if max_lng is not None:
        query += " AND center_lng <= ?"
        params.append(max_lng)
    if neighborhood:
        query += " AND neighborhood = ?"
        params.append(neighborhood)
    
    query += " ORDER BY heat_score DESC, start_time DESC LIMIT ?"
    params.append(limit)
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    events = []
    for row in rows:
        event_posts = None
        if include_posts:
            cursor.execute("SELECT * FROM posts WHERE event_id = ? ORDER BY timestamp", (row['id'],))
            post_rows = cursor.fetchall()
            event_posts = []
            for pr in post_rows:
                tags = json.loads(pr['tags']) if pr['tags'] else []
                event_posts.append(PostResponse(
                    id=pr['id'],
                    user_id=pr['user_id'],
                    media_url=pr['media_url'],
                    thumbnail_url=pr['thumbnail_url'],
                    latitude=pr['latitude'],
                    longitude=pr['longitude'],
                    timestamp=datetime.fromisoformat(pr['timestamp']),
                    caption=pr['caption'],
                    neighborhood=pr['neighborhood'],
                    event_id=pr['event_id'],
                    tags=tags,
                    created_at=datetime.fromisoformat(pr['created_at'])
                ))
        
        events.append(EventResponse(
            id=row['id'],
            name=row['name'],
            description=row['description'],
            center_lat=row['center_lat'],
            center_lng=row['center_lng'],
            radius_meters=row['radius_meters'],
            start_time=datetime.fromisoformat(row['start_time']),
            end_time=datetime.fromisoformat(row['end_time']),
            post_count=row['post_count'],
            heat_score=row['heat_score'],
            neighborhood=row['neighborhood'],
            posts=event_posts
        ))
    
    conn.close()
    return events


@app.get("/events/{event_id}", response_model=EventResponse)
def get_event(event_id: str, include_posts: bool = Query(True)):
    """Get a single event with its posts"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Event not found")
    
    event_posts = None
    if include_posts:
        cursor.execute("SELECT * FROM posts WHERE event_id = ? ORDER BY timestamp", (event_id,))
        post_rows = cursor.fetchall()
        event_posts = []
        for pr in post_rows:
            tags = json.loads(pr['tags']) if pr['tags'] else []
            event_posts.append(PostResponse(
                id=pr['id'],
                user_id=pr['user_id'],
                media_url=pr['media_url'],
                thumbnail_url=pr['thumbnail_url'],
                latitude=pr['latitude'],
                longitude=pr['longitude'],
                timestamp=datetime.fromisoformat(pr['timestamp']),
                caption=datetime.fromisoformat(pr['timestamp']),
                neighborhood=pr['neighborhood'],
                event_id=pr['event_id'],
                tags=tags,
                created_at=datetime.fromisoformat(pr['created_at'])
            ))
    
    conn.close()
    
    return EventResponse(
        id=row['id'],
        name=row['name'],
        description=row['description'],
        center_lat=row['center_lat'],
        center_lng=row['center_lng'],
        radius_meters=row['radius_meters'],
        start_time=datetime.fromisoformat(row['start_time']),
        end_time=datetime.fromisoformat(row['end_time']),
        post_count=row['post_count'],
        heat_score=row['heat_score'],
        neighborhood=row['neighborhood'],
        posts=event_posts
    )


@app.get("/neighborhoods")
def get_neighborhoods():
    """Get list of neighborhoods with post counts"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT neighborhood, COUNT(*) as post_count 
        FROM posts 
        WHERE neighborhood IS NOT NULL 
        GROUP BY neighborhood 
        ORDER BY post_count DESC
    """)
    
    rows = cursor.fetchall()
    conn.close()
    
    return [{"name": row['neighborhood'], "post_count": row['post_count']} for row in rows]


@app.post("/cluster")
def trigger_clustering():
    """Manually trigger event clustering"""
    new_events = cluster_posts_into_events()
    return {"message": f"Created {len(new_events)} new events", "event_ids": new_events}


@app.get("/stats")
def get_stats():
    """Get platform statistics"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as count FROM posts")
    post_count = cursor.fetchone()['count']
    
    cursor.execute("SELECT COUNT(*) as count FROM events")
    event_count = cursor.fetchone()['count']
    
    cursor.execute("SELECT COUNT(DISTINCT user_id) as count FROM posts")
    user_count = cursor.fetchone()['count']
    
    cursor.execute("SELECT COUNT(DISTINCT neighborhood) as count FROM posts WHERE neighborhood IS NOT NULL")
    neighborhood_count = cursor.fetchone()['count']
    
    conn.close()
    
    return {
        "total_posts": post_count,
        "total_events": event_count,
        "total_users": user_count,
        "neighborhoods_active": neighborhood_count
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
