#!/usr/bin/env python
"""
Script to check and fix static files structure after deployment
"""

import os
import shutil
import json
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("check_static")

def check_and_fix_static_files():
    """Check if static files are properly structured and fix if needed"""
    logger.info("Checking static files structure...")
    
    # Get static directory from environment variable or use default
    static_dir = Path(os.getenv("STATIC_FILES_DIR", "/app/static"))
    logger.info(f"Static directory: {static_dir}")
    
    if not static_dir.exists():
        logger.warning(f"Static directory {static_dir} does not exist, creating it")
        try:
            static_dir.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            logger.error(f"Error creating static directory: {e}")
            
            # Try alternate location
            alt_static_dir = Path("/home/appuser/static")
            logger.info(f"Trying alternate static directory: {alt_static_dir}")
            try:
                alt_static_dir.mkdir(parents=True, exist_ok=True)
                # Set environment variable to use this directory
                os.environ["STATIC_FILES_DIR"] = str(alt_static_dir)
                static_dir = alt_static_dir
                logger.info(f"Using alternate static directory: {static_dir}")
            except Exception as e2:
                logger.error(f"Error creating alternate static directory: {e2}")
    
    # Search for build directory that might contain the files
    build_dirs = [
        Path("/app/frontend/build"),
        Path("/app/build"),
        Path("/home/appuser/frontend/build")
    ]
    
    build_dir = None
    for path in build_dirs:
        if path.exists() and (path / "index.html").exists():
            build_dir = path
            logger.info(f"Found build directory with index.html: {build_dir}")
            break
    
    # If we found a build directory, copy contents to static directory
    if build_dir and build_dir != static_dir:
        logger.info(f"Copying from build directory {build_dir} to static directory {static_dir}")
        try:
            # Create static directory if it doesn't exist
            static_dir.mkdir(parents=True, exist_ok=True)
            
            # Copy all files from build directory
            for item in build_dir.glob("*"):
                if item.is_file():
                    logger.info(f"Copying file {item} to {static_dir / item.name}")
                    shutil.copy2(item, static_dir / item.name)
                elif item.is_dir():
                    logger.info(f"Copying directory {item} to {static_dir / item.name}")
                    if (static_dir / item.name).exists():
                        shutil.rmtree(static_dir / item.name)
                    shutil.copytree(item, static_dir / item.name)
        except Exception as e:
            logger.error(f"Error copying from build directory: {e}")
    
    # Check for index.html
    index_path = static_dir / "index.html"
    if not index_path.exists():
        logger.error(f"ERROR: {index_path} does not exist!")
        # Try to find index.html in subdirectories
        found = False
        for root, _, files in os.walk(static_dir):
            if "index.html" in files:
                found_path = Path(root) / "index.html"
                logger.info(f"Found index.html at {found_path}, copying to {index_path}")
                try:
                    shutil.copy(found_path, index_path)
                    found = True
                    break
                except Exception as e:
                    logger.error(f"Error copying index.html: {e}")
        
        if not found:
            logger.warning("index.html not found anywhere, will need to be created")
            try:
                # Create a simple index.html
                index_path.write_text("""<!DOCTYPE html>
<html>
    <head>
        <title>Telegram Parser</title>
        <meta http-equiv="refresh" content="5;url=/api/v1/docs">
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
            .container { max-width: 600px; margin: 0 auto; }
            .message { margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Telegram Parser API</h1>
            <div class="message">
                <p>The API server is running, but the frontend static files are missing.</p>
                <p>You will be redirected to the API documentation in 5 seconds.</p>
                <p><a href="/api/v1/docs">Click here if you are not redirected</a></p>
            </div>
        </div>
    </body>
</html>""")
                logger.info("Created basic index.html")
            except Exception as e:
                logger.error(f"Error creating basic index.html: {e}")
    else:
        logger.info(f"Found index.html at {index_path}")
    
    # Check for static directory structure
    react_static_dir = static_dir / "static"
    if react_static_dir.exists():
        logger.info("React static directory exists")
        
        # Check for JS/CSS directories
        for subdir in ["js", "css", "media"]:
            if (react_static_dir / subdir).exists():
                file_count = len(list((react_static_dir / subdir).glob("*")))
                logger.info(f"static/{subdir}/ exists with {file_count} files")
            else:
                logger.warning(f"static/{subdir}/ does not exist")
    else:
        logger.warning("static/ subdirectory does not exist")
        
        # Look for js and css directories at the root level
        js_dirs = list(static_dir.glob("**/js"))
        css_dirs = list(static_dir.glob("**/css"))
        
        if js_dirs and css_dirs:
            # Found potential static assets, but in wrong structure
            logger.info(f"Found potential static assets at incorrect locations")
            logger.info(f"JS dirs: {js_dirs}")
            logger.info(f"CSS dirs: {css_dirs}")
            
            # Try to fix the structure
            try:
                # Create static directory
                react_static_dir.mkdir(parents=True, exist_ok=True)
                
                # Try to infer the correct structure
                for js_dir in js_dirs:
                    parent_dir = js_dir.parent
                    if (parent_dir / "css").exists():
                        logger.info(f"Found matching static directory at {parent_dir}")
                        
                        # Copy contents to the correct location
                        for subdir in ["js", "css", "media"]:
                            src_dir = parent_dir / subdir
                            dst_dir = react_static_dir / subdir
                            if src_dir.exists():
                                logger.info(f"Copying {src_dir} to {dst_dir}")
                                if dst_dir.exists():
                                    shutil.rmtree(dst_dir)
                                shutil.copytree(src_dir, dst_dir)
            except Exception as e:
                logger.error(f"Error fixing static directory structure: {e}")
                
                # Alternative: move js/css directories to root if needed
                try:
                    for subdir in ["js", "css", "media"]:
                        for src_dir in static_dir.glob(f"**/{subdir}"):
                            if src_dir.parent != static_dir:
                                dst_dir = static_dir / subdir
                                logger.info(f"Moving {src_dir} to {dst_dir}")
                                if dst_dir.exists():
                                    shutil.rmtree(dst_dir)
                                shutil.copytree(src_dir, dst_dir)
                                break
                except Exception as e2:
                    logger.error(f"Error moving js/css directories: {e2}")
    
    # Fix asset-manifest.json if it exists
    manifest_path = static_dir / "asset-manifest.json"
    if not manifest_path.exists():
        # Try to find it
        manifest_candidates = list(static_dir.glob("**/asset-manifest.json"))
        if manifest_candidates:
            manifest_candidate = manifest_candidates[0]
            logger.info(f"Found asset-manifest.json at {manifest_candidate}, copying to root")
            try:
                shutil.copy(manifest_candidate, manifest_path)
            except Exception as e:
                logger.error(f"Error copying asset-manifest.json: {e}")
    
    # Check final structure
    logger.info("Static files check completed")
    logger.info("Current static directory structure:")
    for root, dirs, files in os.walk(static_dir):
        rel_path = Path(root).relative_to(static_dir)
        if str(rel_path) == '.':
            logger.info(f"Root: {len(files)} files, {len(dirs)} dirs")
            # List files in root
            for file in files:
                file_path = Path(root) / file
                logger.info(f"  - {file} ({file_path.stat().st_size} bytes)")
        else:
            logger.info(f"{rel_path}/: {len(files)} files")

if __name__ == "__main__":
    check_and_fix_static_files() 