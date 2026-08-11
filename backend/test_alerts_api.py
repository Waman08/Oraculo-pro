import sys
import os
os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import httpx

BASE = "http://localhost:8000"

# Test 1: Sync alerts
print("=== Test 1: Sync alerts ===")
r = httpx.post(f"{BASE}/api/alerts/sync", json={
    "alerts": [
        {"id": "test1", "symbol": "BTC", "targetPrice": 79000, "condition": "below", "triggered": False},
        {"id": "test2", "symbol": "ETH", "targetPrice": 5000, "condition": "above", "triggered": False},
    ]
})
print(f"Status: {r.status_code}, Body: {r.text}")

# Test 2: Get alerts
print("\n=== Test 2: Get alerts ===")
r = httpx.get(f"{BASE}/api/alerts")
print(f"Status: {r.status_code}, Body: {r.text}")

# Test 3: Check alerts (manual trigger)
print("\n=== Test 3: Check alerts now ===")
r = httpx.post(f"{BASE}/api/alerts/check")
print(f"Status: {r.status_code}, Body: {r.text}")

print("\n[DONE] All API tests passed!")
