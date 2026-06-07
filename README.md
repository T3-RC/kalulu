# 🌆 Kalulu

**The living memory of your city.**

A social media platform for event-based photo sharing with location and timestamp metadata. Captures both major events (raves, concerts, protests) and everyday urban moments (weather, street scenes, neighborhood vibes).

## 🎯 Core Features

- **Photo Upload** with automatic location and timestamp capture
- **Auto Event Clustering** - AI groups nearby photos into events using DBSCAN
- **Interactive Map** - Explore your city through everyone's eyes
- **Neighborhood Detection** - Automatic tagging of NYC neighborhoods
- **Event Timelines** - See all photos from an event in chronological order
- **User Authentication** - JWT-based login and registration
- **Social Features** - Likes, comments, follows, personalized feed
- **Search** - Full-text and geo search across posts, events, users
- **AI Moderation** - Pluggable content moderation (AWS Rekognition ready)

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+ (for mobile app)

### Installation

```bash
# Clone / navigate to project
cd kalulu

# Install Python dependencies
cd backend
pip install -r requirements.txt

# Initialize database and seed demo data
python -c "from main import init_db; init_db()"
python seed_data.py

# Start the server
uvicorn main:app --reload
```

### Access the App

- **Frontend**: http://localhost:8000/app
- **API Docs**: http://localhost:8000/docs
- **API Root**: http://localhost:8000/

## 📁 Project Structure

```
kalulu/
├── backend/
│   ├── main.py           # FastAPI server + core endpoints
│   ├── auth.py           # JWT authentication
│   ├── social.py         # Likes, comments, follows
│   ├── search.py         # Search and trending
│   ├── moderation.py     # AI content moderation
│   ├── seed_data.py      # Demo data generator
│   ├── requirements.txt  # Python dependencies
│   ├── kalulu.db        # SQLite database
│   └── uploads/         # Uploaded images
├── frontend/
│   └── index.html       # Single-page web app
├── mobile/
│   ├── App.js           # Entry point + navigation
│   ├── src/
│   │   ├── screens/     # 8 screen components
│   │   ├── services/    # API, auth, state
│   │   ├── hooks/       # Location, data fetching
│   │   └── utils/       # Helpers
│   └── package.json     # Dependencies
└── start.sh             # Startup script
```

## 🔌 API Endpoints

### Core
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check |
| `GET` | `/stats` | Platform statistics |
| `POST` | `/posts` | Upload a new photo |
| `GET` | `/posts` | Get posts (with geo filters) |
| `GET` | `/posts/{id}` | Get single post |
| `GET` | `/events` | Get auto-detected events |
| `GET` | `/events/{id}` | Get event with posts |
| `GET` | `/neighborhoods` | Get active neighborhoods |
| `POST` | `/cluster` | Manually trigger clustering |

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Create account |
| `POST` | `/auth/login` | Login, get token |
| `POST` | `/auth/logout` | Invalidate token |
| `GET` | `/auth/me` | Get current user |
| `PATCH` | `/auth/me` | Update profile |

### Social
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/posts/{id}/like` | Like a post |
| `DELETE` | `/posts/{id}/like` | Unlike a post |
| `POST` | `/posts/{id}/comments` | Add comment |
| `GET` | `/posts/{id}/comments` | Get comments |
| `POST` | `/users/{username}/follow` | Follow user |
| `DELETE` | `/users/{username}/follow` | Unfollow |
| `GET` | `/feed/following` | Posts from followed users |

### Search
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/search?q=...` | Universal search |
| `GET` | `/search/nearby` | Geo-based search |
| `GET` | `/search/trending` | Trending events/neighborhoods |
| `GET` | `/search/autocomplete` | Search suggestions |

### Moderation
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/moderation/status/{id}` | Check moderation status |
| `POST` | `/moderation/report` | Report content |
| `GET` | `/moderation/queue` | Review queue (admin) |
| `POST` | `/moderation/review/{id}` | Approve/reject (admin) |

### Query Parameters (Posts & Events)

- `min_lat`, `max_lat`, `min_lng`, `max_lng` - Bounding box filter
- `neighborhood` - Filter by neighborhood name
- `event_id` - Filter posts by event
- `limit`, `offset` - Pagination

### Upload a Photo

```bash
curl -X POST http://localhost:8000/posts \
  -F "file=@photo.jpg" \
  -F "latitude=40.7308" \
  -F "longitude=-73.9973" \
  -F "caption=Amazing night!" \
  -F "timestamp=2024-01-15T23:45:00"
```

## 🧠 Event Clustering Algorithm

Posts are automatically grouped into events using DBSCAN clustering:

1. Fetch posts from last 24 hours
2. Create feature vector: `[lat * 111km, lng * 85km, time_scaled]`
3. Run DBSCAN with `eps=150m`, `min_samples=3`
4. Create event records for each cluster
5. Auto-generate event names based on neighborhood + time

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Python, FastAPI, SQLite |
| **Frontend** | Vanilla JS, Leaflet.js |
| **Clustering** | scikit-learn (DBSCAN) |
| **Maps** | Leaflet + CartoDB Dark tiles |
| **Storage** | Local filesystem (S3-ready) |

## 📱 Mobile App

The mobile app is built with React Native + Expo.

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go app to test on your phone.

See `mobile/README.md` for full documentation.

## 🗺️ NYC Neighborhoods Supported

- East Village, West Village, SoHo, Lower East Side
- Chelsea, Midtown, Times Square
- Williamsburg, Bushwick, Greenpoint
- DUMBO, Brooklyn Heights
- (Expandable via coordinate boundaries)

## 📈 Scaling to Production

### Database → PostgreSQL + PostGIS
```python
# Replace SQLite with:
DATABASE_URL = "postgresql://user:pass@localhost/kalulu"
# Use PostGIS for geo queries:
# ST_DWithin, ST_Distance, etc.
```

### Storage → S3/Cloudflare R2
```python
# Replace local storage with:
import boto3
s3 = boto3.client('s3')
s3.upload_fileobj(file, 'kalulu-uploads', filename)
```

### Add Redis for caching
```python
import redis
r = redis.Redis()
# Cache trending events, nearby posts, etc.
```

### Add real-time updates
```python
from fastapi import WebSocket
# Pub/sub for live event feeds
```

## 🎨 Roadmap

**Already in the MVP** (see Core Features above)

- [x] User authentication (JWT)
- [x] React Native mobile app
- [x] AI image moderation (stubbed, AWS Rekognition-ready)
- [x] Event heat scores & trending

**Planned**

- [ ] Migrate to SpacetimeDB for real-time sync (see `HANDOFF.md`)
- [ ] Cloud image pipeline (Cloudflare R2 / S3 + thumbnails)
- [ ] Face clustering (opt-in)
- [ ] Weather event detection
- [ ] Venue partnerships
- [ ] "Who was there?" social discovery

## 📄 License

MIT - Built with ❤️ in NYC

---

**Questions?** This is a demo/MVP. See positioning docs for full product vision.
