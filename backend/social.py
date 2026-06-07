"""
Kalulu Social Features
Likes, comments, follows, and social interactions
"""

from datetime import datetime
from typing import Optional, List
import sqlite3
import uuid

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from auth import get_current_user, require_auth

DB_PATH = "kalulu.db"
router = APIRouter(tags=["Social"])


# ============== Models ==============

class LikeResponse(BaseModel):
    post_id: str
    liked: bool
    like_count: int

class CommentCreate(BaseModel):
    content: str

class CommentResponse(BaseModel):
    id: str
    post_id: str
    user_id: str
    username: str
    display_name: Optional[str]
    avatar_url: Optional[str]
    content: str
    created_at: datetime

class FollowResponse(BaseModel):
    following: bool
    follower_count: int
    following_count: int

class UserListResponse(BaseModel):
    id: str
    username: str
    display_name: Optional[str]
    avatar_url: Optional[str]
    post_count: int


# ============== Database ==============

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_social_tables():
    """Initialize social tables"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Likes table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS likes (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            post_id TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, post_id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (post_id) REFERENCES posts(id)
        )
    """)
    
    # Comments table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS comments (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            post_id TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_deleted BOOLEAN DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (post_id) REFERENCES posts(id)
        )
    """)
    
    # Follows table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS follows (
            id TEXT PRIMARY KEY,
            follower_id TEXT NOT NULL,
            following_id TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(follower_id, following_id),
            FOREIGN KEY (follower_id) REFERENCES users(id),
            FOREIGN KEY (following_id) REFERENCES users(id)
        )
    """)
    
    # Create indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id)")
    
    conn.commit()
    conn.close()

init_social_tables()


# ============== Likes ==============

@router.post("/posts/{post_id}/like", response_model=LikeResponse)
async def like_post(post_id: str, user: dict = Depends(require_auth)):
    """Like a post"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Check post exists
    cursor.execute("SELECT id FROM posts WHERE id = ?", (post_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if already liked
    cursor.execute("""
        SELECT id FROM likes WHERE user_id = ? AND post_id = ?
    """, (user['id'], post_id))
    
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Already liked")
    
    # Create like
    like_id = str(uuid.uuid4())[:8]
    cursor.execute("""
        INSERT INTO likes (id, user_id, post_id) VALUES (?, ?, ?)
    """, (like_id, user['id'], post_id))
    
    # Get like count
    cursor.execute("SELECT COUNT(*) as count FROM likes WHERE post_id = ?", (post_id,))
    like_count = cursor.fetchone()['count']
    
    conn.commit()
    conn.close()
    
    return LikeResponse(post_id=post_id, liked=True, like_count=like_count)


@router.delete("/posts/{post_id}/like", response_model=LikeResponse)
async def unlike_post(post_id: str, user: dict = Depends(require_auth)):
    """Unlike a post"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        DELETE FROM likes WHERE user_id = ? AND post_id = ?
    """, (user['id'], post_id))
    
    # Get like count
    cursor.execute("SELECT COUNT(*) as count FROM likes WHERE post_id = ?", (post_id,))
    like_count = cursor.fetchone()['count']
    
    conn.commit()
    conn.close()
    
    return LikeResponse(post_id=post_id, liked=False, like_count=like_count)


@router.get("/posts/{post_id}/likes")
async def get_post_likes(
    post_id: str,
    user: Optional[dict] = Depends(get_current_user)
):
    """Get like count and whether current user liked"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as count FROM likes WHERE post_id = ?", (post_id,))
    like_count = cursor.fetchone()['count']
    
    user_liked = False
    if user:
        cursor.execute("""
            SELECT id FROM likes WHERE user_id = ? AND post_id = ?
        """, (user['id'], post_id))
        user_liked = cursor.fetchone() is not None
    
    conn.close()
    
    return {
        "post_id": post_id,
        "like_count": like_count,
        "user_liked": user_liked
    }


# ============== Comments ==============

@router.post("/posts/{post_id}/comments", response_model=CommentResponse)
async def create_comment(
    post_id: str,
    data: CommentCreate,
    user: dict = Depends(require_auth)
):
    """Add a comment to a post"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Check post exists
    cursor.execute("SELECT id FROM posts WHERE id = ?", (post_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Validate content
    if not data.content.strip():
        conn.close()
        raise HTTPException(status_code=400, detail="Comment cannot be empty")
    
    if len(data.content) > 500:
        conn.close()
        raise HTTPException(status_code=400, detail="Comment too long (max 500 chars)")
    
    # Create comment
    comment_id = str(uuid.uuid4())[:8]
    now = datetime.now()
    
    cursor.execute("""
        INSERT INTO comments (id, user_id, post_id, content, created_at)
        VALUES (?, ?, ?, ?, ?)
    """, (comment_id, user['id'], post_id, data.content.strip(), now.isoformat()))
    
    conn.commit()
    conn.close()
    
    return CommentResponse(
        id=comment_id,
        post_id=post_id,
        user_id=user['id'],
        username=user['username'],
        display_name=user['display_name'],
        avatar_url=user['avatar_url'],
        content=data.content.strip(),
        created_at=now
    )


@router.get("/posts/{post_id}/comments", response_model=List[CommentResponse])
async def get_comments(
    post_id: str,
    limit: int = Query(50, le=100),
    offset: int = Query(0)
):
    """Get comments for a post"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT c.*, u.username, u.display_name, u.avatar_url
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.post_id = ? AND c.is_deleted = 0
        ORDER BY c.created_at ASC
        LIMIT ? OFFSET ?
    """, (post_id, limit, offset))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [
        CommentResponse(
            id=row['id'],
            post_id=row['post_id'],
            user_id=row['user_id'],
            username=row['username'],
            display_name=row['display_name'],
            avatar_url=row['avatar_url'],
            content=row['content'],
            created_at=datetime.fromisoformat(row['created_at'])
        )
        for row in rows
    ]


@router.delete("/comments/{comment_id}")
async def delete_comment(comment_id: str, user: dict = Depends(require_auth)):
    """Delete own comment"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Check comment exists and belongs to user
    cursor.execute("""
        SELECT user_id FROM comments WHERE id = ? AND is_deleted = 0
    """, (comment_id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if row['user_id'] != user['id']:
        conn.close()
        raise HTTPException(status_code=403, detail="Cannot delete others' comments")
    
    cursor.execute("UPDATE comments SET is_deleted = 1 WHERE id = ?", (comment_id,))
    conn.commit()
    conn.close()
    
    return {"message": "Comment deleted"}


# ============== Follows ==============

@router.post("/users/{username}/follow", response_model=FollowResponse)
async def follow_user(username: str, user: dict = Depends(require_auth)):
    """Follow a user"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Get target user
    cursor.execute("SELECT id FROM users WHERE username = ?", (username.lower(),))
    target = cursor.fetchone()
    
    if not target:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    
    if target['id'] == user['id']:
        conn.close()
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    # Check if already following
    cursor.execute("""
        SELECT id FROM follows WHERE follower_id = ? AND following_id = ?
    """, (user['id'], target['id']))
    
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Already following")
    
    # Create follow
    follow_id = str(uuid.uuid4())[:8]
    cursor.execute("""
        INSERT INTO follows (id, follower_id, following_id)
        VALUES (?, ?, ?)
    """, (follow_id, user['id'], target['id']))
    
    # Get counts
    cursor.execute("SELECT COUNT(*) as count FROM follows WHERE following_id = ?", (target['id'],))
    follower_count = cursor.fetchone()['count']
    
    cursor.execute("SELECT COUNT(*) as count FROM follows WHERE follower_id = ?", (target['id'],))
    following_count = cursor.fetchone()['count']
    
    conn.commit()
    conn.close()
    
    return FollowResponse(
        following=True,
        follower_count=follower_count,
        following_count=following_count
    )


@router.delete("/users/{username}/follow", response_model=FollowResponse)
async def unfollow_user(username: str, user: dict = Depends(require_auth)):
    """Unfollow a user"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Get target user
    cursor.execute("SELECT id FROM users WHERE username = ?", (username.lower(),))
    target = cursor.fetchone()
    
    if not target:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    
    cursor.execute("""
        DELETE FROM follows WHERE follower_id = ? AND following_id = ?
    """, (user['id'], target['id']))
    
    # Get counts
    cursor.execute("SELECT COUNT(*) as count FROM follows WHERE following_id = ?", (target['id'],))
    follower_count = cursor.fetchone()['count']
    
    cursor.execute("SELECT COUNT(*) as count FROM follows WHERE follower_id = ?", (target['id'],))
    following_count = cursor.fetchone()['count']
    
    conn.commit()
    conn.close()
    
    return FollowResponse(
        following=False,
        follower_count=follower_count,
        following_count=following_count
    )


@router.get("/users/{username}/followers", response_model=List[UserListResponse])
async def get_followers(
    username: str,
    limit: int = Query(50, le=100),
    offset: int = Query(0)
):
    """Get user's followers"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM users WHERE username = ?", (username.lower(),))
    target = cursor.fetchone()
    
    if not target:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    
    cursor.execute("""
        SELECT u.id, u.username, u.display_name, u.avatar_url,
               (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as post_count
        FROM follows f
        JOIN users u ON f.follower_id = u.id
        WHERE f.following_id = ?
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
    """, (target['id'], limit, offset))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [
        UserListResponse(
            id=row['id'],
            username=row['username'],
            display_name=row['display_name'],
            avatar_url=row['avatar_url'],
            post_count=row['post_count']
        )
        for row in rows
    ]


@router.get("/users/{username}/following", response_model=List[UserListResponse])
async def get_following(
    username: str,
    limit: int = Query(50, le=100),
    offset: int = Query(0)
):
    """Get users that user is following"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM users WHERE username = ?", (username.lower(),))
    target = cursor.fetchone()
    
    if not target:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    
    cursor.execute("""
        SELECT u.id, u.username, u.display_name, u.avatar_url,
               (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as post_count
        FROM follows f
        JOIN users u ON f.following_id = u.id
        WHERE f.follower_id = ?
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
    """, (target['id'], limit, offset))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [
        UserListResponse(
            id=row['id'],
            username=row['username'],
            display_name=row['display_name'],
            avatar_url=row['avatar_url'],
            post_count=row['post_count']
        )
        for row in rows
    ]


# ============== Feed ==============

@router.get("/feed/following")
async def get_following_feed(
    user: dict = Depends(require_auth),
    limit: int = Query(50, le=100),
    offset: int = Query(0)
):
    """Get posts from users you follow"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT p.*, u.username, u.display_name, u.avatar_url,
               (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
               (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND is_deleted = 0) as comment_count,
               EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) as user_liked
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.user_id IN (
            SELECT following_id FROM follows WHERE follower_id = ?
        )
        AND p.visibility = 'public'
        ORDER BY p.timestamp DESC
        LIMIT ? OFFSET ?
    """, (user['id'], user['id'], limit, offset))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]
