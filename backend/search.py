"""
Kalulu Search Module
Full-text and geo search across posts, events, and users
"""

from datetime import datetime, timedelta
from typing import Optional, List
import sqlite3

from fastapi import APIRouter, Query
from pydantic import BaseModel

DB_PATH = "kalulu.db"
router = APIRouter(prefix="/search", tags=["Search"])


# ============== Models ==============

class SearchResult(BaseModel):
    type: str  # 'post', 'event', 'user', 'neighborhood'
    id: str
    title: str
    subtitle: Optional[str]
    image_url: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    score: float  # Relevance score

class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    total: int
    took_ms: int


# ============== Database ==============

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ============== Routes ==============

@router.get("", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1, max_length=100),
    type: Optional[str] = Query(None, regex="^(post|event|user|neighborhood|all)$"),
    limit: int = Query(20, le=50)
):
    """
    Universal search across posts, events, users, and neighborhoods.
    """
    import time
    start_time = time.time()
    
    search_type = type or "all"
    query = q.lower().strip()
    results = []
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Search posts (by caption and neighborhood)
    if search_type in ("all", "post"):
        cursor.execute("""
            SELECT id, media_url, caption, neighborhood, latitude, longitude,
                   CASE 
                       WHEN LOWER(caption) LIKE ? THEN 10
                       WHEN LOWER(neighborhood) LIKE ? THEN 8
                       ELSE 5
                   END as score
            FROM posts
            WHERE visibility = 'public' 
              AND (LOWER(caption) LIKE ? OR LOWER(neighborhood) LIKE ?)
            ORDER BY score DESC, timestamp DESC
            LIMIT ?
        """, (f"%{query}%", f"%{query}%", f"%{query}%", f"%{query}%", limit))
        
        for row in cursor.fetchall():
            results.append(SearchResult(
                type="post",
                id=row['id'],
                title=row['caption'][:50] if row['caption'] else row['neighborhood'] or "Photo",
                subtitle=row['neighborhood'],
                image_url=row['media_url'],
                latitude=row['latitude'],
                longitude=row['longitude'],
                score=row['score']
            ))
    
    # Search events
    if search_type in ("all", "event"):
        cursor.execute("""
            SELECT id, name, neighborhood, center_lat, center_lng, post_count,
                   CASE 
                       WHEN LOWER(name) LIKE ? THEN 10
                       WHEN LOWER(neighborhood) LIKE ? THEN 8
                       ELSE 5
                   END as score
            FROM events
            WHERE LOWER(name) LIKE ? OR LOWER(neighborhood) LIKE ?
            ORDER BY score DESC, heat_score DESC
            LIMIT ?
        """, (f"%{query}%", f"%{query}%", f"%{query}%", f"%{query}%", limit))
        
        for row in cursor.fetchall():
            results.append(SearchResult(
                type="event",
                id=row['id'],
                title=row['name'],
                subtitle=f"{row['post_count']} photos · {row['neighborhood']}",
                image_url=None,
                latitude=row['center_lat'],
                longitude=row['center_lng'],
                score=row['score']
            ))
    
    # Search users
    if search_type in ("all", "user"):
        cursor.execute("""
            SELECT id, username, display_name, avatar_url,
                   CASE 
                       WHEN LOWER(username) = ? THEN 20
                       WHEN LOWER(username) LIKE ? THEN 15
                       WHEN LOWER(display_name) LIKE ? THEN 10
                       ELSE 5
                   END as score
            FROM users
            WHERE is_active = 1 
              AND (LOWER(username) LIKE ? OR LOWER(display_name) LIKE ?)
            ORDER BY score DESC
            LIMIT ?
        """, (query, f"%{query}%", f"%{query}%", f"%{query}%", f"%{query}%", limit))
        
        for row in cursor.fetchall():
            results.append(SearchResult(
                type="user",
                id=row['id'],
                title=row['display_name'] or row['username'],
                subtitle=f"@{row['username']}",
                image_url=row['avatar_url'],
                latitude=None,
                longitude=None,
                score=row['score']
            ))
    
    # Search neighborhoods
    if search_type in ("all", "neighborhood"):
        cursor.execute("""
            SELECT neighborhood, COUNT(*) as post_count,
                   AVG(latitude) as lat, AVG(longitude) as lng,
                   CASE 
                       WHEN LOWER(neighborhood) = ? THEN 20
                       WHEN LOWER(neighborhood) LIKE ? THEN 15
                       ELSE 10
                   END as score
            FROM posts
            WHERE neighborhood IS NOT NULL 
              AND LOWER(neighborhood) LIKE ?
            GROUP BY neighborhood
            ORDER BY score DESC, post_count DESC
            LIMIT ?
        """, (query, f"{query}%", f"%{query}%", limit))
        
        for row in cursor.fetchall():
            results.append(SearchResult(
                type="neighborhood",
                id=row['neighborhood'],
                title=row['neighborhood'],
                subtitle=f"{row['post_count']} posts",
                image_url=None,
                latitude=row['lat'],
                longitude=row['lng'],
                score=row['score']
            ))
    
    conn.close()
    
    # Sort by score and dedupe
    results.sort(key=lambda x: x.score, reverse=True)
    results = results[:limit]
    
    took_ms = int((time.time() - start_time) * 1000)
    
    return SearchResponse(
        query=q,
        results=results,
        total=len(results),
        took_ms=took_ms
    )


@router.get("/nearby")
async def search_nearby(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(1.0, ge=0.1, le=50),
    type: Optional[str] = Query("all", regex="^(post|event|all)$"),
    limit: int = Query(50, le=100)
):
    """
    Search for posts and events near a location.
    """
    # Convert km to approximate degrees
    lat_delta = radius_km / 111
    lng_delta = radius_km / 85  # Approximate for NYC latitude
    
    conn = get_db()
    cursor = conn.cursor()
    
    results = []
    
    if type in ("all", "post"):
        cursor.execute("""
            SELECT id, media_url, caption, neighborhood, latitude, longitude, timestamp
            FROM posts
            WHERE visibility = 'public'
              AND latitude BETWEEN ? AND ?
              AND longitude BETWEEN ? AND ?
            ORDER BY timestamp DESC
            LIMIT ?
        """, (lat - lat_delta, lat + lat_delta, lng - lng_delta, lng + lng_delta, limit))
        
        for row in cursor.fetchall():
            results.append({
                "type": "post",
                "id": row['id'],
                "media_url": row['media_url'],
                "caption": row['caption'],
                "neighborhood": row['neighborhood'],
                "latitude": row['latitude'],
                "longitude": row['longitude'],
                "timestamp": row['timestamp']
            })
    
    if type in ("all", "event"):
        cursor.execute("""
            SELECT id, name, neighborhood, center_lat, center_lng, post_count, heat_score
            FROM events
            WHERE center_lat BETWEEN ? AND ?
              AND center_lng BETWEEN ? AND ?
            ORDER BY heat_score DESC
            LIMIT ?
        """, (lat - lat_delta, lat + lat_delta, lng - lng_delta, lng + lng_delta, limit))
        
        for row in cursor.fetchall():
            results.append({
                "type": "event",
                "id": row['id'],
                "name": row['name'],
                "neighborhood": row['neighborhood'],
                "latitude": row['center_lat'],
                "longitude": row['center_lng'],
                "post_count": row['post_count'],
                "heat_score": row['heat_score']
            })
    
    conn.close()
    
    return {
        "center": {"lat": lat, "lng": lng},
        "radius_km": radius_km,
        "results": results,
        "total": len(results)
    }


@router.get("/trending")
async def get_trending(
    hours: int = Query(24, ge=1, le=168),
    limit: int = Query(10, le=50)
):
    """
    Get trending events and neighborhoods based on recent activity.
    """
    conn = get_db()
    cursor = conn.cursor()
    
    cutoff = (datetime.now() - timedelta(hours=hours)).isoformat()
    
    # Trending events (by recent posts)
    cursor.execute("""
        SELECT e.id, e.name, e.neighborhood, e.center_lat, e.center_lng,
               COUNT(p.id) as recent_posts, e.heat_score
        FROM events e
        LEFT JOIN posts p ON p.event_id = e.id AND p.timestamp > ?
        GROUP BY e.id
        ORDER BY recent_posts DESC, e.heat_score DESC
        LIMIT ?
    """, (cutoff, limit))
    
    trending_events = [dict(row) for row in cursor.fetchall()]
    
    # Trending neighborhoods
    cursor.execute("""
        SELECT neighborhood, COUNT(*) as post_count,
               AVG(latitude) as lat, AVG(longitude) as lng
        FROM posts
        WHERE timestamp > ? AND neighborhood IS NOT NULL
        GROUP BY neighborhood
        ORDER BY post_count DESC
        LIMIT ?
    """, (cutoff, limit))
    
    trending_neighborhoods = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    
    return {
        "period_hours": hours,
        "trending_events": trending_events,
        "trending_neighborhoods": trending_neighborhoods
    }


@router.get("/autocomplete")
async def autocomplete(
    q: str = Query(..., min_length=1, max_length=50),
    limit: int = Query(5, le=10)
):
    """
    Quick autocomplete suggestions for search.
    """
    query = q.lower().strip()
    conn = get_db()
    cursor = conn.cursor()
    
    suggestions = []
    
    # Neighborhood suggestions
    cursor.execute("""
        SELECT DISTINCT neighborhood, COUNT(*) as count
        FROM posts
        WHERE neighborhood IS NOT NULL AND LOWER(neighborhood) LIKE ?
        GROUP BY neighborhood
        ORDER BY count DESC
        LIMIT ?
    """, (f"{query}%", limit))
    
    for row in cursor.fetchall():
        suggestions.append({
            "type": "neighborhood",
            "value": row['neighborhood'],
            "label": f"📍 {row['neighborhood']}"
        })
    
    # User suggestions
    cursor.execute("""
        SELECT username, display_name
        FROM users
        WHERE is_active = 1 AND (LOWER(username) LIKE ? OR LOWER(display_name) LIKE ?)
        LIMIT ?
    """, (f"{query}%", f"{query}%", limit))
    
    for row in cursor.fetchall():
        suggestions.append({
            "type": "user",
            "value": row['username'],
            "label": f"👤 {row['display_name'] or row['username']}"
        })
    
    conn.close()
    
    return suggestions[:limit]
