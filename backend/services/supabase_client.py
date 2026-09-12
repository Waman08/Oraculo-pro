import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# We need URL and KEY. Usually NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[WARN] Supabase credentials not found. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.")

supabase: Client | None = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
