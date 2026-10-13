const DATABASE_NAME = "taskmanager-v2";
const DATABASE_VERSION = 1;
let databasePromise;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("A database request failed."));
  });
}

export function openDatabase() {
  if (databasePromise) return databasePromise;
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("This browser does not support IndexedDB. Try a current version of Edge, Chrome, or Firefox."));
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const transaction = request.transaction;
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("users")) {
        const users = db.createObjectStore("users", { keyPath: "id" });
        users.createIndex("usernameLower", "usernameLower", { unique: true });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "userId" });
      }
      if (!db.objectStoreNames.contains("tasks")) {
        const tasks = db.createObjectStore("tasks", { keyPath: "id" });
        tasks.createIndex("userId", "userId", { unique: false });
        tasks.createIndex("userIdDueDate", ["userId", "dueDate"], { unique: false });
      }
      const meta = transaction.objectStore("meta");
      meta.put({ key: "schemaVersion", value: DATABASE_VERSION, updatedAt: new Date().toISOString() });
      meta.put({ key: "createdAt", value: new Date().toISOString() });
      // Future schema changes should increment DATABASE_VERSION and use explicit migration branches here.
      if (event.oldVersion > DATABASE_VERSION) {
        transaction.abort();
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        databasePromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error || new Error("Could not open the local database."));
    };
    request.onblocked = () => {
      reject(new Error("The local database upgrade is blocked. Close other TaskManager tabs and refresh this page."));
    };
  });
  return databasePromise;
}

export async function getRecord(storeName, key) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, "readonly");
  return requestResult(transaction.objectStore(storeName).get(key));
}

export async function addRecord(storeName, record) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, "readwrite");
  return requestResult(transaction.objectStore(storeName).add(record));
}

export async function putRecord(storeName, record) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, "readwrite");
  return requestResult(transaction.objectStore(storeName).put(record));
}

export async function getUserByUsername(username) {
  const db = await openDatabase();
  const transaction = db.transaction("users", "readonly");
  return requestResult(transaction.objectStore("users").index("usernameLower").get(username.toLowerCase()));
}

export async function getSetting(userId) {
  const record = await getRecord("settings", userId);
  return record?.values && typeof record.values === "object" ? record.values : {};
}

export async function saveSetting(userId, key, value) {
  const values = await getSetting(userId);
  values[key] = value;
  await putRecord("settings", { userId, values, updatedAt: new Date().toISOString() });
}


export async function getTasksForUser(userId) {
  const db = await openDatabase();
  const transaction = db.transaction("tasks", "readonly");
  return requestResult(transaction.objectStore("tasks").index("userId").getAll(userId));
}

export async function getTaskById(taskId) {
  return getRecord("tasks", taskId);
}

export async function saveTask(task) {
  return putRecord("tasks", task);
}

export async function deleteTask(taskId) {
  const db = await openDatabase();
  const transaction = db.transaction("tasks", "readwrite");
  return requestResult(transaction.objectStore("tasks").delete(taskId));
}
