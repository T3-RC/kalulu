"""
Kalulu Authentication Module
JWT-based auth with user registration and login
"""

from datetime import datetime, timedelta
from typing import Optional
import hashlib
import secrets
import sqlite3
import json

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, EmailStr

# ============== Configuration ==============

SECRET_KEY = secrets.token_hex(32)  # In production, use environment variable
TOKEN_EXPIRY_HOURS = 72
DB_PATH = "kalulu.db"

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ============== Models ==============

class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str
    display_name: Optional[str] = None

class UserLogin(BaseModel):
    username: str  # Can be username or email
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    display_name: Optional[str]
    avatar_url: Optional[str]
    created_at: datetime
    post_count: int = 0

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: UserResponse

class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None


# ============== Database ==============

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_auth_tables():
    """Initialize auth-related tables"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Update users table with auth fields
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            display_name TEXT,
            avatar_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME,
            is_active BOOLEAN DEFAULT 1,
            is_verified BOOLEAN DEFAULT 0
        )
    """)
    
    # Sessions/tokens table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            is_valid BOOLEAN DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    
    # Create indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)")
    
    conn.commit()
    conn.close()

# Initialize tables on import
init_auth_tables()


# ============== Utilities ==============

def hash_password(password: str) -> str:
    """Hash password with salt"""
    salt = secrets.token_hex(16)
    hash_obj = hashlib.pbkdf2_hmac(
        'sha256', 
        password.encode(), 
        salt.encode(), 
        100000
    )
    return f"{salt}${hash_obj.hex()}"

def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against hash"""
    try:
        salt, stored_hash = password_hash.split('$')
        hash_obj = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode(),
            salt.encode(),
            100000
        )
        return hash_obj.hex() == stored_hash
    except:
        return False

def generate_token() -> str:
    """Generate secure random token"""
    return secrets.token_urlsafe(32)

def generate_user_id() -> str:
    """Generate unique user ID"""
    return f"user_{secrets.token_hex(8)}"


# ============== Auth Dependency ==============

async def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """
    Dependency to get current user from token.
    Returns None if no valid token (allows anonymous access).
    """
    if not authorization:
        return None
    
    # Extract token from "Bearer <token>"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    
    token = parts[1]
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Check token validity
    cursor.execute("""
        SELECT s.user_id, s.expires_at, u.*
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.is_valid = 1
    """, (token,))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    # Check expiry
    expires_at = datetime.fromisoformat(row['expires_at'])
    if datetime.now() > expires_at:
        return None
    
    return {
        'id': row['id'],
        'username': row['username'],
        'email': row['email'],
        'display_name': row['display_name'],
        'avatar_url': row['avatar_url'],
    }

async def require_auth(authorization: Optional[str] = Header(None)) -> dict:
    """
    Dependency that requires authentication.
    Raises 401 if not authenticated.
    """
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


# ============== Routes ==============

@router.post("/register", response_model=TokenResponse)
async def register(data: UserRegister):
    """Register a new user"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if username exists
    cursor.execute("SELECT id FROM users WHERE username = ?", (data.username.lower(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Check if email exists
    cursor.execute("SELECT id FROM users WHERE email = ?", (data.email.lower(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate password
    if len(data.password) < 8:
        conn.close()
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    # Create user
    user_id = generate_user_id()
    password_hash = hash_password(data.password)
    now = datetime.now()
    
    cursor.execute("""
        INSERT INTO users (id, username, email, password_hash, display_name, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        user_id,
        data.username.lower(),
        data.email.lower(),
        password_hash,
        data.display_name or data.username,
        now.isoformat()
    ))
    
    # Create session token
    token = generate_token()
    expires_at = now + timedelta(hours=TOKEN_EXPIRY_HOURS)
    
    cursor.execute("""
        INSERT INTO sessions (token, user_id, expires_at)
        VALUES (?, ?, ?)
    """, (token, user_id, expires_at.isoformat()))
    
    conn.commit()
    conn.close()
    
    return TokenResponse(
        access_token=token,
        expires_at=expires_at,
        user=UserResponse(
            id=user_id,
            username=data.username.lower(),
            email=data.email.lower(),
            display_name=data.display_name or data.username,
            avatar_url=None,
            created_at=now,
            post_count=0
        )
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin):
    """Login with username/email and password"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Find user by username or email
    cursor.execute("""
        SELECT * FROM users 
        WHERE username = ? OR email = ?
    """, (data.username.lower(), data.username.lower()))
    
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    if not verify_password(data.password, row['password_hash']):
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if active
    if not row['is_active']:
        conn.close()
        raise HTTPException(status_code=403, detail="Account is disabled")
    
    # Create new session
    token = generate_token()
    now = datetime.now()
    expires_at = now + timedelta(hours=TOKEN_EXPIRY_HOURS)
    
    cursor.execute("""
        INSERT INTO sessions (token, user_id, expires_at)
        VALUES (?, ?, ?)
    """, (token, row['id'], expires_at.isoformat()))
    
    # Update last login
    cursor.execute("""
        UPDATE users SET last_login = ? WHERE id = ?
    """, (now.isoformat(), row['id']))
    
    # Get post count
    cursor.execute("SELECT COUNT(*) as count FROM posts WHERE user_id = ?", (row['id'],))
    post_count = cursor.fetchone()['count']
    
    conn.commit()
    conn.close()
    
    return TokenResponse(
        access_token=token,
        expires_at=expires_at,
        user=UserResponse(
            id=row['id'],
            username=row['username'],
            email=row['email'],
            display_name=row['display_name'],
            avatar_url=row['avatar_url'],
            created_at=datetime.fromisoformat(row['created_at']),
            post_count=post_count
        )
    )


@router.post("/logout")
async def logout(user: dict = Depends(require_auth), authorization: str = Header()):
    """Logout and invalidate current token"""
    token = authorization.split()[1]
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE sessions SET is_valid = 0 WHERE token = ?", (token,))
    conn.commit()
    conn.close()
    
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(user: dict = Depends(require_auth)):
    """Get current user profile"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as count FROM posts WHERE user_id = ?", (user['id'],))
    post_count = cursor.fetchone()['count']
    
    cursor.execute("SELECT created_at FROM users WHERE id = ?", (user['id'],))
    row = cursor.fetchone()
    conn.close()
    
    return UserResponse(
        id=user['id'],
        username=user['username'],
        email=user['email'],
        display_name=user['display_name'],
        avatar_url=user['avatar_url'],
        created_at=datetime.fromisoformat(row['created_at']),
        post_count=post_count
    )


@router.patch("/me", response_model=UserResponse)
async def update_me(data: UserUpdate, user: dict = Depends(require_auth)):
    """Update current user profile"""
    conn = get_db()
    cursor = conn.cursor()
    
    updates = []
    params = []
    
    if data.display_name is not None:
        updates.append("display_name = ?")
        params.append(data.display_name)
    
    if data.avatar_url is not None:
        updates.append("avatar_url = ?")
        params.append(data.avatar_url)
    
    if updates:
        params.append(user['id'])
        cursor.execute(f"""
            UPDATE users SET {', '.join(updates)} WHERE id = ?
        """, params)
        conn.commit()
    
    # Fetch updated user
    cursor.execute("SELECT * FROM users WHERE id = ?", (user['id'],))
    row = cursor.fetchone()
    
    cursor.execute("SELECT COUNT(*) as count FROM posts WHERE user_id = ?", (user['id'],))
    post_count = cursor.fetchone()['count']
    
    conn.close()
    
    return UserResponse(
        id=row['id'],
        username=row['username'],
        email=row['email'],
        display_name=row['display_name'],
        avatar_url=row['avatar_url'],
        created_at=datetime.fromisoformat(row['created_at']),
        post_count=post_count
    )


@router.get("/users/{username}", response_model=UserResponse)
async def get_user(username: str):
    """Get public user profile by username"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, username, display_name, avatar_url, created_at
        FROM users WHERE username = ? AND is_active = 1
    """, (username.lower(),))
    
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    
    cursor.execute("SELECT COUNT(*) as count FROM posts WHERE user_id = ?", (row['id'],))
    post_count = cursor.fetchone()['count']
    
    conn.close()
    
    return UserResponse(
        id=row['id'],
        username=row['username'],
        email="",  # Hidden for privacy
        display_name=row['display_name'],
        avatar_url=row['avatar_url'],
        created_at=datetime.fromisoformat(row['created_at']),
        post_count=post_count
    )
