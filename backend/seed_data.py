"""
Seed script for Kalulu demo
Creates sample posts across NYC neighborhoods to demonstrate clustering
"""

import sqlite3
import uuid
import json
import random
from datetime import datetime, timedelta
import os
import urllib.request

# Seed data - NYC locations with realistic coordinates
NYC_LOCATIONS = [
    # East Village rave scene
    {"name": "Webster Hall Area", "lat": 40.7319, "lng": -73.9897, "hood": "East Village", "vibe": "nightlife"},
    {"name": "Tompkins Square", "lat": 40.7265, "lng": -73.9817, "hood": "East Village", "vibe": "park"},
    {"name": "St Marks Place", "lat": 40.7295, "lng": -73.9877, "hood": "East Village", "vibe": "nightlife"},
    
    # Williamsburg
    {"name": "Elsewhere", "lat": 40.7044, "lng": -73.9235, "hood": "Bushwick", "vibe": "nightlife"},
    {"name": "Brooklyn Steel", "lat": 40.7191, "lng": -73.9384, "hood": "Williamsburg", "vibe": "concert"},
    {"name": "McCarren Park", "lat": 40.7200, "lng": -73.9518, "hood": "Williamsburg", "vibe": "park"},
    {"name": "Bedford Ave", "lat": 40.7142, "lng": -73.9614, "hood": "Williamsburg", "vibe": "street"},
    
    # Bushwick
    {"name": "House of Yes Area", "lat": 40.7046, "lng": -73.9232, "hood": "Bushwick", "vibe": "nightlife"},
    {"name": "Knockdown Center", "lat": 40.7148, "lng": -73.9089, "hood": "Bushwick", "vibe": "venue"},
    
    # SoHo
    {"name": "SoHo Streets", "lat": 40.7233, "lng": -73.9983, "hood": "SoHo", "vibe": "street"},
    {"name": "Prince Street", "lat": 40.7243, "lng": -73.9978, "hood": "SoHo", "vibe": "shopping"},
    
    # West Village
    {"name": "Washington Square Park", "lat": 40.7308, "lng": -73.9973, "hood": "West Village", "vibe": "park"},
    {"name": "Bleecker Street", "lat": 40.7290, "lng": -74.0024, "hood": "West Village", "vibe": "street"},
    
    # Chelsea / Meatpacking
    {"name": "High Line", "lat": 40.7480, "lng": -74.0048, "hood": "Chelsea", "vibe": "park"},
    {"name": "Chelsea Market", "lat": 40.7424, "lng": -74.0060, "hood": "Chelsea", "vibe": "food"},
    
    # Lower East Side
    {"name": "LES Bars", "lat": 40.7186, "lng": -73.9886, "hood": "Lower East Side", "vibe": "nightlife"},
    {"name": "Seward Park", "lat": 40.7148, "lng": -73.9889, "hood": "Lower East Side", "vibe": "park"},
    
    # DUMBO
    {"name": "DUMBO Waterfront", "lat": 40.7033, "lng": -73.9897, "hood": "DUMBO", "vibe": "scenic"},
    {"name": "Brooklyn Bridge Park", "lat": 40.7024, "lng": -73.9956, "hood": "DUMBO", "vibe": "park"},
    
    # Midtown
    {"name": "Times Square", "lat": 40.7580, "lng": -73.9855, "hood": "Times Square", "vibe": "tourist"},
    {"name": "Bryant Park", "lat": 40.7536, "lng": -73.9832, "hood": "Midtown", "vibe": "park"},
    
    # Greenpoint
    {"name": "Transmitter Park", "lat": 40.7326, "lng": -73.9605, "hood": "Greenpoint", "vibe": "park"},
    {"name": "Nassau Ave", "lat": 40.7241, "lng": -73.9511, "hood": "Greenpoint", "vibe": "street"},
]

# Sample captions by vibe
CAPTIONS = {
    "nightlife": [
        "The bass is unreal tonight 🔊",
        "3am and still going strong",
        "This DJ is absolutely killing it",
        "Crowd energy is insane",
        "Best night out in months",
        "When the drop hits different 🎵",
        "Underground vibes only",
        "Lost in the music",
        None,  # Some posts have no caption
        None,
    ],
    "park": [
        "Perfect day in the city",
        "Finally some sunshine ☀️",
        "City life but make it peaceful",
        "Best people watching spot",
        "Golden hour hits different here",
        None,
        None,
    ],
    "street": [
        "NYC street magic",
        "This city never gets old",
        "Random Tuesday adventures",
        "The architecture here 😍",
        "Found this hidden gem",
        None,
        None,
    ],
    "concert": [
        "Front row energy",
        "Sound system is incredible",
        "This venue is perfect",
        "Bucket list moment",
        None,
    ],
    "venue": [
        "What a space",
        "Immersive experience",
        "Art meets music",
        None,
    ],
    "scenic": [
        "Skyline never gets old",
        "Best view in Brooklyn",
        "Magic hour",
        "City of dreams",
        None,
    ],
    "food": [
        "Best meal I've had in a while",
        "Food coma incoming",
        "Hidden gem found",
        None,
    ],
    "shopping": [
        "Weekend wandering",
        "Window shopping therapy",
        None,
    ],
    "tourist": [
        "Finally made it",
        "Chaos but I love it",
        "NYC bucket list ✓",
        None,
    ],
}

def download_placeholder_image(filename):
    """Download a random placeholder image"""
    # Use picsum.photos for random images
    width, height = 800, 600
    url = f"https://picsum.photos/{width}/{height}"
    
    filepath = os.path.join("uploads", filename)
    try:
        urllib.request.urlretrieve(url, filepath)
        return True
    except:
        # Create a simple colored rectangle as fallback
        return False

def create_placeholder_image(filename, color_index=0):
    """Create a simple placeholder image using pure Python"""
    # Simple solid color PNG
    colors = [
        (102, 126, 234),  # Purple-blue
        (118, 75, 162),   # Purple
        (236, 72, 153),   # Pink
        (251, 146, 60),   # Orange
        (34, 197, 94),    # Green
        (59, 130, 246),   # Blue
        (168, 85, 247),   # Violet
    ]
    
    color = colors[color_index % len(colors)]
    width, height = 400, 300
    
    # Create a simple BMP file (easier than PNG without libraries)
    filepath = os.path.join("uploads", filename.replace('.jpg', '.bmp'))
    
    # BMP header
    row_size = (width * 3 + 3) & ~3  # Row size must be multiple of 4
    pixel_data_size = row_size * height
    file_size = 54 + pixel_data_size
    
    with open(filepath, 'wb') as f:
        # BMP Header
        f.write(b'BM')  # Signature
        f.write(file_size.to_bytes(4, 'little'))  # File size
        f.write(b'\x00\x00\x00\x00')  # Reserved
        f.write((54).to_bytes(4, 'little'))  # Data offset
        
        # DIB Header
        f.write((40).to_bytes(4, 'little'))  # DIB header size
        f.write(width.to_bytes(4, 'little'))  # Width
        f.write(height.to_bytes(4, 'little'))  # Height
        f.write((1).to_bytes(2, 'little'))  # Color planes
        f.write((24).to_bytes(2, 'little'))  # Bits per pixel
        f.write((0).to_bytes(4, 'little'))  # Compression
        f.write(pixel_data_size.to_bytes(4, 'little'))  # Image size
        f.write((2835).to_bytes(4, 'little'))  # X pixels per meter
        f.write((2835).to_bytes(4, 'little'))  # Y pixels per meter
        f.write((0).to_bytes(4, 'little'))  # Colors in color table
        f.write((0).to_bytes(4, 'little'))  # Important colors
        
        # Pixel data (BGR format, bottom to top)
        padding = row_size - (width * 3)
        for y in range(height):
            for x in range(width):
                # Add some variation based on position
                r = min(255, color[0] + (y % 30) - 15)
                g = min(255, color[1] + (x % 30) - 15)
                b = min(255, color[2] + ((x + y) % 20) - 10)
                f.write(bytes([b, g, r]))  # BGR order
            f.write(b'\x00' * padding)
    
    return filepath.replace('uploads/', '')

def add_noise(lat, lng, meters=50):
    """Add random noise to coordinates (roughly in meters)"""
    # 1 degree latitude ≈ 111km
    # 1 degree longitude ≈ 85km at NYC latitude
    lat_noise = (random.random() - 0.5) * 2 * (meters / 111000)
    lng_noise = (random.random() - 0.5) * 2 * (meters / 85000)
    return lat + lat_noise, lng + lng_noise

def seed_database():
    """Create sample posts for the demo"""
    
    os.makedirs("uploads", exist_ok=True)
    
    conn = sqlite3.connect("kalulu.db")
    cursor = conn.cursor()
    
    # Clear existing data
    cursor.execute("DELETE FROM posts")
    cursor.execute("DELETE FROM events")
    conn.commit()
    
    posts_created = 0
    
    # Create events (clusters of posts)
    events_to_create = [
        # Recent rave (last night)
        {
            "locations": ["Webster Hall Area", "St Marks Place"],
            "time_offset_hours": -8,
            "num_posts": 12,
            "duration_hours": 4,
        },
        # Bushwick party (2 nights ago)
        {
            "locations": ["House of Yes Area", "Elsewhere"],
            "time_offset_hours": -32,
            "num_posts": 15,
            "duration_hours": 5,
        },
        # Park hangout (yesterday afternoon)
        {
            "locations": ["Washington Square Park"],
            "time_offset_hours": -20,
            "num_posts": 8,
            "duration_hours": 3,
        },
        # Williamsburg weekend
        {
            "locations": ["McCarren Park", "Bedford Ave"],
            "time_offset_hours": -48,
            "num_posts": 10,
            "duration_hours": 4,
        },
        # DUMBO sunset
        {
            "locations": ["DUMBO Waterfront", "Brooklyn Bridge Park"],
            "time_offset_hours": -26,
            "num_posts": 6,
            "duration_hours": 2,
        },
    ]
    
    for event in events_to_create:
        base_time = datetime.now() + timedelta(hours=event["time_offset_hours"])
        
        for i in range(event["num_posts"]):
            # Pick a location from the event's locations
            loc_name = random.choice(event["locations"])
            loc = next(l for l in NYC_LOCATIONS if l["name"] == loc_name)
            
            # Add noise to position
            lat, lng = add_noise(loc["lat"], loc["lng"], meters=80)
            
            # Spread posts across event duration
            time_offset = random.uniform(0, event["duration_hours"]) * 3600
            post_time = base_time + timedelta(seconds=time_offset)
            
            # Get caption
            captions = CAPTIONS.get(loc["vibe"], [None])
            caption = random.choice(captions)
            
            # Create image
            post_id = str(uuid.uuid4())[:8]
            filename = create_placeholder_image(f"{post_id}.jpg", posts_created)
            
            # Insert post
            cursor.execute("""
                INSERT INTO posts (id, user_id, media_url, latitude, longitude, 
                                  timestamp, caption, neighborhood, tags, visibility)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'public')
            """, (
                post_id,
                f"user_{random.randint(100, 999)}",
                f"/uploads/{filename}",
                lat,
                lng,
                post_time.isoformat(),
                caption,
                loc["hood"],
                json.dumps([loc["vibe"]]),
            ))
            
            posts_created += 1
    
    # Add some scattered individual posts
    for _ in range(20):
        loc = random.choice(NYC_LOCATIONS)
        lat, lng = add_noise(loc["lat"], loc["lng"], meters=100)
        
        # Random time in last week
        post_time = datetime.now() - timedelta(hours=random.uniform(0, 168))
        
        captions = CAPTIONS.get(loc["vibe"], [None])
        caption = random.choice(captions)
        
        post_id = str(uuid.uuid4())[:8]
        filename = create_placeholder_image(f"{post_id}.jpg", posts_created)
        
        cursor.execute("""
            INSERT INTO posts (id, user_id, media_url, latitude, longitude, 
                              timestamp, caption, neighborhood, tags, visibility)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'public')
        """, (
            post_id,
            f"user_{random.randint(100, 999)}",
            f"/uploads/{filename}",
            lat,
            lng,
            post_time.isoformat(),
            caption,
            loc["hood"],
            json.dumps([loc["vibe"]]),
        ))
        
        posts_created += 1
    
    conn.commit()
    conn.close()
    
    print(f"✅ Created {posts_created} sample posts")
    
    # Now run clustering
    print("🔄 Running event clustering...")
    
    # Import and run clustering
    import sys
    sys.path.insert(0, '.')
    from main import cluster_posts_into_events
    
    new_events = cluster_posts_into_events()
    print(f"✅ Created {len(new_events)} events from clustering")
    
    print("\n🎉 Database seeded successfully!")
    print("   Run the server with: uvicorn main:app --reload")

if __name__ == "__main__":
    seed_database()
