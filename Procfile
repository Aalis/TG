web: cd backend && gunicorn app.main:app --workers ${WORKERS:-2} --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT # Added Railway deployment
