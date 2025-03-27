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
        static_dir.mkdir(parents=True, exist_ok=True)
    
    # Check for index.html
    index_path = static_dir / "index.html"
    if not index_path.exists():
        logger.error(f"ERROR: {index_path} does not exist!")
        # Try to find index.html in subdirectories
        for root, _, files in os.walk(static_dir):
            if "index.html" in files:
                found_path = Path(root) / "index.html"
                logger.info(f"Found index.html at {found_path}, copying to {index_path}")
                shutil.copy(found_path, index_path)
                break
    else:
        logger.info(f"Found index.html at {index_path}")
    
    # Check for static directory structure
    react_static_dir = static_dir / "static"
    if not react_static_dir.exists() and (static_dir / "static").exists():
        # React's build process creates a static directory inside the build directory
        logger.info("React static directory exists and seems properly structured")
    else:
        # Look for js and css directories
        js_dirs = list(static_dir.glob("**/js"))
        css_dirs = list(static_dir.glob("**/css"))
        
        if js_dirs and css_dirs:
            # Found potential static assets, but in wrong structure
            logger.info(f"Found potential static assets at incorrect locations")
            logger.info(f"JS dirs: {js_dirs}")
            logger.info(f"CSS dirs: {css_dirs}")
            
            # Try to infer the correct structure
            for js_dir in js_dirs:
                parent_dir = js_dir.parent
                if (parent_dir / "css").exists():
                    logger.info(f"Found matching static directory at {parent_dir}")
                    
                    # Create static directory if needed
                    if not react_static_dir.exists():
                        react_static_dir.mkdir(parents=True, exist_ok=True)
                    
                    # Copy contents to the correct location
                    for subdir in ["js", "css", "media"]:
                        src_dir = parent_dir / subdir
                        dst_dir = react_static_dir / subdir
                        if src_dir.exists():
                            logger.info(f"Copying {src_dir} to {dst_dir}")
                            if dst_dir.exists():
                                shutil.rmtree(dst_dir)
                            shutil.copytree(src_dir, dst_dir)
    
    # Fix asset-manifest.json if it exists
    manifest_path = static_dir / "asset-manifest.json"
    if not manifest_path.exists():
        for manifest_candidate in static_dir.glob("**/asset-manifest.json"):
            logger.info(f"Found asset-manifest.json at {manifest_candidate}, copying to root")
            shutil.copy(manifest_candidate, manifest_path)
            break
    
    # Check final structure
    logger.info("Static files check completed")
    logger.info("Current static directory structure:")
    for root, dirs, files in os.walk(static_dir):
        rel_path = Path(root).relative_to(static_dir)
        if str(rel_path) == '.':
            logger.info(f"Root: {len(files)} files, {len(dirs)} dirs")
        else:
            logger.info(f"{rel_path}: {len(files)} files")

if __name__ == "__main__":
    check_and_fix_static_files() 