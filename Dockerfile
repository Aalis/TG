FROM python:3.10-slim

WORKDIR /app

# Install PostgreSQL client and other dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    libpq-dev \
    gcc \
    curl \
    netcat-openbsd \
    dnsutils \
    iputils-ping \
    && rm -rf /var/lib/apt/lists/*

# Copy the entire project
COPY . .

# Install dependencies
WORKDIR /app/backend
RUN pip install --no-cache-dir -r requirements.txt

# Install additional missing dependencies
RUN pip install --no-cache-dir pytz

# Set environment variables
ENV PYTHONUNBUFFERED=1
# Explicitly set email-related environment variables
ENV MAIL_TLS=true
ENV MAIL_SSL=false

# Create a database connection patch to handle connection issues
RUN echo "import os\\
import sys\\
import monkeypatch\\
import re\\
from fastapi import FastAPI\\
\\
# Create a simple application fallback\\
fallback_app = FastAPI()\\
\\
# Try to fix any hardcoded database URLs in already loaded modules\\
def fix_hardcoded_urls():\\
    \"\"\"Attempt to patch already loaded modules that might have hardcoded database URLs.\"\"\"\\
    print(\"\\nLooking for modules with hardcoded database URLs...\")\\
    pg_host = None\\
    if \"PGHOST\" in os.environ:\\
        pg_host = os.environ[\"PGHOST\"]\\
    elif \"DATABASE_URL\" in os.environ:\\
        match = re.search(r\"@([^:]+)\", os.environ[\"DATABASE_URL\"])\\
        if match:\\
            pg_host = match.group(1)\\
    \\
    if not pg_host:\\
        print(\"Cannot determine proper PostgreSQL host, skipping URL fixes\")\\
        return\\
    \\
    print(f\"Using PostgreSQL host: {pg_host}\")\\
    \\
    # Look through all loaded modules for SQLAlchemy engine or URL attributes\\
    for module_name, module in list(sys.modules.items()):\\
        if not module_name.startswith(\"_\") and module is not None:\\
            try:\\
                # Check for database_url attribute\\
                for attr_name in dir(module):\\
                    if attr_name.lower().endswith(\"_url\") or \"database\" in attr_name.lower() or \"postgres\" in attr_name.lower():\\
                        try:\\
                            attr = getattr(module, attr_name)\\
                            if isinstance(attr, str) and \"postgres.railway.internal\" in attr:\\
                                print(f\"Found hardcoded URL in {module_name}.{attr_name}\")\\
                                new_value = attr.replace(\"postgres.railway.internal\", pg_host)\\
                                setattr(module, attr_name, new_value)\\
                                print(f\"Updated {module_name}.{attr_name} to use {pg_host}\")\\
                        except Exception:\\
                            pass\\
            except Exception:\\
                pass\\
    \\
    # Check if SQLAlchemy has an engine already created\\
    if \"sqlalchemy\" in sys.modules:\\
        try:\\
            sqlalchemy = sys.modules[\"sqlalchemy\"]\\
            engine_module = sys.modules.get(\"sqlalchemy.engine\", None)\\
            if engine_module:\\
                # Try to patch any existing engines\\
                print(\"Looking for existing SQLAlchemy engines to patch...\")\\
        except Exception as e:\\
            print(f\"Error checking SQLAlchemy engine: {e}\")\\
\\
# Attempt to fix hardcoded URLs before trying to import the app\\
fix_hardcoded_urls()\\
\\
@fallback_app.get(\"/health\")\\
def health_check():\\
    # Log database connection info to help debug\\
    db_url = os.environ.get(\"DATABASE_URL\", \"Not set\")\\
    postgres_user = os.environ.get(\"POSTGRES_USER\", \"Not set\")\\
    postgres_db = os.environ.get(\"POSTGRES_DB\", \"Not set\")\\
    postgres_password = \"****\" if \"POSTGRES_PASSWORD\" in os.environ else \"Not set\"\\
    # Hide password from logs\\
    safe_db_url = db_url\\
    if db_url != \"Not set\" and \"POSTGRES_PASSWORD\" in os.environ:\\
        safe_db_url = db_url.replace(os.environ.get(\"POSTGRES_PASSWORD\", \"\"), \"****\")\\
    \\
    print(f\"DATABASE_URL: {safe_db_url}\")\\
    print(f\"POSTGRES_USER: {postgres_user}, POSTGRES_DB: {postgres_db}\")\\
    \\
    # Get all environment variables for debugging\\
    all_env_vars = {k: v for k, v in os.environ.items() if \"PASSWORD\" not in k and \"SECRET\" not in k}\\
    return {\\
        \"status\": \"ok\", \\
        \"mode\": \"fallback\",\\
        \"message\": \"Running in fallback mode due to database connection issues\",\\
        \"db_diagnostics\": {\\
            \"database_url\": safe_db_url,\\
            \"postgres_user\": postgres_user,\\
            \"postgres_db\": postgres_db,\\
            \"environment\": all_env_vars\\
        }\\
    }\\
\\
@fallback_app.get(\"/\")\\
def root():\\
    return {\"message\": \"Hello from the fallback app! Database connection had issues.\"}\\
\\
try:\\
    # Try to import the original app\\
    from app.main import app as original_app\\
    # If successful, use the original app\\
    app = original_app\\
    print(\"Successfully imported the original application\")\\
except Exception as e:\\
    # If there are any exceptions, use the fallback app\\
    print(f\"Error importing original app: {e}\")\\
    app = fallback_app\\
    print(\"Using fallback application due to import error\")\\
" > /app/backend/app_wrapper.py

# Create a monkeypatch module to intercept database operations
RUN echo "import sys\\
import builtins\\
import importlib.abc\\
import types\\
import os\\
import re\\
from importlib.machinery import ModuleSpec\\
\\
# Store original import\\
original_import = builtins.__import__\\
\\
# Check if we need to override the PostgreSQL host\\
def override_postgres_connection():\\
    \"\"\"Set up environment to override PostgreSQL connections to use Railway-provided values.\"\"\"\\
    print(\"\\n\\nSetting up PostgreSQL connection override...\")\\
    \\
    # Print debug info\\
    print(\"Available environment variables for PostgreSQL connection:\")\\
    postgres_vars = {}\\
    for var in os.environ:\\
        if var.startswith(\"PG\") or \"POSTGRES\" in var or \"DATABASE\" in var:\\
            if \"PASSWORD\" not in var and \"SECRET\" not in var:\\
                postgres_vars[var] = os.environ[var]\\
    print(f\"PostgreSQL variables: {postgres_vars}\")\\
    \\
    # Determine the correct PostgreSQL host\\
    pg_host = None\\
    if \"PGHOST\" in os.environ:\\
        print(f\"Using PGHOST: {os.environ['PGHOST']}\")\\
        pg_host = os.environ[\"PGHOST\"]\\
    elif \"DATABASE_URL\" in os.environ:\\
        # Extract host from DATABASE_URL\\
        import re\\
        match = re.search(r\"@([^:]+)\", os.environ[\"DATABASE_URL\"])\\
        if match:\\
            pg_host = match.group(1)\\
            print(f\"Extracted host from DATABASE_URL: {pg_host}\")\\
    \\
    if pg_host:\\
        # Create a custom create_engine function to override connections\\
        def patch_sqlalchemy():\\
            # Try to import sqlalchemy safely\\
            try:\\
                import sqlalchemy\\
                import sqlalchemy.engine\\
                \\
                # Store the original create_engine\\
                original_create_engine = sqlalchemy.create_engine\\
                \\
                def patched_create_engine(url, *args, **kwargs):\\
                    \"\"\"Replace any postgres.railway.internal with the correct host.\"\"\"\\
                    url_str = str(url)\\
                    if \"postgres.railway.internal\" in url_str:\\
                        print(\"\\n\\nIntercepting connection to postgres.railway.internal!\")\\
                        print(f\"Original URL: {url_str}\")\\
                        # Replace the host\\
                        new_url = url_str.replace(\"postgres.railway.internal\", pg_host)\\
                        print(f\"New URL: {new_url}\")\\
                        return original_create_engine(new_url, *args, **kwargs)\\
                    return original_create_engine(url, *args, **kwargs)\\
                \\
                # Replace the create_engine method\\
                sqlalchemy.create_engine = patched_create_engine\\
                print(\"Successfully patched SQLAlchemy create_engine!\")\\
            except Exception as e:\\
                print(f\"Error patching SQLAlchemy: {e}\")\\
        \\
        # Patch sqlalchemy immediately if already imported\\
        if \"sqlalchemy\" in sys.modules:\\
            print(\"SQLAlchemy already imported, patching now...\")\\
            patch_sqlalchemy()\\
        \\
        # Also modify the DATABASE_URL if it uses postgres.railway.internal\\
        if \"DATABASE_URL\" in os.environ and \"postgres.railway.internal\" in os.environ[\"DATABASE_URL\"]:\\
            print(\"\\nFixing DATABASE_URL environment variable...\")\\
            old_url = os.environ[\"DATABASE_URL\"]\\
            os.environ[\"DATABASE_URL\"] = old_url.replace(\"postgres.railway.internal\", pg_host)\\
            print(f\"Updated DATABASE_URL to use host: {pg_host}\")\\
    else:\\
        print(\"\\nWARNING: Could not determine correct PostgreSQL host!\")\\
\\
def patched_import(name, globals=None, locals=None, fromlist=(), level=0):\\
    # Intercept specific imports that might cause database operations\\
    if name in [\"sqlalchemy\", \"databases\", \"psycopg2\"]:\\
        print(f\"Note: Import of {name} detected - connections may be intercepted if DISABLE_DB=true\")\\
        # Print all the environment variables that might affect database connections\\
        print(\"Debug - Database Environment Variables:\")\\
        for var in sorted(os.environ.keys()):\\
            if var.startswith(\"PG\") or \"DB\" in var or \"SQL\" in var or \"POSTGRES\" in var:\\
                # Hide passwords\\
                if \"PASSWORD\" in var or \"PWD\" in var:\\
                    print(f\"  {var}: ****\")\\
                else:\\
                    print(f\"  {var}: {os.environ.get(var)}\")\\
        \\
        # If importing SQLAlchemy, set up to patch it\\
        if name == \"sqlalchemy\":\\
            module = original_import(name, globals, locals, fromlist, level)\\
            # Try to override any postgres.railway.internal connections\\
            override_postgres_connection()\\
            return module\\
        \\
        # Intercept and patch psycopg2 if it fails with \"postgres.railway.internal\"\\
        if name == \"psycopg2\" and fromlist and \"OperationalError\" in fromlist:\\
            # Try to override any postgres.railway.internal connections\\
            override_postgres_connection()\\
            \\
            # Get the original module\\
            psycopg2_module = original_import(name, globals, locals, fromlist, level)\\
            \\
            # Store the original OperationalError\\
            original_error = psycopg2_module.OperationalError\\
            \\
            # Create a patched version\\
            def patched_error(*args, **kwargs):\\
                error_msg = args[0] if args else \"\"\\
                if isinstance(error_msg, str) and \"could not translate host name\" in error_msg and \"railway.internal\" in error_msg:\\
                    print(\"\\n\\nDETECTED RAILWAY POSTGRES CONNECTION ISSUE!\")\\
                    print(\"The application is trying to connect to Railway PostgreSQL using the internal hostname.\")\\
                    print(\"This may be due to missing environment variables or incorrect configuration.\")\\
                    print(\"\\nTrying to fix the issue by checking environment variables...\")\\
                    \\
                    # Check for Railway PG environment variables\\
                    pg_vars = {k: v for k, v in os.environ.items() if k.startswith(\"PG\") and \"PASSWORD\" not in k}\\
                    print(f\"Railway PostgreSQL variables: {pg_vars}\")\\
                    \\
                    # Suggest possible fixes\\
                    print(\"\\nPOSSIBLE SOLUTIONS:\")\\
                    print(\"1. Make sure PGHOST is set to the correct hostname in Railway\")\\
                    print(\"2. Set DATABASE_URL explicitly with the correct hostname\")\\
                    print(\"3. Check the Railway dashboard for the correct PostgreSQL connection details\")\\
                return original_error(*args, **kwargs)\\
            \\
            # Replace the OperationalError with our patched version\\
            psycopg2_module.OperationalError = patched_error\\
            return psycopg2_module\\
    \\
    # Let the original import proceed\\
    return original_import(name, globals, locals, fromlist, level)\\
\\
# Replace the built-in import function\\
builtins.__import__ = patched_import\\
\\
# Immediately try to fix any hardcoded database URLs\\
override_postgres_connection()\\
" > /app/backend/monkeypatch.py

# Create a simple app for testing
RUN mkdir -p /app/simple_app
RUN echo "from fastapi import FastAPI\\
\\
app = FastAPI()\\
\\
@app.get(\"/health\")\\
def health_check():\\
    return {\"status\": \"ok\"}\\
\\
@app.get(\"/\")\\
def root():\\
    return {\"message\": \"Hello World\"}\\
" > /app/simple_app/main.py

# Create default .env file if it doesn't exist
RUN echo "#!/bin/bash\\
\\
# Create default .env file with placeholder values\\
if [ ! -f /app/backend/.env ]; then\\
  echo \"Creating default .env file with placeholder values...\"\\
  cat > /app/backend/.env << EOL\\
# Database configuration\\
DATABASE_URL=postgresql://postgres:password@localhost:5432/telegram_parser\\
POSTGRES_USER=postgres\\
POSTGRES_PASSWORD=password\\
POSTGRES_DB=telegram_parser\\
\\
# JWT Authentication\\
SECRET_KEY=temporarysecretkey123456789\\
ALGORITHM=HS256\\
ACCESS_TOKEN_EXPIRE_MINUTES=10080\\
\\
# Application settings\\
BACKEND_CORS_ORIGINS=[\"http://localhost:3000\", \"http://localhost:8000\"]\\
\\
# Telegram API credentials\\
API_ID=0000000\\
API_HASH=temporaryapihash\\
TELEGRAM_BOT_TOKENS=[\"token1\"]\\
\\
# Email settings\\
MAIL_USERNAME=user@example.com\\
MAIL_PASSWORD=password\\
MAIL_FROM=noreply@example.com\\
MAIL_PORT=587\\
MAIL_SERVER=smtp.example.com\\
EOL\\
fi" > /app/create_default_env.sh
RUN chmod +x /app/create_default_env.sh

# Create a startup script with error handling and diagnostics
RUN echo "#!/bin/bash" > /app/start.sh && \
    echo "set -e" >> /app/start.sh && \
    echo "echo \"Current directory: \$(pwd)\"" >> /app/start.sh && \
    echo "echo \"Listing files in current directory:\"" >> /app/start.sh && \
    echo "ls -la" >> /app/start.sh && \
    echo "# Early PostgreSQL hostname fix - replace postgres.railway.internal with appropriate hostname" >> /app/start.sh && \
    echo "if [[ -n \"\$PGHOST\" ]]; then" >> /app/start.sh && \
    echo "  echo \"EARLY FIX: Setting up DATABASE_URL with correct PostgreSQL host (\$PGHOST)\"" >> /app/start.sh && \
    echo "  if [[ -n \"\$PGUSER\" && -n \"\$PGPASSWORD\" && -n \"\$PGDATABASE\" ]]; then" >> /app/start.sh && \
    echo "    export DATABASE_URL=\"postgresql://\${PGUSER}:\${PGPASSWORD}@\${PGHOST}:\${PGPORT:-5432}/\${PGDATABASE}\"" >> /app/start.sh && \
    echo "    echo \"Set DATABASE_URL using PGHOST and Railway PostgreSQL variables\"" >> /app/start.sh && \
    echo "  fi" >> /app/start.sh && \
    echo "fi" >> /app/start.sh && \
    echo "# Create a fix for SQLALCHEMY_DATABASE_URI environment variable if present" >> /app/start.sh && \
    echo "if [[ -n \"\$DATABASE_URL\" ]]; then" >> /app/start.sh && \
    echo "  export SQLALCHEMY_DATABASE_URI=\"\$DATABASE_URL\"" >> /app/start.sh && \
    echo "  echo \"Set SQLALCHEMY_DATABASE_URI=\$SQLALCHEMY_DATABASE_URI (password hidden)\"" >> /app/start.sh && \
    echo "fi" >> /app/start.sh && \
    echo "echo \"Creating default .env file if needed\"" >> /app/start.sh && \
    echo "/app/create_default_env.sh" >> /app/start.sh && \
    echo "# Dump ALL environment variables for debugging (with passwords hidden)" >> /app/start.sh && \
    echo "env | grep -v PASSWORD | grep -v SECRET | sort" >> /app/start.sh && \
    echo "# Do not skip database operations anymore" >> /app/start.sh && \
    echo "export SKIP_DB_INIT=false" >> /app/start.sh && \
    echo "export DISABLE_DB=false" >> /app/start.sh && \
    echo "# List all database-related environment variables" >> /app/start.sh && \
    echo "echo \"=== DATABASE ENVIRONMENT VARIABLES ===\"" >> /app/start.sh && \
    echo "env | grep -i \"db\|database\|pg\|sql\|postgres\" | grep -v PASSWORD | grep -v SECRET | sort" >> /app/start.sh && \
    echo "# Handle Railway PostgreSQL connection" >> /app/start.sh && \
    echo "if [[ -n \"\$DATABASE_URL\" ]]; then" >> /app/start.sh && \
    echo "  echo \"Using provided DATABASE_URL\"" >> /app/start.sh && \
    echo "elif [[ -n \"\$RAILWAY_ENVIRONMENT\" ]]; then" >> /app/start.sh && \
    echo "  echo \"Running in Railway environment\"" >> /app/start.sh && \
    echo "  # Railway provides PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT variables" >> /app/start.sh && \
    echo "  if [[ -n \"\$PGUSER\" && -n \"\$PGPASSWORD\" && -n \"\$PGDATABASE\" && -n \"\$PGHOST\" ]]; then" >> /app/start.sh && \
    echo "    echo \"Using Railway-provided PG* variables\"" >> /app/start.sh && \
    echo "    export DATABASE_URL=\"postgresql://\${PGUSER}:\${PGPASSWORD}@\${PGHOST}:\${PGPORT:-5432}/\${PGDATABASE}\"" >> /app/start.sh && \
    echo "  fi" >> /app/start.sh && \
    echo "elif [[ -n \"\$POSTGRES_USER\" && -n \"\$POSTGRES_PASSWORD\" && -n \"\$POSTGRES_DB\" ]]; then" >> /app/start.sh && \
    echo "  echo \"Constructing DATABASE_URL from POSTGRES_* variables\"" >> /app/start.sh && \
    echo "  # Railway might use different hostnames" >> /app/start.sh && \
    echo "  POSTGRES_HOST=\${PGHOST:-\"postgresql.railway.app\"}" >> /app/start.sh && \
    echo "  POSTGRES_PORT=\${PGPORT:-5432}" >> /app/start.sh && \
    echo "  export DATABASE_URL=\"postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@\${POSTGRES_HOST}:\${POSTGRES_PORT}/\${POSTGRES_DB}\"" >> /app/start.sh && \
    echo "fi" >> /app/start.sh && \
    echo "echo \"DATABASE_URL: \${DATABASE_URL:-not set} (password hidden)\"" >> /app/start.sh && \
    echo "echo \"DISABLE_DB: \${DISABLE_DB}\"" >> /app/start.sh && \
    echo "# Test connectivity to PostgreSQL" >> /app/start.sh && \
    echo "if [[ -n \"\$DATABASE_URL\" ]]; then" >> /app/start.sh && \
    echo "  echo \"Testing PostgreSQL connectivity...\"" >> /app/start.sh && \
    echo "  # Extract host and port from DATABASE_URL" >> /app/start.sh && \
    echo "  DB_HOST=\$(echo \$DATABASE_URL | sed -n \"s/.*@\([^:]*\).*/\\1/p\")" >> /app/start.sh && \
    echo "  DB_PORT=\$(echo \$DATABASE_URL | sed -n \"s/.*:\([0-9]*\)\\/.*/\\1/p\")" >> /app/start.sh && \
    echo "  echo \"Extracted DB_HOST=\$DB_HOST DB_PORT=\$DB_PORT\"" >> /app/start.sh && \
    echo "  # Try to ping the host" >> /app/start.sh && \
    echo "  echo \"Trying to ping \$DB_HOST...\"" >> /app/start.sh && \
    echo "  ping -c 1 \$DB_HOST || echo \"Ping failed, but this might be expected\"" >> /app/start.sh && \
    echo "  # Try to connect using nc" >> /app/start.sh && \
    echo "  echo \"Trying netcat to \$DB_HOST:\$DB_PORT...\"" >> /app/start.sh && \
    echo "  nc -z -v -w5 \$DB_HOST \$DB_PORT || echo \"Netcat connection failed\"" >> /app/start.sh && \
    echo "  # DNS lookup" >> /app/start.sh && \
    echo "  echo \"DNS lookup for \$DB_HOST...\"" >> /app/start.sh && \
    echo "  nslookup \$DB_HOST || echo \"DNS lookup failed\"" >> /app/start.sh && \
    echo "  # Environment variables that might affect PostgreSQL connections" >> /app/start.sh && \
    echo "  echo \"PostgreSQL environment variables:\"" >> /app/start.sh && \
    echo "  env | grep -i \"pg\|postgres\|sql\" | grep -v PASSWORD" >> /app/start.sh && \
    echo "fi" >> /app/start.sh && \
    echo "echo \"Checking for existence of app directory:\"" >> /app/start.sh && \
    echo "if [ -d /app/backend/app ]; then" >> /app/start.sh && \
    echo "  echo \"App directory exists\"" >> /app/start.sh && \
    echo "  echo \"Contents of app directory:\"" >> /app/start.sh && \
    echo "  ls -la /app/backend/app" >> /app/start.sh && \
    echo "else" >> /app/start.sh && \
    echo "  echo \"App directory does not exist\"" >> /app/start.sh && \
    echo "fi" >> /app/start.sh && \
    echo "echo \"Checking for main.py:\"" >> /app/start.sh && \
    echo "if [ -f /app/backend/app/main.py ]; then" >> /app/start.sh && \
    echo "  echo \"main.py exists\"" >> /app/start.sh && \
    echo "else" >> /app/start.sh && \
    echo "  echo \"main.py does not exist\"" >> /app/start.sh && \
    echo "fi" >> /app/start.sh && \
    echo "echo \"PORT=\$PORT\"" >> /app/start.sh && \
    echo "export PORT=\${PORT:-8000}" >> /app/start.sh && \
    echo "echo \"Environment variables:\"" >> /app/start.sh && \
    echo "echo \"SECRET_KEY set: \${SECRET_KEY:+true}\"" >> /app/start.sh && \
    echo "echo \"DATABASE_URL set: \${DATABASE_URL:+true}\"" >> /app/start.sh && \
    echo "# Initialize the database" >> /app/start.sh && \
    echo "if [[ -n \"\$DATABASE_URL\" && \"\$SKIP_DB_INIT\" != \"true\" ]]; then" >> /app/start.sh && \
    echo "  echo \"Initializing database...\"" >> /app/start.sh && \
    echo "  set +e  # Temporarily disable exit on error" >> /app/start.sh && \
    echo "  cd /app/backend && python init_db.py" >> /app/start.sh && \
    echo "  DB_INIT_RESULT=\$?" >> /app/start.sh && \
    echo "  set -e  # Re-enable exit on error" >> /app/start.sh && \
    echo "  if [ \$DB_INIT_RESULT -ne 0 ]; then" >> /app/start.sh && \
    echo "    echo \"Warning: Database initialization failed with exit code \$DB_INIT_RESULT\"" >> /app/start.sh && \
    echo "    echo \"Will continue to start the application anyway\"" >> /app/start.sh && \
    echo "  else" >> /app/start.sh && \
    echo "    echo \"Database initialization completed successfully\"" >> /app/start.sh && \
    echo "  fi" >> /app/start.sh && \
    echo "else" >> /app/start.sh && \
    echo "  echo \"Skipping database initialization\"" >> /app/start.sh && \
    echo "fi" >> /app/start.sh && \
    echo "echo \"Starting application...\"" >> /app/start.sh && \
    echo "if [ -f /app/backend/app/main.py ]; then" >> /app/start.sh && \
    echo "  echo \"Starting with app wrapper to handle database issues\"" >> /app/start.sh && \
    echo "  cd /app/backend && gunicorn app_wrapper:app --workers 1 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:\$PORT --timeout 300 --log-level debug" >> /app/start.sh && \
    echo "else" >> /app/start.sh && \
    echo "  echo \"Main app not found, running simple test app instead...\"" >> /app/start.sh && \
    echo "  cd /app/simple_app && gunicorn main:app --workers 1 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:\$PORT --timeout 300 --log-level debug" >> /app/start.sh && \
    echo "fi" >> /app/start.sh && \
    chmod +x /app/start.sh

# Expose the port
EXPOSE 8000

# Command to run the application
CMD ["/bin/bash", "/app/start.sh"] 