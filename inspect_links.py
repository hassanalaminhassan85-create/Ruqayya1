import json

with open('storage/db.json', 'r') as f:
    db = json.load(f)

for shareholder in db['shareholders']:
    print(f"Shareholder: {shareholder['full_name']}, Email: {shareholder['email']}")
    if 'user_id' in shareholder:
        user = next((u for u in db['users'] if u['id'] == shareholder['user_id']), None)
        if user:
            print(f"  Linked to user: {user['full_name']} ({user['email']})")
        else:
            print(f"  USER NOT FOUND for id: {shareholder['user_id']}")
    else:
        print("  NO USER_ID")

