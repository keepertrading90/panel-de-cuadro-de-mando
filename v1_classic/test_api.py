
import urllib.request
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def test_api():
    print("--- Testing API Health ---")
    try:
        with urllib.request.urlopen(f"{BASE_URL}/health", timeout=5) as r:
            data = json.loads(r.read().decode())
            print(f"Health: {r.status}, {data}")
    except Exception as e:
        print(f"Health failed (Is server running?): {e}")

    print("\n--- Testing List Scenarios ---")
    try:
        with urllib.request.urlopen(f"{BASE_URL}/api/scenarios", timeout=5) as r:
            data = json.loads(r.read().decode())
            print(f"Scenarios: {r.status}, {data}")
    except Exception as e:
        print(f"Scenarios failed: {e}")

if __name__ == "__main__":
    test_api()
    sys.exit(0)
