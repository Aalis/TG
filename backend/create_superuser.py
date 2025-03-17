import sys
from sqlalchemy.orm import Session

from app.crud import user
from app.schemas.user import UserCreate
from app.database.database import SessionLocal
from app.core.security import get_password_hash


def create_superuser(email: str, username: str, password: str) -> None:
    db = SessionLocal()
    try:
        # Check if user already exists
        if user.get_by_email(db, email=email):
            print(f"User with email {email} already exists")
            return
        if user.get_by_username(db, username=username):
            print(f"User with username {username} already exists")
            return
        
        # Create superuser
        user_in = UserCreate(
            email=email,
            username=username,
            password=password,
            is_superuser=True,
            is_active=True,
            can_parse=True
        )
        user_obj = user.create(db, obj_in=user_in)
        print(f"Superuser {username} created successfully!")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python create_superuser.py <email> <username> <password>")
        sys.exit(1)
    
    email = sys.argv[1]
    username = sys.argv[2]
    password = sys.argv[3]
    
    create_superuser(email, username, password) 