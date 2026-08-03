import { firestore } from './src/utils/server_db';

async function fixDb() {
  if (!firestore) {
    console.log("No firestore configured yet.");
    return;
  }
  
  const CLOUD_DB_COLLECTION = 'ruqayya_transport_cloud';
  const CLOUD_DB_DOC = 'main_state';

  const docRef = firestore.collection(CLOUD_DB_COLLECTION).doc(CLOUD_DB_DOC);
  const doc = await docRef.get();
  
  if (!doc.exists) {
    console.log("No doc found.");
    return;
  }

  const data = doc.data();
  let updated = false;

  if (data.drivers) {
    data.drivers.forEach((d: any) => {
      if (d.passport_photo_url && d.passport_photo_url.includes('unsplash.com')) {
        d.passport_photo_url = '';
        updated = true;
      }
      if (d.passportPhoto && d.passportPhoto.includes('unsplash.com')) {
        d.passportPhoto = '';
        updated = true;
      }
      if (d.passport_photo && d.passport_photo.includes('unsplash.com')) {
        d.passport_photo = '';
        updated = true;
      }
      if (d.documents) {
        d.documents.forEach((doc: any) => {
          if (doc.file_url && doc.file_url.includes('unsplash.com')) {
            doc.file_url = '';
            updated = true;
          }
        });
      }
    });
  }

  if (data.shareholders) {
    data.shareholders.forEach((s: any) => {
      if (s.passport_photo_url && s.passport_photo_url.includes('unsplash.com')) {
        s.passport_photo_url = '';
        updated = true;
      }
      if (s.passportPhoto && s.passportPhoto.includes('unsplash.com')) {
        s.passportPhoto = '';
        updated = true;
      }
      if (s.passport_photo && s.passport_photo.includes('unsplash.com')) {
        s.passport_photo = '';
        updated = true;
      }
      if (s.passport && s.passport.includes('unsplash.com')) {
        s.passport = '';
        updated = true;
      }
    });
  }

  if (updated) {
    await docRef.set(data);
    console.log("Database updated successfully, unsplash links removed!");
  } else {
    console.log("No unsplash links found in database.");
  }
}

fixDb().catch(console.error);
