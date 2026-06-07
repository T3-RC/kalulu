#!/bin/bash
# Kalulu Demo Startup Script

echo "🚀 Starting Kalulu Demo..."
echo ""

cd /home/claude/kalulu/backend

# Check if database exists, seed if not
if [ ! -f "kalulu.db" ] || [ ! -s "kalulu.db" ]; then
    echo "📦 Initializing database..."
    python -c "from main import init_db; init_db()"
    python seed_data.py
    echo ""
fi

echo "🌐 Starting API server on http://localhost:8000"
echo "📱 Frontend available at http://localhost:8000/app"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start uvicorn
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
