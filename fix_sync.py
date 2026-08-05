import re

with open('server.ts', 'r') as f:
    content = f.read()

replacement = """
export async function saveDB(data: any) {
  // Save locally
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  
  // Sync to Firestore if available
  if (firestore) {
    try {
      // First check if cloud has newer data to avoid wiping out Cloudflare changes
      const doc = await firestore.collection('core_system').doc('main_database').get();
      if (doc.exists) {
        const firestoreData = doc.data();
        if (firestoreData && firestoreData.data) {
          const parsed = JSON.parse(firestoreData.data);
          if (parsed.lastUpdated && data.lastUpdated && new Date(parsed.lastUpdated) > new Date(data.lastUpdated)) {
            console.log('[FIRESTORE ADMIN] Warning: Cloud database is newer than local. Skipping overwrite to prevent data loss.');
            return; // Don't overwrite if cloud has newer data (e.g. from Cloudflare)
          }
        }
      }

      data.lastUpdated = new Date().toISOString();
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); // update local with new timestamp
      
      await firestore.collection('core_system').doc('main_database').set({
        data: JSON.stringify(data),
        lastUpdated: data.lastUpdated
      });
"""

# Find the export async function saveDB
content = re.sub(
    r'export async function saveDB\(data: any\) \{[\s\S]*?lastUpdated: new Date\(\)\.toISOString\(\)\n      \}\);',
    replacement.strip(),
    content
)

with open('server.ts', 'w') as f:
    f.write(content)

