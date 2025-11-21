import { openDB, DBSchema } from 'idb';
import { DailyRecord } from './types';

interface Monit0rDB extends DBSchema {
  daily_records: {
    key: string;
    value: DailyRecord;
    indexes: { 'by-date': string; 'by-class': string };
  };
}

const DB_NAME = 'Monit0rDB';
const STORE_NAME = 'daily_records';

// Initialize Database
export const initDB = async () => {
  return openDB<Monit0rDB>(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by-date', 'date');
        store.createIndex('by-class', 'classId');
      }
    },
  });
};

// Save a new record or update existing
export const saveRecordToDB = async (record: DailyRecord) => {
  const db = await initDB();
  return db.put(STORE_NAME, record);
};

// Get all records
export const getRecordsFromDB = async (): Promise<DailyRecord[]> => {
  const db = await initDB();
  return db.getAll(STORE_NAME);
};

// Delete a record
export const deleteRecordFromDB = async (id: string) => {
  const db = await initDB();
  return db.delete(STORE_NAME, id);
};

// Get records by Class
export const getRecordsByClass = async (classId: string): Promise<DailyRecord[]> => {
  const db = await initDB();
  return db.getAllFromIndex(STORE_NAME, 'by-class', classId);
};

// Clear all data (for debugging or reset)
export const clearAllData = async () => {
    const db = await initDB();
    return db.clear(STORE_NAME);
}
