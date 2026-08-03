import json
import os

with open('storage/db.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

updated = False

if 'drivers' in data:
    for d in data['drivers']:
        if d.get('passport_photo_url') and 'unsplash.com' in d['passport_photo_url']:
            d['passport_photo_url'] = ''
            updated = True
        if d.get('passportPhoto') and 'unsplash.com' in d['passportPhoto']:
            d['passportPhoto'] = ''
            updated = True
        if d.get('passport_photo') and 'unsplash.com' in d['passport_photo']:
            d['passport_photo'] = ''
            updated = True
        if d.get('documents'):
            for doc in d['documents']:
                if doc.get('file_url') and 'unsplash.com' in doc['file_url']:
                    doc['file_url'] = ''
                    updated = True

if 'shareholders' in data:
    for s in data['shareholders']:
        if s.get('passport_photo_url') and 'unsplash.com' in s['passport_photo_url']:
            s['passport_photo_url'] = ''
            updated = True
        if s.get('passportPhoto') and 'unsplash.com' in s['passportPhoto']:
            s['passportPhoto'] = ''
            updated = True
        if s.get('passport_photo') and 'unsplash.com' in s['passport_photo']:
            s['passport_photo'] = ''
            updated = True
        if s.get('passport') and 'unsplash.com' in s['passport']:
            s['passport'] = ''
            updated = True

if updated:
    with open('storage/db.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    print("Scrubbed unsplash links from storage/db.json")
else:
    print("No unsplash links found in db.json")
