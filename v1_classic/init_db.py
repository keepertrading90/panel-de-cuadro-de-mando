
from backend.db import database
import sys

try:
    database.init_db()
    print("Database initialized with new schema.")
    sys.exit(0)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
