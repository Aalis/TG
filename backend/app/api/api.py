from fastapi import APIRouter

from app.api.endpoints import login, users, telegram

api_router = APIRouter()
api_router.include_router(login.router, tags=["login"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(telegram.router, prefix="/telegram", tags=["telegram"]) 