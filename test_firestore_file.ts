

const FIREBASE_CONFIG = {
  projectId: "aesthetic-reference-fw1xt",
  apiKey: "AIzaSyCAMd4TDpQKAh2yCU0j-Z2f107QKoSVWDA",
  firestoreDatabaseId: "ai-studio-ruqayyatransport-ec9c3d70-1fac-4a98-a67d-8c340e7f6358"
};

const getFirestoreFileUrl = (filename: string) => {
  const { projectId, firestoreDatabaseId, apiKey } = FIREBASE_CONFIG;
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/uploaded_files/${encodeURIComponent(filename)}?key=${apiKey}`;
};

function valToPlain(valObj: any): any {
  if (!valObj || typeof valObj !== 'object') return valObj;
  if ('stringValue' in valObj) return valObj.stringValue;
  if ('integerValue' in valObj) return parseInt(valObj.integerValue, 10);
  if ('doubleValue' in valObj) return parseFloat(valObj.doubleValue);
  if ('booleanValue' in valObj) return valObj.booleanValue;
  if ('nullValue' in valObj) return null;
  if ('arrayValue' in valObj && valObj.arrayValue.values) {
    return valObj.arrayValue.values.map((v: any) => valToPlain(v));
  }
  if ('mapValue' in valObj && valObj.mapValue.fields) {
    return firestoreToPlain(valObj.mapValue.fields);
  }
  return valObj;
}

function firestoreToPlain(fields: any): any {
  if (!fields) return {};
  const plain: any = {};
  for (const [key, value] of Object.entries(fields)) {
    plain[key] = valToPlain(value);
  }
  return plain;
}

function plainToFirestore(obj: any): any {
  if (obj === null || obj === undefined) return { nullValue: null };
  if (typeof obj === 'string') return { stringValue: obj };
  if (typeof obj === 'boolean') return { booleanValue: obj };
  if (typeof obj === 'number') {
    if (Number.isInteger(obj)) {
      return { integerValue: obj.toString() };
    } else {
      return { doubleValue: obj };
    }
  }
  if (Array.isArray(obj)) {
    return {
      arrayValue: {
        values: obj.map(item => plainToFirestore(item))
      }
    };
  }
  if (typeof obj === 'object') {
    const fields: any = {};
    for (const [key, value] of Object.entries(obj)) {
      fields[key] = plainToFirestore(value);
    }
    return { mapValue: { fields } };
  }
  return {};
}

async function run() {
  const filename = "avatar_test.png";
  const url = getFirestoreFileUrl(filename);
  
  // 1. Save
  const cleanBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const converted = plainToFirestore({ base64: cleanBase64, timestamp: new Date().toISOString() });
  const fields = converted && converted.mapValue ? converted.mapValue.fields : {};
  
  const resSave = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  console.log("Save status:", resSave.status);
  console.log("Save body:", await resSave.text());
  
  // 2. Fetch
  const resFetch = await fetch(url);
  console.log("Fetch status:", resFetch.status);
  const doc = await resFetch.json() as any;
  if (doc && doc.fields) {
    const plain = firestoreToPlain(doc.fields);
    console.log("Fetched base64:", plain.base64);
  }
}

run();
