#!/usr/bin/env python3
"""Monkeypatch for SQLAlchemy create_engine to handle PostgreSQL hostname replacement."""
import os
import sys
import re
import logging
from functools import wraps

# Configure logging
logging.basicConfig(level=logging.DEBUG, 
                   format='%(asctime)s [%(name)s] %(levelname)s: %(message)s')
logger = logging.getLogger("monkeypatch")

# Flag to track if SQLAlchemy has been patched
_sqlalchemy_patched = False
# Dictionary to store original functions
_original_functions = {}

def _mask_password(url):
    """Mask password in database URL for logging."""
    if not url:
        return "None"
    # Use regex to identify and replace the password portion
    return re.sub(r'(postgresql://[^:]+:)([^@]+)(@.*)', r'\1****\3', str(url))

def _derive_public_hostname():
    """Derive public hostname from environment variables."""
    public_hostname = None
    
    # Try to derive from RAILWAY_PUBLIC_DOMAIN
    if 'RAILWAY_PUBLIC_DOMAIN' in os.environ and os.environ['RAILWAY_PUBLIC_DOMAIN']:
        domain_parts = os.environ['RAILWAY_PUBLIC_DOMAIN'].split('.')
        if domain_parts:
            # Extract the project name part and construct the hostname
            logger.info(f"Deriving hostname from RAILWAY_PUBLIC_DOMAIN: {os.environ['RAILWAY_PUBLIC_DOMAIN']}")
            public_hostname = f"{domain_parts[0]}.railway.app"
            logger.info(f"Derived public hostname: {public_hostname}")
            return public_hostname
    
    # Try with RAILWAY_STATIC_URL
    if 'RAILWAY_STATIC_URL' in os.environ and os.environ['RAILWAY_STATIC_URL']:
        static_url = os.environ['RAILWAY_STATIC_URL']
        match = re.search(r'https?://([^.]+)\.railway\.app', static_url)
        if match:
            logger.info(f"Deriving hostname from RAILWAY_STATIC_URL: {static_url}")
            public_hostname = f"{match.group(1)}.railway.app"
            logger.info(f"Derived public hostname: {public_hostname}")
            return public_hostname
    
    logger.warning("Could not derive public hostname from environment variables")
    return None

def _fix_postgresql_hostname(url):
    """Replace any railway.internal hostnames with public hostname."""
    if not url:
        logger.warning("Empty URL provided to _fix_postgresql_hostname")
        return url
    
    # Skip if URL doesn't contain railway.internal
    if 'railway.internal' not in str(url):
        logger.debug(f"URL doesn't contain railway.internal, no fix needed: {_mask_password(url)}")
        return url
    
    public_hostname = _derive_public_hostname()
    if not public_hostname:
        logger.warning("Could not determine public hostname, leaving URL unchanged")
        return url
    
    # Replace the hostname part of the URL
    original_url = str(url)
    fixed_url = re.sub(r'@([^:@]+\.railway\.internal)(:|/|$)', f'@{public_hostname}\\2', original_url)
    
    if original_url != fixed_url:
        logger.info(f"Fixed PostgreSQL URL: {_mask_password(original_url)} -> {_mask_password(fixed_url)}")
    else:
        logger.debug(f"URL unchanged after hostname fix attempt: {_mask_password(url)}")
    
    return fixed_url

def patch_sqlalchemy():
    """Patch SQLAlchemy's create_engine to fix PostgreSQL hostnames."""
    global _sqlalchemy_patched
    
    # Don't patch more than once
    if _sqlalchemy_patched:
        logger.debug("SQLAlchemy already patched, skipping")
        return
    
    try:
        import sqlalchemy
        
        # Store original create_engine
        original_create_engine = sqlalchemy.create_engine
        _original_functions['sqlalchemy.create_engine'] = original_create_engine
        
        logger.info("Patching SQLAlchemy create_engine to fix PostgreSQL hostnames")
        
        @wraps(original_create_engine)
        def patched_create_engine(url, **kwargs):
            """Patched version of create_engine that fixes PostgreSQL hostnames."""
            # Fix the URL if it's a PostgreSQL URL with railway.internal hostname
            if url and isinstance(url, (str, sqlalchemy.engine.url.URL)) and 'postgresql' in str(url).lower():
                try:
                    # Log the original URL (with password masked)
                    logger.info(f"Original database URL: {_mask_password(url)}")
                    
                    # Fix the URL for railway.internal hosts
                    fixed_url = _fix_postgresql_hostname(url)
                    
                    if fixed_url != url:
                        # Use the fixed URL instead
                        logger.info(f"Using fixed database URL: {_mask_password(fixed_url)}")
                        return original_create_engine(fixed_url, **kwargs)
                except Exception as e:
                    logger.error(f"Error fixing PostgreSQL URL: {e}")
            
            # If no fix needed or error occurred, use the original URL
            return original_create_engine(url, **kwargs)
        
        # Replace the original function with our patched version
        sqlalchemy.create_engine = patched_create_engine
        _sqlalchemy_patched = True
        logger.info("SQLAlchemy create_engine patched successfully")
        
    except ImportError:
        logger.info("SQLAlchemy not imported yet, will patch when imported")
    except Exception as e:
        logger.error(f"Error patching SQLAlchemy: {e}")

def patch_psycopg2():
    """Patch psycopg2's connect function to fix PostgreSQL hostnames."""
    try:
        import psycopg2
        
        # Store original connect function
        original_connect = psycopg2.connect
        _original_functions['psycopg2.connect'] = original_connect
        
        logger.info("Patching psycopg2.connect to fix PostgreSQL hostnames")
        
        @wraps(original_connect)
        def patched_connect(*args, **kwargs):
            """Patched version of connect that fixes PostgreSQL hostnames."""
            # Fix DSN string if provided
            if args and isinstance(args[0], str) and 'postgresql' in args[0].lower():
                try:
                    # Log the original DSN (with password masked)
                    logger.info(f"Original psycopg2 DSN: {_mask_password(args[0])}")
                    
                    # Fix the DSN for railway.internal hosts
                    fixed_dsn = _fix_postgresql_hostname(args[0])
                    
                    if fixed_dsn != args[0]:
                        # Use the fixed DSN instead
                        logger.info(f"Using fixed psycopg2 DSN: {_mask_password(fixed_dsn)}")
                        new_args = (fixed_dsn,) + args[1:]
                        return original_connect(*new_args, **kwargs)
                except Exception as e:
                    logger.error(f"Error fixing psycopg2 DSN: {e}")
            
            # Fix host parameter if provided
            if 'host' in kwargs and kwargs['host'] and 'railway.internal' in kwargs['host']:
                try:
                    logger.info(f"Original psycopg2 host: {kwargs['host']}")
                    
                    # Derive public hostname
                    public_hostname = _derive_public_hostname()
                    
                    if public_hostname:
                        # Use the public hostname instead
                        logger.info(f"Using fixed psycopg2 host: {public_hostname}")
                        kwargs['host'] = public_hostname
                except Exception as e:
                    logger.error(f"Error fixing psycopg2 host parameter: {e}")
            
            # If no fix needed or error occurred, use the original parameters
            return original_connect(*args, **kwargs)
        
        # Replace the original function with our patched version
        psycopg2.connect = patched_connect
        logger.info("psycopg2.connect patched successfully")
        
    except ImportError:
        logger.info("psycopg2 not imported yet, skipping psycopg2 patch")
    except Exception as e:
        logger.error(f"Error patching psycopg2: {e}")

def fix_environment_variables():
    """Fix PostgreSQL-related environment variables."""
    try:
        # Fix DATABASE_URL
        if 'DATABASE_URL' in os.environ and os.environ['DATABASE_URL']:
            original_url = os.environ['DATABASE_URL']
            fixed_url = _fix_postgresql_hostname(original_url)
            
            if fixed_url != original_url:
                logger.info(f"Fixed DATABASE_URL environment variable")
                os.environ['DATABASE_URL'] = fixed_url
        
        # Fix SQLALCHEMY_DATABASE_URI if present
        if 'SQLALCHEMY_DATABASE_URI' in os.environ and os.environ['SQLALCHEMY_DATABASE_URI']:
            original_uri = os.environ['SQLALCHEMY_DATABASE_URI']
            fixed_uri = _fix_postgresql_hostname(original_uri)
            
            if fixed_uri != original_uri:
                logger.info(f"Fixed SQLALCHEMY_DATABASE_URI environment variable")
                os.environ['SQLALCHEMY_DATABASE_URI'] = fixed_uri
        
        # Fix PGHOST if it's a railway.internal hostname
        if 'PGHOST' in os.environ and 'railway.internal' in os.environ['PGHOST']:
            public_hostname = _derive_public_hostname()
            
            if public_hostname:
                logger.info(f"Fixed PGHOST environment variable: {os.environ['PGHOST']} -> {public_hostname}")
                os.environ['PGHOST'] = public_hostname
                
                # If we have all PG* variables, reconstruct DATABASE_URL
                if all(var in os.environ for var in ['PGUSER', 'PGPASSWORD', 'PGDATABASE']):
                    pgport = os.environ.get('PGPORT', '5432')
                    new_url = f"postgresql://{os.environ['PGUSER']}:{os.environ['PGPASSWORD']}@{public_hostname}:{pgport}/{os.environ['PGDATABASE']}"
                    logger.info("Reconstructed DATABASE_URL from PG* variables")
                    os.environ['DATABASE_URL'] = new_url
    except Exception as e:
        logger.error(f"Error fixing environment variables: {e}")

def log_database_env_vars():
    """Log database-related environment variables with sensitive info masked."""
    logger.info("=== DATABASE ENVIRONMENT VARIABLES ===")
    for key, value in os.environ.items():
        if any(substr in key.lower() for substr in ['db', 'database', 'sql', 'postgres', 'pg']):
            # Mask passwords and secrets
            if any(substr in key.lower() for substr in ['pass', 'secret', 'key']):
                logger.info(f"{key}=****")
            else:
                logger.info(f"{key}={value}")

def fix_hardcoded_urls():
    """Fix hardcoded database URLs in already loaded modules."""
    logger.info("Looking for modules with hardcoded database URLs")
    for module_name, module in list(sys.modules.items()):
        if not module or not hasattr(module, '__dict__'):
            continue
        
        # Skip built-in modules
        if not hasattr(module, '__file__') or not module.__file__:
            continue
        
        # Look through module attributes for string values that might be DB URLs
        for attr_name in dir(module):
            try:
                attr = getattr(module, attr_name)
                # Skip non-string attributes
                if not isinstance(attr, str):
                    continue
                
                # Check if it's a PostgreSQL URL with railway.internal
                if 'postgresql' in attr.lower() and 'railway.internal' in attr:
                    logger.info(f"Found potential database URL in {module_name}.{attr_name}")
                    
                    # Try to fix the URL
                    fixed_attr = _fix_postgresql_hostname(attr)
                    
                    if fixed_attr != attr:
                        logger.info(f"Fixed hardcoded database URL in {module_name}.{attr_name}")
                        setattr(module, attr_name, fixed_attr)
            except Exception:
                # Ignore errors, we don't want to break things
                pass

# Activate patches
logger.info("Activating database connection patches")
fix_environment_variables()
log_database_env_vars()
patch_sqlalchemy()
patch_psycopg2()
fix_hardcoded_urls()
logger.info("Database connection patches activated") 