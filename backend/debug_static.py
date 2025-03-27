#!/usr/bin/env python
"""
Script to debug static file issues in deployment
"""

import os
import sys
import json
from pathlib import Path

def debug_static_files():
    """Check and debug static files structure"""
    print("DEBUG: Static Files Structure Check")
    print("=" * 50)
    
    # Check environment variables
    print("Environment Variables:")
    print(f"- STATIC_FILES_DIR: {os.environ.get('STATIC_FILES_DIR', 'Not set')}")
    print(f"- PORT: {os.environ.get('PORT', 'Not set')}")
    print(f"- PYTHONPATH: {os.environ.get('PYTHONPATH', 'Not set')}")
    
    # Try different static paths
    static_paths = [
        Path(os.environ.get("STATIC_FILES_DIR", "/app/static")),
        Path("/app/static"),
        Path("/home/appuser/static"),
        Path("static")
    ]
    
    for static_dir in static_paths:
        print(f"\nChecking static directory: {static_dir}")
        
        if not static_dir.exists():
            print(f"  Directory does not exist")
            continue
            
        # Check key files
        key_files = ["index.html", "asset-manifest.json", "favicon.ico", "manifest.json"]
        for file in key_files:
            file_path = static_dir / file
            if file_path.exists():
                print(f"  ✓ {file} exists")
                if file == "asset-manifest.json":
                    try:
                        with open(file_path, 'r') as f:
                            manifest = json.load(f)
                            print(f"    - Files: {len(manifest.get('files', {}))} entries")
                            for key, value in list(manifest.get('files', {}).items())[:3]:
                                print(f"    - {key}: {value}")
                            if len(manifest.get('files', {})) > 3:
                                print(f"    - ... and {len(manifest.get('files', {})) - 3} more")
                    except Exception as e:
                        print(f"    - Error reading manifest: {e}")
            else:
                print(f"  ✗ {file} does not exist")
        
        # Check static directory structure
        static_subdir = static_dir / "static"
        if static_subdir.exists():
            print(f"  ✓ static/ subdirectory exists")
            
            # Check for JS/CSS directories
            for subdir in ["js", "css", "media"]:
                if (static_subdir / subdir).exists():
                    file_count = len(list((static_subdir / subdir).glob("*")))
                    print(f"    ✓ static/{subdir}/ exists with {file_count} files")
                else:
                    print(f"    ✗ static/{subdir}/ does not exist")
        else:
            print(f"  ✗ static/ subdirectory does not exist")
            
            # Look for js/css dirs directly
            for subdir in ["js", "css", "media"]:
                if (static_dir / subdir).exists():
                    file_count = len(list((static_dir / subdir).glob("*")))
                    print(f"    ! {subdir}/ exists with {file_count} files (but in wrong location)")
        
        # List top-level files
        print("\n  Top-level files:")
        for item in static_dir.iterdir():
            if item.is_file():
                print(f"    - {item.name} ({item.stat().st_size} bytes)")
            elif item.is_dir():
                file_count = len(list(item.glob("**/*")))
                print(f"    - {item.name}/ (directory with {file_count} files/dirs)")
    
    # Check if we can write to directories
    print("\nWrite permission check:")
    for static_dir in static_paths:
        if static_dir.exists():
            test_file = static_dir / "write_test.txt"
            try:
                with open(test_file, 'w') as f:
                    f.write("Test")
                print(f"  ✓ Can write to {static_dir}")
                os.remove(test_file)
            except Exception as e:
                print(f"  ✗ Cannot write to {static_dir}: {e}")
    
    print("\nDebugging completed")

if __name__ == "__main__":
    debug_static_files() 