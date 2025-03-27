from fastapi import FastAPI
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
static_dir = Path(os.getenv("STATIC_FILES_DIR", "/home/appuser/static"))

# Create the static directory if it doesn't exist
try:
    static_dir.mkdir(parents=True, exist_ok=True)
except Exception as e:
    print(f"Warning: Could not create static directory: {e}")

# Ensure index.html exists in static directory
index_path = static_dir / "index.html"
if not index_path.exists():
    try:
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
    except Exception as e:
        print(f"Warning: Could not create index.html: {e}")

# Mount static files directory for all non-API routes
try:
    # Get the list of files in the static directory
    static_files = list(static_dir.glob("*")) if static_dir.exists() else []
    print(f"Found {len(static_files)} files in static directory: {static_dir}")
    
    # First handle specific static files
    for file_name in ["favicon.ico", "manifest.json", "asset-manifest.json", "robots.txt", "logo192.png", "logo512.png"]:
        @app.get(f"/{file_name}")
        async def serve_file(file_name=file_name):
            file_path = static_dir / file_name
            if file_path.exists():
                return FileResponse(str(file_path))
            else:
                print(f"Warning: {file_path} does not exist")
                # Return empty response to avoid errors
                return JSONResponse(content={})
    
    # Handle static assets if they exist
    if (static_dir / "static").exists():
        print("Static subdirectory found, mounting it")
        app.mount("/static", StaticFiles(directory=str(static_dir / "static")), name="static_assets")
    elif (static_dir).exists():
        # Check for direct js/css directories and mount them
        for asset_dir in ["js", "css", "media"]:
            if (static_dir / asset_dir).exists():
                print(f"Mounting {asset_dir} directory directly")
                app.mount(f"/{asset_dir}", StaticFiles(directory=str(static_dir / asset_dir)), name=f"{asset_dir}_assets")
    
    # Serve assets directory if it exists
    if (static_dir / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(static_dir / "assets")), name="assets")
    
    # Handle single-page application routing - serve index.html for non-API, non-static paths
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Skip API routes
        if full_path.startswith("api/"):
            return {"detail": "API endpoint not found"}
        
        # Skip static files routes
        if full_path.startswith(("static/", "assets/", "js/", "css/", "media/")):
            return {"detail": "Static file not found"}
            
        # Special check for handling root path
        if full_path == "":
            print("Serving index.html for root path")
        
        # Return index.html for all other routes to support client-side routing
        index_file = static_dir / "index.html"
        if index_file.exists():
            print(f"Serving {index_file} for path: /{full_path}")
            return FileResponse(str(index_file))
        else:
            # If index.html doesn't exist, try to find it
            print(f"Index.html not found at {index_file}, searching...")
            for file in static_dir.glob("**/index.html"):
                print(f"Found index.html at {file}")
                return FileResponse(str(file))
            
            # Last resort - return a simple HTML page
            html_content = """
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Telegram Parser</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        .error { color: red; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <h1>Telegram Parser</h1>
                    <div class="error">
                        <p>Error: Could not find index.html file.</p>
                        <p>Please ensure the frontend has been built and copied to the static directory.</p>
                    </div>
                    <div>
                        <pre>Static directory: {static_dir}</pre>
                        <pre>Files found: {[str(f.relative_to(static_dir)) for f in static_files]}</pre>
                    </div>
                </body>
            </html>
            """
            return HTMLResponse(content=html_content, status_code=404)
        
except Exception as e:
    import traceback
    print(f"Error handling static files: {e}")
    print(traceback.format_exc()) 