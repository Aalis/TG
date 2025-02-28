import os
import sys
from dotenv import load_dotenv
import uvicorn
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
from typing import Optional, List
import jwt
from passlib.context import CryptContext
from telethon import TelegramClient
from telethon.tl.types import Channel, User as TelegramUser, ChannelParticipantsAdmins
from telethon.tl.functions.channels import GetFullChannelRequest
from telethon.errors import FloodWaitError, UserDeactivatedBanError

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="Telegram Group Parser API",
    description="Simplified API for parsing Telegram groups",
    version="0.1.0",
)

# Add CORS middleware
origins = [
    "http://localhost:3000",
    "http://localhost:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
SECRET_KEY = os.getenv("SECRET_KEY", "your_secret_key_here")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/login/access-token")

# Database connection
DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return None

# Models
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class User(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool = True
    is_superuser: bool = False

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str

class UserInDB(User):
    hashed_password: str

# Additional Models for Telegram
class GroupParseRequest(BaseModel):
    group_link: str

class GroupMember(BaseModel):
    user_id: str
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_bot: bool = False
    is_admin: bool = False

class ParsedGroup(BaseModel):
    id: int
    user_id: int
    group_id: str
    group_name: str
    group_username: Optional[str] = None
    member_count: int = 0
    is_public: bool = True
    parsed_at: datetime
    members: List[GroupMember] = []

class GroupParseResponse(BaseModel):
    success: bool
    message: str
    group: Optional[ParsedGroup] = None

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_user(username: str):
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
        user_record = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if user_record:
            return UserInDB(**user_record)
    except Exception as e:
        print(f"Error getting user: {e}")
    
    return None

def get_user_by_email(email: str):
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user_record = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if user_record:
            return UserInDB(**user_record)
    except Exception as e:
        print(f"Error getting user by email: {e}")
    
    return None

def create_user_in_db(user_data: UserCreate):
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        hashed_password = get_password_hash(user_data.password)
        
        # Insert the new user
        cursor.execute(
            """
            INSERT INTO users (email, username, hashed_password, is_active, is_superuser, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, email, username, is_active, is_superuser, created_at
            """,
            (
                user_data.email,
                user_data.username,
                hashed_password,
                True,  # is_active
                False,  # is_superuser
                datetime.now(),  # created_at
            ),
        )
        
        new_user = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if new_user:
            return User(**new_user)
    except Exception as e:
        print(f"Error creating user: {e}")
    
    return None

def authenticate_user(username: str, password: str):
    user = get_user(username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = get_user(username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

# Telegram Parser Service
class TelegramParserService:
    _bot_tokens = None
    _current_token_index = 0

    @classmethod
    def get_bot_tokens(cls) -> List[str]:
        if cls._bot_tokens is None:
            tokens_str = os.getenv("TELEGRAM_BOT_TOKENS", "")
            if not tokens_str:
                raise ValueError("No bot tokens found in environment variables")
            cls._bot_tokens = [token.strip() for token in tokens_str.split(",")]
        return cls._bot_tokens

    @classmethod
    def get_next_bot_token(cls) -> str:
        tokens = cls.get_bot_tokens()
        if not tokens:
            raise ValueError("No bot tokens available")
        token = tokens[cls._current_token_index]
        cls._current_token_index = (cls._current_token_index + 1) % len(tokens)
        return token

    def __init__(self):
        self.api_id = os.getenv("API_ID")
        self.api_hash = os.getenv("API_HASH")
        self.bot_token = self.get_next_bot_token()
        self.client = None

    async def _connect(self) -> None:
        session_name = f"bot_session_{self.bot_token.split(':')[0]}"
        self.client = TelegramClient(session_name, int(self.api_id), self.api_hash)
        await self.client.start(bot_token=self.bot_token)

    async def _disconnect(self) -> None:
        if self.client:
            await self.client.disconnect()

    async def _extract_group_id(self, group_link: str) -> str:
        if "t.me/" in group_link:
            return group_link.split("t.me/")[1].split("/")[0].split("?")[0]
        if group_link.startswith("@"):
            return group_link[1:]
        return group_link

    async def parse_group(self, group_link: str, user_id: int):
        last_error = None
        bot_tokens = self.get_bot_tokens()

        for _ in range(len(bot_tokens)):
            try:
                await self._connect()
                group_username = await self._extract_group_id(group_link)
                
                try:
                    entity = await self.client.get_entity(group_username)
                except ValueError:
                    raise HTTPException(status_code=404, detail="Group not found")

                if not isinstance(entity, Channel):
                    raise HTTPException(status_code=400, detail="The link is not a Telegram group or channel")

                # Get full channel info
                full_channel = await self.client(GetFullChannelRequest(channel=entity))

                # Get members
                members = []
                admins = set()
                
                async for admin in self.client.iter_participants(entity, filter=ChannelParticipantsAdmins):
                    admins.add(admin.id)

                async for user in self.client.iter_participants(entity):
                    if isinstance(user, TelegramUser):
                        members.append(GroupMember(
                            user_id=str(user.id),
                            username=user.username,
                            first_name=user.first_name,
                            last_name=user.last_name,
                            is_bot=user.bot,
                            is_admin=user.id in admins
                        ))

                # Save to database
                conn = get_db_connection()
                if not conn:
                    raise HTTPException(status_code=500, detail="Database connection failed")

                try:
                    cursor = conn.cursor(cursor_factory=RealDictCursor)
                    
                    # Delete existing group if it exists
                    cursor.execute(
                        "DELETE FROM group_members WHERE group_id IN (SELECT id FROM parsed_groups WHERE group_id = %s AND user_id = %s)",
                        (str(entity.id), user_id)
                    )
                    cursor.execute(
                        "DELETE FROM parsed_groups WHERE group_id = %s AND user_id = %s",
                        (str(entity.id), user_id)
                    )

                    # Insert new group
                    cursor.execute(
                        """
                        INSERT INTO parsed_groups (user_id, group_id, group_name, group_username, member_count, is_public, parsed_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        RETURNING id, user_id, group_id, group_name, group_username, member_count, is_public, parsed_at
                        """,
                        (
                            user_id,
                            str(entity.id),
                            entity.title,
                            entity.username,
                            full_channel.full_chat.participants_count,
                            entity.username is not None,
                            datetime.now()
                        )
                    )
                    group_record = cursor.fetchone()
                    group_id = group_record["id"]

                    # Insert members
                    for member in members:
                        cursor.execute(
                            """
                            INSERT INTO group_members (group_id, user_id, username, first_name, last_name, is_bot, is_admin)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                group_id,
                                member.user_id,
                                member.username,
                                member.first_name,
                                member.last_name,
                                member.is_bot,
                                member.is_admin
                            )
                        )

                    conn.commit()
                    
                    # Create response
                    parsed_group = ParsedGroup(
                        **group_record,
                        members=members
                    )
                    
                    return {
                        "success": True,
                        "message": f"Successfully parsed group with {len(members)} members",
                        "group": parsed_group
                    }

                except Exception as e:
                    conn.rollback()
                    raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
                finally:
                    cursor.close()
                    conn.close()
                    await self._disconnect()

            except (FloodWaitError, UserDeactivatedBanError) as e:
                last_error = e
                self.bot_token = self.get_next_bot_token()
                continue
            except HTTPException:
                raise
            except Exception as e:
                last_error = e
                break
            finally:
                await self._disconnect()

        if isinstance(last_error, FloodWaitError):
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Please try again in {last_error.seconds} seconds"
            )
        elif isinstance(last_error, UserDeactivatedBanError):
            raise HTTPException(status_code=403, detail="Bot token is no longer valid")
        elif last_error:
            raise HTTPException(status_code=500, detail=str(last_error))
        
        raise HTTPException(status_code=500, detail="All bot tokens are exhausted or invalid")

# Routes
@app.get("/")
def read_root():
    return {"message": "Welcome to Telegram Group Parser API", "docs": "/docs"}

@app.post("/api/v1/users/", response_model=User)
async def create_user(user_data: UserCreate):
    # Check if user with this email already exists
    existing_user = get_user_by_email(user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )
    
    # Check if user with this username already exists
    existing_user = get_user(user_data.username)
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )
    
    # Create new user
    new_user = create_user_in_db(user_data)
    if not new_user:
        raise HTTPException(
            status_code=500,
            detail="Failed to create user. Please try again later.",
        )
    
    return new_user

@app.post("/api/v1/login/access-token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/v1/login/test-token", response_model=User)
async def test_token(current_user: User = Depends(get_current_active_user)):
    return current_user

@app.get("/api/v1/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user

# Add the parse-group endpoint
@app.post("/api/v1/telegram/parse-group/", response_model=GroupParseResponse)
async def parse_group(
    request: GroupParseRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Parse a Telegram group using the bot token pool
    """
    parser = TelegramParserService()
    return await parser.parse_group(request.group_link, current_user.id)

def get_groups_by_user(user_id: int):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # First get the groups
            cur.execute("""
                SELECT id, user_id, group_id, group_name, group_username, 
                       member_count, is_public, parsed_at
                FROM parsed_groups 
                WHERE user_id = %s
                ORDER BY parsed_at DESC
            """, (user_id,))
            groups = cur.fetchall()
            
            # For each group, get its members
            for group in groups:
                cur.execute("""
                    SELECT user_id, username, first_name, last_name, 
                           is_bot, is_admin
                    FROM group_members 
                    WHERE group_id = %s
                """, (group['id'],))
                members = cur.fetchall()
                group['members'] = [dict(member) for member in members]
            
            return [dict(group) for group in groups]
    finally:
        if conn:
            conn.close()

@app.get("/api/v1/telegram/groups/", response_model=List[ParsedGroup])
async def read_groups(current_user: User = Depends(get_current_active_user)):
    """
    Get all parsed groups for the current user
    """
    groups = get_groups_by_user(current_user.id)
    return [ParsedGroup(**group) for group in groups]

def get_group_by_id(group_id: int, user_id: int):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get the group
            cur.execute("""
                SELECT id, user_id, group_id, group_name, group_username, 
                       member_count, is_public, parsed_at
                FROM parsed_groups 
                WHERE id = %s AND user_id = %s
            """, (group_id, user_id))
            group = cur.fetchone()
            
            if group:
                # Get the group members
                cur.execute("""
                    SELECT user_id, username, first_name, last_name, 
                           is_bot, is_admin
                    FROM group_members 
                    WHERE group_id = %s
                """, (group_id,))
                members = cur.fetchall()
                group['members'] = [dict(member) for member in members]
                
            return dict(group) if group else None
    finally:
        if conn:
            conn.close()

@app.get("/api/v1/telegram/groups/{group_id}", response_model=ParsedGroup)
async def read_group(
    group_id: int,
    current_user: User = Depends(get_current_active_user)
):
    """
    Get a specific parsed group by ID
    """
    group = get_group_by_id(group_id, current_user.id)
    if not group:
        raise HTTPException(
            status_code=404,
            detail="Group not found"
        )
    return ParsedGroup(**group)

def delete_group_by_id(group_id: int, user_id: int):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # First check if the group exists and belongs to the user
            cur.execute("""
                SELECT id FROM parsed_groups 
                WHERE id = %s AND user_id = %s
            """, (group_id, user_id))
            group = cur.fetchone()
            
            if not group:
                return False
            
            # Delete group members first (due to foreign key constraint)
            cur.execute("""
                DELETE FROM group_members 
                WHERE group_id = %s
            """, (group_id,))
            
            # Then delete the group
            cur.execute("""
                DELETE FROM parsed_groups 
                WHERE id = %s AND user_id = %s
            """, (group_id, user_id))
            
            return True
    finally:
        if conn:
            conn.close()

@app.delete("/api/v1/telegram/groups/{group_id}")
async def delete_group(
    group_id: int,
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete a specific parsed group by ID
    """
    success = delete_group_by_id(group_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Group not found"
        )
    return {"message": "Group deleted successfully"}

# Main
if __name__ == "__main__":
    print("Telegram Group Parser API")
    print("========================")
    print("Starting simplified backend server...")
    print(f"API credentials from .env file:")
    print(f"API_ID: {os.getenv('API_ID')}")
    print(f"API_HASH: {os.getenv('API_HASH')}")
    print()
    print(f"Database URL: {DATABASE_URL.replace('postgres:', '***:').replace('@', '***@')}")
    print()
    print("The server is now running. Access the API at http://localhost:8000")
    print("API documentation is available at http://localhost:8000/docs")
    
    uvicorn.run(app, host="0.0.0.0", port=8000) 