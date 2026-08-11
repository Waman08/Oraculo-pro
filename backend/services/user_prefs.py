import sqlite3
import json
import os
from typing import Dict, Any

# Ensure the data directory exists
DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = os.path.join(DB_DIR, "user_prefs.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_prefs (
            uuid TEXT PRIMARY KEY,
            preferences TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

# Initialize DB on import
init_db()

def get_user_prefs(uuid: str) -> Dict[str, Any]:
    """Retrieve preferences for a given UUID."""
    if not uuid:
        return {}
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT preferences FROM user_prefs WHERE uuid = ?", (uuid,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        try:
            return json.loads(row[0])
        except json.JSONDecodeError:
            return {}
    return {}

def save_user_prefs(uuid: str, prefs: Dict[str, Any]) -> bool:
    """Save preferences for a given UUID."""
    if not uuid:
        return False
        
    # Get existing to merge
    existing = get_user_prefs(uuid)
    existing.update(prefs)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO user_prefs (uuid, preferences) VALUES (?, ?)",
        (uuid, json.dumps(existing))
    )
    conn.commit()
    conn.close()
    return True
