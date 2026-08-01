import json

with open('storage/db.json', 'r') as f:
    db = json.load(f)

for shareholder in db['shareholders']:
    if 'user_id' not in shareholder:
        user = next((u for u in db['users'] if u['email'].lower() == shareholder['email'].lower()), None)
        if user:
            shareholder['user_id'] = user['id']
            print(f"Linked shareholder {shareholder['full_name']} to user {user['id']}")

with open('storage/db.json', 'w') as f:
    json.dump(db, f, indent=2)
