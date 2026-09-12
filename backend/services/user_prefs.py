import json
from typing import Dict, Any
from services.supabase_client import supabase

def get_user_prefs(session_id: str) -> Dict[str, Any]:
    """Retrieve preferences for a given session_id via Supabase."""
    if not session_id or not supabase:
        return {}
        
    try:
        response = supabase.table('user_preferences').select('*').eq('session_id', session_id).execute()
        data = response.data
        if data and len(data) > 0:
            return data[0]
        return {}
    except Exception as e:
        print(f"[WARN] Error fetching user_prefs from Supabase: {e}")
        return {}

def save_user_prefs(session_id: str, prefs: Dict[str, Any]) -> bool:
    """Save preferences for a given session_id via Supabase."""
    if not session_id or not supabase:
        return False
        
    # Get existing to merge
    existing = get_user_prefs(session_id)
    # The schema specifies columns like theme, locale, symbol, risk_mode, timeframe
    valid_keys = ['theme', 'locale', 'symbol', 'risk_mode', 'timeframe']
    
    # Filter only valid keys
    update_data = {k: v for k, v in prefs.items() if k in valid_keys}
    if not update_data:
        return True # Nothing to update
        
    update_data['session_id'] = session_id
    
    # Supabase uses upsert on a unique constraint or primary key
    # Since session_id is UNIQUE, we can use it to match if we supply id, 
    # or just use upsert with on_conflict='session_id'.
    try:
        if 'id' in existing:
            update_data['id'] = existing['id']
            
        supabase.table('user_preferences').upsert(update_data, on_conflict='session_id').execute()
        return True
    except Exception as e:
        print(f"[WARN] Error saving user_prefs to Supabase: {e}")
        return False
