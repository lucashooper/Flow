// Check what's in IndexedDB
(function() {
  const dbName = 'flow-notes-db';
  const request = indexedDB.open(dbName);
  
  request.onsuccess = (event) => {
    const db = event.target.result;
    console.log('IndexedDB version:', db.version);
    console.log('Object stores:', Array.from(db.objectStoreNames));
    db.close();
  };
  
  request.onerror = () => {
    console.error('Failed to open IndexedDB');
  };
})();
