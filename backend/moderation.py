"""
Kalulu AI Moderation Module
Content moderation with pluggable AI backends (AWS Rekognition, Google Vision, etc.)
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
import sqlite3
import uuid
import os
import base64

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel

DB_PATH = "kalulu.db"
router = APIRouter(prefix="/moderation", tags=["Moderation"])


# ============== Configuration ==============

# Set to True to enable AI moderation (requires AWS credentials)
MODERATION_ENABLED = os.environ.get("MODERATION_ENABLED", "false").lower() == "true"

# Thresholds for auto-actions
NSFW_THRESHOLD = 0.8       # Auto-remove if confidence > 80%
VIOLENCE_THRESHOLD = 0.8
REVIEW_THRESHOLD = 0.5     # Flag for human review if confidence > 50%


# ============== Models ==============

class ModerationStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    FLAGGED = "flagged"  # Needs human review

class ModerationCategory(str, Enum):
    NSFW = "nsfw"
    VIOLENCE = "violence"
    HATE = "hate"
    SPAM = "spam"
    OTHER = "other"

class ModerationResult(BaseModel):
    post_id: str
    status: ModerationStatus
    categories: Dict[str, float]  # Category -> confidence
    flagged_categories: List[str]
    auto_action: Optional[str]
    reviewed_at: datetime

class ModerationReport(BaseModel):
    post_id: str
    reason: ModerationCategory
    details: Optional[str] = None

class ModerationStats(BaseModel):
    total_reviewed: int
    approved: int
    rejected: int
    flagged: int
    pending: int


# ============== Database ==============

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_moderation_tables():
    """Initialize moderation tables"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Moderation results table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS moderation_results (
            id TEXT PRIMARY KEY,
            post_id TEXT UNIQUE NOT NULL,
            status TEXT DEFAULT 'pending',
            categories TEXT,
            flagged_categories TEXT,
            auto_action TEXT,
            reviewed_at DATETIME,
            reviewer_id TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES posts(id)
        )
    """)
    
    # User reports table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reports (
            id TEXT PRIMARY KEY,
            post_id TEXT NOT NULL,
            reporter_id TEXT,
            reason TEXT NOT NULL,
            details TEXT,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES posts(id)
        )
    """)
    
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_moderation_post ON moderation_results(post_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_moderation_status ON moderation_results(status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_reports_post ON reports(post_id)")
    
    conn.commit()
    conn.close()

init_moderation_tables()


# ============== AI Backend (Pluggable) ==============

class ModerationBackend:
    """Base class for moderation backends"""
    
    async def analyze_image(self, image_path: str) -> Dict[str, float]:
        """
        Analyze image and return category confidences.
        Returns dict like: {"nsfw": 0.1, "violence": 0.05, "hate": 0.0}
        """
        raise NotImplementedError


class MockModerationBackend(ModerationBackend):
    """Mock backend for testing (always approves)"""
    
    async def analyze_image(self, image_path: str) -> Dict[str, float]:
        # Return low confidence for all categories (safe)
        return {
            "nsfw": 0.02,
            "violence": 0.01,
            "hate": 0.0,
            "spam": 0.05
        }


class AWSRekognitionBackend(ModerationBackend):
    """AWS Rekognition moderation backend"""
    
    def __init__(self):
        try:
            import boto3
            self.client = boto3.client('rekognition')
        except ImportError:
            raise RuntimeError("boto3 required for AWS Rekognition")
    
    async def analyze_image(self, image_path: str) -> Dict[str, float]:
        # Read image
        with open(image_path, 'rb') as f:
            image_bytes = f.read()
        
        # Call Rekognition
        response = self.client.detect_moderation_labels(
            Image={'Bytes': image_bytes},
            MinConfidence=20
        )
        
        # Map Rekognition labels to our categories
        categories = {"nsfw": 0.0, "violence": 0.0, "hate": 0.0, "spam": 0.0}
        
        for label in response.get('ModerationLabels', []):
            name = label['Name'].lower()
            confidence = label['Confidence'] / 100.0
            
            if 'nudity' in name or 'sexual' in name or 'explicit' in name:
                categories['nsfw'] = max(categories['nsfw'], confidence)
            elif 'violence' in name or 'gore' in name or 'weapon' in name:
                categories['violence'] = max(categories['violence'], confidence)
            elif 'hate' in name or 'offensive' in name:
                categories['hate'] = max(categories['hate'], confidence)
        
        return categories


# Select backend based on configuration
def get_moderation_backend() -> ModerationBackend:
    if MODERATION_ENABLED:
        try:
            return AWSRekognitionBackend()
        except:
            pass
    return MockModerationBackend()


# ============== Core Functions ==============

async def moderate_image(post_id: str, image_path: str, background_tasks: BackgroundTasks = None):
    """
    Moderate an image and store results.
    Can be called synchronously or as a background task.
    """
    backend = get_moderation_backend()
    
    try:
        # Analyze image
        categories = await backend.analyze_image(image_path)
        
        # Determine status and action
        status = ModerationStatus.APPROVED
        auto_action = None
        flagged = []
        
        # Check each category
        for category, confidence in categories.items():
            if category == "nsfw" and confidence >= NSFW_THRESHOLD:
                status = ModerationStatus.REJECTED
                auto_action = "auto_removed_nsfw"
                flagged.append(category)
            elif category == "violence" and confidence >= VIOLENCE_THRESHOLD:
                status = ModerationStatus.REJECTED
                auto_action = "auto_removed_violence"
                flagged.append(category)
            elif confidence >= REVIEW_THRESHOLD:
                if status != ModerationStatus.REJECTED:
                    status = ModerationStatus.FLAGGED
                flagged.append(category)
        
        # Store result
        conn = get_db()
        cursor = conn.cursor()
        
        import json
        result_id = str(uuid.uuid4())[:8]
        now = datetime.now()
        
        cursor.execute("""
            INSERT OR REPLACE INTO moderation_results 
            (id, post_id, status, categories, flagged_categories, auto_action, reviewed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            result_id,
            post_id,
            status.value,
            json.dumps(categories),
            json.dumps(flagged),
            auto_action,
            now.isoformat()
        ))
        
        # If rejected, hide the post
        if status == ModerationStatus.REJECTED:
            cursor.execute("""
                UPDATE posts SET visibility = 'hidden' WHERE id = ?
            """, (post_id,))
        
        conn.commit()
        conn.close()
        
        return ModerationResult(
            post_id=post_id,
            status=status,
            categories=categories,
            flagged_categories=flagged,
            auto_action=auto_action,
            reviewed_at=now
        )
        
    except Exception as e:
        print(f"Moderation error for post {post_id}: {e}")
        # On error, flag for manual review
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO moderation_results 
            (id, post_id, status, notes, reviewed_at)
            VALUES (?, ?, 'flagged', ?, ?)
        """, (str(uuid.uuid4())[:8], post_id, f"Error: {str(e)}", datetime.now().isoformat()))
        conn.commit()
        conn.close()
        return None


# ============== Routes ==============

@router.get("/status/{post_id}")
async def get_moderation_status(post_id: str):
    """Get moderation status for a post"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT * FROM moderation_results WHERE post_id = ?
    """, (post_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return {"post_id": post_id, "status": "not_reviewed"}
    
    import json
    return {
        "post_id": post_id,
        "status": row['status'],
        "categories": json.loads(row['categories']) if row['categories'] else {},
        "flagged_categories": json.loads(row['flagged_categories']) if row['flagged_categories'] else [],
        "auto_action": row['auto_action'],
        "reviewed_at": row['reviewed_at']
    }


@router.post("/report")
async def report_post(report: ModerationReport, reporter_id: Optional[str] = None):
    """Report a post for moderation review"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Check post exists
    cursor.execute("SELECT id FROM posts WHERE id = ?", (report.post_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Create report
    report_id = str(uuid.uuid4())[:8]
    cursor.execute("""
        INSERT INTO reports (id, post_id, reporter_id, reason, details)
        VALUES (?, ?, ?, ?, ?)
    """, (report_id, report.post_id, reporter_id, report.reason.value, report.details))
    
    # Flag post for review
    cursor.execute("""
        INSERT OR IGNORE INTO moderation_results (id, post_id, status, notes)
        VALUES (?, ?, 'flagged', 'User reported')
    """, (str(uuid.uuid4())[:8], report.post_id))
    
    conn.commit()
    conn.close()
    
    return {"message": "Report submitted", "report_id": report_id}


@router.get("/stats", response_model=ModerationStats)
async def get_moderation_stats():
    """Get moderation statistics"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as count FROM moderation_results")
    total = cursor.fetchone()['count']
    
    cursor.execute("SELECT COUNT(*) as count FROM moderation_results WHERE status = 'approved'")
    approved = cursor.fetchone()['count']
    
    cursor.execute("SELECT COUNT(*) as count FROM moderation_results WHERE status = 'rejected'")
    rejected = cursor.fetchone()['count']
    
    cursor.execute("SELECT COUNT(*) as count FROM moderation_results WHERE status = 'flagged'")
    flagged = cursor.fetchone()['count']
    
    cursor.execute("SELECT COUNT(*) as count FROM moderation_results WHERE status = 'pending'")
    pending = cursor.fetchone()['count']
    
    conn.close()
    
    return ModerationStats(
        total_reviewed=total,
        approved=approved,
        rejected=rejected,
        flagged=flagged,
        pending=pending
    )


@router.get("/queue")
async def get_moderation_queue(
    status: Optional[str] = "flagged",
    limit: int = 50
):
    """Get posts awaiting moderation review"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT m.*, p.media_url, p.caption, p.neighborhood, p.user_id
        FROM moderation_results m
        JOIN posts p ON m.post_id = p.id
        WHERE m.status = ?
        ORDER BY m.created_at DESC
        LIMIT ?
    """, (status, limit))
    
    rows = cursor.fetchall()
    conn.close()
    
    import json
    return [
        {
            "post_id": row['post_id'],
            "status": row['status'],
            "categories": json.loads(row['categories']) if row['categories'] else {},
            "media_url": row['media_url'],
            "caption": row['caption'],
            "neighborhood": row['neighborhood'],
            "user_id": row['user_id'],
            "created_at": row['created_at']
        }
        for row in rows
    ]


@router.post("/review/{post_id}")
async def review_post(
    post_id: str,
    action: str,  # 'approve' or 'reject'
    reviewer_id: str = "admin",
    notes: Optional[str] = None
):
    """Manually review and approve/reject a flagged post"""
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")
    
    conn = get_db()
    cursor = conn.cursor()
    
    status = ModerationStatus.APPROVED if action == "approve" else ModerationStatus.REJECTED
    
    cursor.execute("""
        UPDATE moderation_results 
        SET status = ?, reviewer_id = ?, notes = ?, reviewed_at = ?
        WHERE post_id = ?
    """, (status.value, reviewer_id, notes, datetime.now().isoformat(), post_id))
    
    # Update post visibility
    if action == "reject":
        cursor.execute("UPDATE posts SET visibility = 'hidden' WHERE id = ?", (post_id,))
    elif action == "approve":
        cursor.execute("UPDATE posts SET visibility = 'public' WHERE id = ?", (post_id,))
    
    conn.commit()
    conn.close()
    
    return {"message": f"Post {action}d", "post_id": post_id}
