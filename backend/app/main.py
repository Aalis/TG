from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from pathlib import Path
from .api.api import api_router
from .database import models
from .database.database import engine
from .core.config import settings
from fastapi.responses import HTMLResponse
from fastapi.responses import RedirectResponse

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Telegram Group Parser API",
    description="API for parsing Telegram groups",
    version="1.0.0",
)

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Health check endpoint must be defined before static file mounting
@app.get("/health")
def health_check():
    """
    Health check endpoint for Railway to monitor the application.
    """
    return JSONResponse(
        content={
            "status": "healthy",
            "version": "1.0.0",
        }
    )

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Get static directory from environment variable or use default
static_dir_env = os.getenv("STATIC_FILES_DIR")
print(f"STATIC_FILES_DIR environment variable: {static_dir_env}")

if static_dir_env:
    static_dir = Path(static_dir_env)
else:
    static_dir = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) / "static"

print(f"Using static directory: {static_dir}")

# Create the static directory if it doesn't exist
try:
    static_dir.mkdir(parents=True, exist_ok=True)
except Exception as e:
    print(f"Warning: Could not create static directory: {e}")

# Debug: List static directory contents
try:
    # Get the list of files in the static directory
    static_files = list(static_dir.glob("**/*")) if static_dir.exists() else []
    print(f"Found {len(static_files)} files in static directory")
    for file in static_files[:10]:  # Print first 10 files
        print(f" - {file.relative_to(static_dir)}")
    if len(static_files) > 10:
        print(f" ... and {len(static_files) - 10} more files")
    
    # Check index.html
    index_path = static_dir / "index.html"
    if index_path.exists():
        print(f"index.html exists at: {index_path}")
    else:
        print(f"WARNING: index.html does not exist at: {index_path}")
        # Create a temporary index.html if it doesn't exist
        index_path.write_text("""<!DOCTYPE html>
<html>
    <head>
        <title>Telegram Parser</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 2rem;
                line-height: 1.6;
                color: #333;
            }
            h1 {
                color: #2563eb;
                margin-bottom: 1rem;
            }
            p {
                margin-bottom: 1rem;
            }
            .container {
                background-color: #f8fafc;
                border-radius: 8px;
                padding: 2rem;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Application is running</h1>
            <p>The backend API is operational. Please ensure the frontend is built and copied to the static directory.</p>
            <p>API endpoints are available at <code>/api/v1/*</code></p>
        </div>
    </body>
</html>
""")
        print(f"Created temporary index.html at: {index_path}")
    
    # Define static file handlers
    
    # First mount the static directory for specific asset types
    static_assets_dir = static_dir / "static"
    if static_assets_dir.exists():
        app.mount("/static", StaticFiles(directory=str(static_assets_dir)), name="static_assets")
        print(f"Mounted /static endpoint to: {static_assets_dir}")
    else:
        print(f"WARNING: Static assets directory does not exist: {static_assets_dir}")
    
    # Handle root path - important to define before the catch-all
    @app.get("/")
    async def serve_root():
        print(f"Serving index.html for root path")
        return FileResponse(str(static_dir / "index.html"))
    
    # Serve specific files from the root directory
    for file_name in ["favicon.ico", "manifest.json", "asset-manifest.json", "robots.txt", "logo192.png", "logo512.png", "env-config.js"]:
        file_path = static_dir / file_name
        if file_path.exists():
            print(f"Setting up handler for /{file_name}")
            
            @app.get(f"/{file_name}")
            async def serve_file(file_path=file_path, file_name=file_name):
                print(f"Serving {file_name}")
                return FileResponse(str(file_path))
    
    # Create a catch-all route that needs to be defined AFTER the specific routes
    # This will serve index.html for all SPA routes
    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        print(f"Received request for path: /{full_path}")
        
        # Handle API routes specially
        if full_path.startswith("api/"):
            # Check if this is an API route that's failing - provide detailed diagnostics
            api_endpoint = full_path[4:]  # Remove 'api/' prefix
            
            # Check specifically for user verification routes
            if api_endpoint.startswith("v1/users/verify/"):
                token = api_endpoint.replace("v1/users/verify/", "")
                print(f"Email verification token detected: {token}")
                print(f"This should be handled by the API router, but it's reaching the catch-all route.")
                print(f"Request headers: {request.headers}")
                print(f"API router is mounted at: {settings.API_V1_STR}")
                
                # Try to redirect to the correct API endpoint
                return RedirectResponse(url=f"{settings.API_V1_STR}/users/verify/{token}")
            
            print(f"API route requested (not matched): {full_path}")
            return {"detail": f"API endpoint not found: {full_path}", "router_path": settings.API_V1_STR}
        
        # Check if the path points to a specific file
        file_path = static_dir / full_path
        if file_path.exists() and file_path.is_file():
            print(f"Serving existing file: {file_path}")
            return FileResponse(str(file_path))
        
        # For all front-end routes (SPA routes), return the index.html
        print(f"SPA route detected, serving index.html for: /{full_path}")
        return FileResponse(str(static_dir / "index.html"))
    
except Exception as e:
    import traceback
    print(f"Error handling static files: {e}")
    print(traceback.format_exc()) 