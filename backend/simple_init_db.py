import os
import sys
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get database URL from environment
database_url = os.getenv("DATABASE_URL")

if not database_url:
    print("Error: DATABASE_URL environment variable not set.")
    sys.exit(1)

print(f"Using database URL: {database_url}")

# Parse database URL
# Format: postgresql://user:password@host:port/dbname
try:
    parts = database_url.split("//")[1].split("@")
    user_pass = parts[0].split(":")
    host_port_db = parts[1].split("/")
    host_port = host_port_db[0].split(":")

    user = user_pass[0]
    password = user_pass[1]
    host = host_port[0]
    port = host_port[1] if len(host_port) > 1 else "5432"
    dbname = host_port_db[1]
    
    print(f"Parsed database connection: user={user}, host={host}, port={port}, dbname={dbname}")
except Exception as e:
    print(f"Error parsing DATABASE_URL: {e}")
    print("Please ensure it's in the format: postgresql://user:password@host:port/dbname")
    sys.exit(1)

# Connect to PostgreSQL
try:
    # First connect to default 'postgres' database to check if our database exists
    print(f"Connecting to PostgreSQL server at {host}:{port}...")
    conn = psycopg2.connect(
        dbname="postgres",
        user=user,
        password=password,
        host=host,
        port=port
    )
    conn.autocommit = True
    cursor = conn.cursor()
    
    # Check if database exists
    cursor.execute(f"SELECT 1 FROM pg_database WHERE datname = '{dbname}'")
    if cursor.fetchone() is None:
        print(f"Creating database '{dbname}'...")
        cursor.execute(f"CREATE DATABASE {dbname}")
    else:
        print(f"Database '{dbname}' already exists.")
    
    cursor.close()
    conn.close()
    
    # Connect to the application database
    print(f"Connecting to database '{dbname}'...")
    conn = psycopg2.connect(
        dbname=dbname,
        user=user,
        password=password,
        host=host,
        port=port
    )
    conn.autocommit = True
    cursor = conn.cursor()
    
    # Create tables
    print("Creating tables...")
    
    # Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(255) UNIQUE NOT NULL,
        hashed_password VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        is_superuser BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE
    )
    """)
    
    # Telegram tokens table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS telegram_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        api_id VARCHAR(255) NOT NULL,
        api_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(255),
        bot_token VARCHAR(255),
        session_string TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE
    )
    """)
    
    # Parsed groups table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS parsed_groups (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        group_id VARCHAR(255) NOT NULL,
        group_name VARCHAR(255) NOT NULL,
        group_username VARCHAR(255),
        member_count INTEGER DEFAULT 0,
        is_public BOOLEAN DEFAULT TRUE,
        parsed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
    """)
    
    # Group members table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS group_members (
        id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES parsed_groups(id),
        user_id VARCHAR(255) NOT NULL,
        username VARCHAR(255),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        phone VARCHAR(255),
        is_bot BOOLEAN DEFAULT FALSE,
        is_admin BOOLEAN DEFAULT FALSE
    )
    """)
    
    # Check if admin user exists
    cursor.execute("SELECT 1 FROM users WHERE username = 'admin'")
    if cursor.fetchone() is None:
        # Create admin user
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        hashed_password = pwd_context.hash("admin123")
        
        print("Creating admin user...")
        cursor.execute("""
        INSERT INTO users (email, username, hashed_password, is_superuser)
        VALUES ('admin@example.com', 'admin', %s, TRUE)
        """, (hashed_password,))
        print("Admin user created successfully!")
    else:
        print("Admin user already exists.")
    
    cursor.close()
    conn.close()
    
    print("Database initialization completed!")
    
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1) 