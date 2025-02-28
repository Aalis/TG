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
from typing import Optional
import jwt
from passlib.context import CryptContext

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