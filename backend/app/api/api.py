from fastapi import APIRouter

from app.api.endpoints import login, users, telegram, telegram_sessions
from app.routes import admin

api_router = APIRouter()
api_router.include_router(login.router, tags=["login"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(telegram.router, prefix="/telegram", tags=["telegram"])
api_router.include_router(telegram_sessions.router, prefix="/telegram-sessions", tags=["telegram-sessions"])
api_router.include_router(admin.router) 