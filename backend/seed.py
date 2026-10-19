import logging

from app.core.database import SessionLocal
from app.services.bootstrap_service import seed_database

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
