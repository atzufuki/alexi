var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/alexi_db/backends/backend.ts
var DatabaseBackend;
var init_backend = __esm({
  "src/alexi_db/backends/backend.ts"() {
    DatabaseBackend = class {
      _config;
      _connected = false;
      constructor(config11) {
        this._config = config11;
      }
      /**
       * Get the configuration
       */
      get config() {
        return this._config;
      }
      /**
       * Check if connected to the database
       */
      get isConnected() {
        return this._connected;
      }
      /**
       * Ensure the backend is connected, throwing if not
       */
      ensureConnected() {
        if (!this._connected) {
          throw new Error(`Database backend '${this._config.engine}' is not connected. Call connect() first.`);
        }
      }
      /**
       * Execute a function within a transaction
       * Automatically commits on success, rolls back on error
       */
      async atomic(fn) {
        const transaction = await this.beginTransaction();
        try {
          const result = await fn();
          await transaction.commit();
          return result;
        } catch (error) {
          await transaction.rollback();
          throw error;
        }
      }
      // ============================================================================
      // Utility Methods
      // ============================================================================
      /**
       * Apply filter conditions to check if a record matches
       * Used by NoSQL backends that filter in memory
       */
      matchesFilters(record, filters) {
        for (const filter of filters) {
          const fieldValue = this.getNestedValue(record, filter.field);
          const matches = this.evaluateLookup(fieldValue, filter.lookup, filter.value);
          const result = filter.negated ? !matches : matches;
          if (!result) {
            return false;
          }
        }
        return true;
      }
      /**
       * Get a nested value from an object using dot notation
       */
      getNestedValue(obj, path) {
        const parts = path.split("__");
        let value = obj;
        for (const part of parts) {
          if (value === null || value === void 0) {
            return void 0;
          }
          value = value[part];
        }
        return value;
      }
      /**
       * Evaluate a lookup operation
       */
      evaluateLookup(fieldValue, lookup, compareValue) {
        switch (lookup) {
          case "exact":
            return fieldValue === compareValue;
          case "iexact":
            return String(fieldValue).toLowerCase() === String(compareValue).toLowerCase();
          case "contains":
            return String(fieldValue).includes(String(compareValue));
          case "icontains":
            return String(fieldValue).toLowerCase().includes(String(compareValue).toLowerCase());
          case "startswith":
            return String(fieldValue).startsWith(String(compareValue));
          case "istartswith":
            return String(fieldValue).toLowerCase().startsWith(String(compareValue).toLowerCase());
          case "endswith":
            return String(fieldValue).endsWith(String(compareValue));
          case "iendswith":
            return String(fieldValue).toLowerCase().endsWith(String(compareValue).toLowerCase());
          case "in":
            return Array.isArray(compareValue) && compareValue.includes(fieldValue);
          case "gt":
            return fieldValue > compareValue;
          case "gte":
            return fieldValue >= compareValue;
          case "lt":
            return fieldValue < compareValue;
          case "lte":
            return fieldValue <= compareValue;
          case "range": {
            const [min, max] = compareValue;
            const val = fieldValue;
            return val >= min && val <= max;
          }
          case "isnull":
            return (fieldValue === null || fieldValue === void 0) === compareValue;
          case "regex":
            return new RegExp(String(compareValue)).test(String(fieldValue));
          case "iregex":
            return new RegExp(String(compareValue), "i").test(String(fieldValue));
          case "year":
            return fieldValue instanceof Date && fieldValue.getFullYear() === compareValue;
          case "month":
            return fieldValue instanceof Date && fieldValue.getMonth() + 1 === compareValue;
          case "day":
            return fieldValue instanceof Date && fieldValue.getDate() === compareValue;
          case "week": {
            if (!(fieldValue instanceof Date)) return false;
            const startOfYear = new Date(fieldValue.getFullYear(), 0, 1);
            const days = Math.floor((fieldValue.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1e3));
            const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
            return weekNumber === compareValue;
          }
          case "weekday":
            return fieldValue instanceof Date && fieldValue.getDay() === compareValue;
          default:
            console.warn(`Unknown lookup type: ${lookup}`);
            return false;
        }
      }
      /**
       * Sort records by ordering specifications
       */
      sortRecords(records, ordering) {
        if (ordering.length === 0) {
          return records;
        }
        return [
          ...records
        ].sort((a, b) => {
          for (const { field, direction } of ordering) {
            const aValue = this.getNestedValue(a, field);
            const bValue = this.getNestedValue(b, field);
            let comparison = 0;
            if (aValue === bValue) {
              comparison = 0;
            } else if (aValue === null || aValue === void 0) {
              comparison = 1;
            } else if (bValue === null || bValue === void 0) {
              comparison = -1;
            } else if (typeof aValue === "string" && typeof bValue === "string") {
              comparison = aValue.localeCompare(bValue);
            } else if (aValue instanceof Date && bValue instanceof Date) {
              comparison = aValue.getTime() - bValue.getTime();
            } else {
              comparison = aValue - bValue;
            }
            if (comparison !== 0) {
              return direction === "DESC" ? -comparison : comparison;
            }
          }
          return 0;
        });
      }
      /**
       * Apply limit and offset to records
       */
      applyLimitOffset(records, limit, offset) {
        let result = records;
        if (offset !== null && offset > 0) {
          result = result.slice(offset);
        }
        if (limit !== null && limit > 0) {
          result = result.slice(0, limit);
        }
        return result;
      }
    };
  }
});

// src/alexi_db/backends/indexeddb/backend.ts
var IndexedDBTransaction, IndexedDBSchemaEditor, IndexedDBBackend;
var init_backend2 = __esm({
  "src/alexi_db/backends/indexeddb/backend.ts"() {
    init_backend();
    IndexedDBTransaction = class {
      _db;
      _operations = [];
      _active = true;
      constructor(db) {
        this._db = db;
      }
      get isActive() {
        return this._active;
      }
      /**
       * Queue a put operation
       */
      queuePut(storeName, value, key) {
        this._operations.push({
          type: "put",
          storeName,
          value,
          key
        });
      }
      /**
       * Queue a delete operation
       */
      queueDelete(storeName, key) {
        this._operations.push({
          type: "delete",
          storeName,
          key
        });
      }
      async commit() {
        if (!this._active) {
          throw new Error("Transaction is no longer active");
        }
        const storeNames = [
          ...new Set(this._operations.map((op) => op.storeName))
        ];
        if (storeNames.length === 0) {
          this._active = false;
          return;
        }
        const tx = this._db.transaction(storeNames, "readwrite");
        return new Promise((resolve, reject) => {
          tx.oncomplete = () => {
            this._active = false;
            resolve();
          };
          tx.onerror = () => {
            this._active = false;
            reject(tx.error);
          };
          tx.onabort = () => {
            this._active = false;
            reject(new Error("IndexedDB transaction aborted"));
          };
          for (const op of this._operations) {
            const store = tx.objectStore(op.storeName);
            if (op.type === "put") {
              if (op.key !== void 0) {
                store.put(op.value, op.key);
              } else {
                store.put(op.value);
              }
            } else {
              store.delete(op.key);
            }
          }
        });
      }
      async rollback() {
        this._operations = [];
        this._active = false;
      }
    };
    IndexedDBSchemaEditor = class {
      _db;
      _pendingChanges = [];
      constructor(db) {
        this._db = db;
      }
      /**
       * Get pending schema changes
       */
      getPendingChanges() {
        return [
          ...this._pendingChanges
        ];
      }
      async createTable(model) {
        const tableName = model.getTableName();
        if (this._db.objectStoreNames.contains(tableName)) {
          return;
        }
        this._pendingChanges.push({
          type: "createStore",
          storeName: tableName
        });
      }
      async dropTable(model) {
        const tableName = model.getTableName();
        if (!this._db.objectStoreNames.contains(tableName)) {
          return;
        }
        this._pendingChanges.push({
          type: "deleteStore",
          storeName: tableName
        });
      }
      async addField(_model, _fieldName) {
      }
      async removeField(_model, _fieldName) {
      }
      async createIndex(model, fields, options) {
        const tableName = model.getTableName();
        const indexName = options?.name ?? `${tableName}_${fields.join("_")}_idx`;
        this._pendingChanges.push({
          type: "createIndex",
          storeName: tableName,
          indexName,
          fields,
          unique: options?.unique ?? false
        });
      }
      async dropIndex(model, indexName) {
        const tableName = model.getTableName();
        this._pendingChanges.push({
          type: "deleteIndex",
          storeName: tableName,
          indexName
        });
      }
      /**
       * Check if there are pending changes that require a version upgrade
       */
      hasPendingChanges() {
        return this._pendingChanges.length > 0;
      }
    };
    IndexedDBBackend = class extends DatabaseBackend {
      _db = null;
      _version = 0;
      _storeNames = /* @__PURE__ */ new Set();
      constructor(config11) {
        super({
          engine: "indexeddb",
          name: config11.name,
          options: {}
        });
      }
      /**
       * Get the IDBDatabase instance
       */
      get db() {
        if (!this._db) {
          throw new Error("IndexedDB backend is not connected");
        }
        return this._db;
      }
      /**
       * Get the current database version
       */
      get version() {
        return this._version;
      }
      // ============================================================================
      // Connection Management
      // ============================================================================
      async connect() {
        if (this._connected) {
          return;
        }
        const currentVersion = await this._getCurrentVersion();
        this._version = currentVersion || 1;
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(this._config.name, this._version);
          request.onerror = () => {
            reject(request.error);
          };
          request.onsuccess = () => {
            this._db = request.result;
            this._connected = true;
            for (let i = 0; i < this._db.objectStoreNames.length; i++) {
              this._storeNames.add(this._db.objectStoreNames[i]);
            }
            this._version = this._db.version;
            resolve();
          };
          request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("_meta")) {
              db.createObjectStore("_meta", {
                keyPath: "key"
              });
            }
          };
        });
      }
      /**
       * Get the current database version without triggering an upgrade
       */
      async _getCurrentVersion() {
        return new Promise((resolve) => {
          const request = indexedDB.open(this._config.name);
          request.onsuccess = () => {
            const db = request.result;
            const version = db.version;
            db.close();
            resolve(version);
          };
          request.onerror = () => {
            resolve(0);
          };
        });
      }
      async disconnect() {
        if (this._db) {
          this._db.close();
          this._db = null;
        }
        this._connected = false;
        this._storeNames.clear();
      }
      /**
       * Ensure an object store exists, creating it if necessary via version upgrade
       */
      async ensureStore(storeName) {
        if (this._storeNames.has(storeName)) {
          return;
        }
        const newVersion = this._version + 1;
        this._db?.close();
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(this._config.name, newVersion);
          request.onerror = () => {
            reject(request.error);
          };
          request.onsuccess = () => {
            this._db = request.result;
            this._version = newVersion;
            this._storeNames.add(storeName);
            resolve();
          };
          request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
              db.createObjectStore(storeName, {
                keyPath: "id",
                autoIncrement: true
              });
            }
            if (!db.objectStoreNames.contains("_meta")) {
              db.createObjectStore("_meta", {
                keyPath: "key"
              });
            }
          };
        });
      }
      // ============================================================================
      // Query Execution
      // ============================================================================
      async execute(state) {
        this.ensureConnected();
        const instance = new state.model();
        const tableName = instance.getTableName();
        await this.ensureStore(tableName);
        const results = [];
        const records = await this._getAllFromStore(tableName);
        for (const record of records) {
          if (this.matchesFilters(record, state.filters)) {
            results.push(record);
          }
        }
        const sorted = this.sortRecords(results, state.ordering);
        const limited = this.applyLimitOffset(sorted, state.limit, state.offset);
        if (state.selectFields.length > 0) {
          return limited.map((record) => {
            const selected = {};
            for (const field of state.selectFields) {
              selected[field] = record[field];
            }
            return selected;
          });
        }
        return limited;
      }
      async executeRaw(_query, _params) {
        throw new Error("IndexedDB backend does not support raw SQL queries. Use execute() instead.");
      }
      // ============================================================================
      // CRUD Operations
      // ============================================================================
      async insert(instance) {
        this.ensureConnected();
        const tableName = instance.getTableName();
        await this.ensureStore(tableName);
        const data = instance.toDB();
        const hasId = data.id !== null && data.id !== void 0;
        return new Promise((resolve, reject) => {
          const tx = this._db.transaction(tableName, "readwrite");
          const store = tx.objectStore(tableName);
          let request;
          if (hasId) {
            request = store.put(data);
          } else {
            const insertData = {
              ...data
            };
            delete insertData.id;
            request = store.add(insertData);
          }
          request.onsuccess = () => {
            data.id = request.result;
            resolve(data);
          };
          request.onerror = () => {
            reject(request.error);
          };
        });
      }
      async update(instance) {
        this.ensureConnected();
        const tableName = instance.getTableName();
        await this.ensureStore(tableName);
        const data = instance.toDB();
        const id = data.id;
        if (id === null || id === void 0) {
          throw new Error("Cannot update a record without an ID");
        }
        return new Promise((resolve, reject) => {
          const tx = this._db.transaction(tableName, "readwrite");
          const store = tx.objectStore(tableName);
          const request = store.put(data);
          request.onsuccess = () => {
            resolve();
          };
          request.onerror = () => {
            reject(request.error);
          };
        });
      }
      async delete(instance) {
        this.ensureConnected();
        const tableName = instance.getTableName();
        const id = instance.pk;
        if (id === null || id === void 0) {
          throw new Error("Cannot delete a record without an ID");
        }
        if (!this._storeNames.has(tableName)) {
          return;
        }
        return new Promise((resolve, reject) => {
          const tx = this._db.transaction(tableName, "readwrite");
          const store = tx.objectStore(tableName);
          const request = store.delete(id);
          request.onsuccess = () => {
            resolve();
          };
          request.onerror = () => {
            reject(request.error);
          };
        });
      }
      // ============================================================================
      // Bulk Operations
      // ============================================================================
      async bulkInsert(instances) {
        this.ensureConnected();
        if (instances.length === 0) {
          return [];
        }
        const tableName = instances[0].getTableName();
        await this.ensureStore(tableName);
        const results = [];
        return new Promise((resolve, reject) => {
          const tx = this._db.transaction(tableName, "readwrite");
          const store = tx.objectStore(tableName);
          let completed = 0;
          let hasError = false;
          for (const instance of instances) {
            const data = instance.toDB();
            const hasId = data.id !== null && data.id !== void 0;
            let request;
            if (hasId) {
              request = store.put(data);
            } else {
              const insertData = {
                ...data
              };
              delete insertData.id;
              request = store.add(insertData);
            }
            request.onsuccess = () => {
              if (hasError) return;
              data.id = request.result;
              results.push(data);
              completed++;
              if (completed === instances.length) {
                resolve(results);
              }
            };
            request.onerror = () => {
              if (hasError) return;
              hasError = true;
              reject(request.error);
            };
          }
        });
      }
      async bulkUpdate(instances, _fields) {
        this.ensureConnected();
        if (instances.length === 0) {
          return 0;
        }
        const tableName = instances[0].getTableName();
        await this.ensureStore(tableName);
        return new Promise((resolve, reject) => {
          const tx = this._db.transaction(tableName, "readwrite");
          const store = tx.objectStore(tableName);
          let completed = 0;
          let hasError = false;
          for (const instance of instances) {
            const data = instance.toDB();
            const id = data.id;
            if (id === null || id === void 0) {
              continue;
            }
            const request = store.put(data);
            request.onsuccess = () => {
              if (hasError) return;
              completed++;
              if (completed === instances.length) {
                resolve(completed);
              }
            };
            request.onerror = () => {
              if (hasError) return;
              hasError = true;
              reject(request.error);
            };
          }
          if (completed === 0 && instances.length === 0) {
            resolve(0);
          }
        });
      }
      async updateMany(state, values) {
        this.ensureConnected();
        const records = await this.execute(state);
        const instance = new state.model();
        const tableName = instance.getTableName();
        if (records.length === 0) {
          return 0;
        }
        return new Promise((resolve, reject) => {
          const tx = this._db.transaction(tableName, "readwrite");
          const store = tx.objectStore(tableName);
          let completed = 0;
          let hasError = false;
          for (const record of records) {
            const updated = {
              ...record,
              ...values
            };
            const request = store.put(updated);
            request.onsuccess = () => {
              if (hasError) return;
              completed++;
              if (completed === records.length) {
                resolve(completed);
              }
            };
            request.onerror = () => {
              if (hasError) return;
              hasError = true;
              reject(request.error);
            };
          }
        });
      }
      async deleteMany(state) {
        this.ensureConnected();
        const records = await this.execute(state);
        const instance = new state.model();
        const tableName = instance.getTableName();
        if (records.length === 0) {
          return 0;
        }
        return new Promise((resolve, reject) => {
          const tx = this._db.transaction(tableName, "readwrite");
          const store = tx.objectStore(tableName);
          let completed = 0;
          let hasError = false;
          for (const record of records) {
            const request = store.delete(record.id);
            request.onsuccess = () => {
              if (hasError) return;
              completed++;
              if (completed === records.length) {
                resolve(completed);
              }
            };
            request.onerror = () => {
              if (hasError) return;
              hasError = true;
              reject(request.error);
            };
          }
        });
      }
      // ============================================================================
      // Aggregation
      // ============================================================================
      async count(state) {
        this.ensureConnected();
        const instance = new state.model();
        const tableName = instance.getTableName();
        if (!this._storeNames.has(tableName)) {
          return 0;
        }
        const records = await this._getAllFromStore(tableName);
        let count = 0;
        for (const record of records) {
          if (this.matchesFilters(record, state.filters)) {
            count++;
          }
        }
        return count;
      }
      async aggregate(state, aggregations) {
        this.ensureConnected();
        const records = await this.execute(state);
        const results = {};
        for (const [alias, agg] of Object.entries(aggregations)) {
          switch (agg.func) {
            case "COUNT":
              if (agg.distinct && agg.field !== "*") {
                const uniqueValues = new Set(records.map((r) => r[agg.field]).filter((v) => v !== null));
                results[alias] = uniqueValues.size;
              } else if (agg.field === "*") {
                results[alias] = records.length;
              } else {
                results[alias] = records.filter((r) => r[agg.field] !== null).length;
              }
              break;
            case "SUM": {
              const sum = records.reduce((acc, r) => {
                const val = r[agg.field];
                return acc + (typeof val === "number" ? val : 0);
              }, 0);
              results[alias] = sum;
              break;
            }
            case "AVG": {
              const values = records.map((r) => r[agg.field]).filter((v) => typeof v === "number");
              results[alias] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
              break;
            }
            case "MIN": {
              const values = records.map((r) => r[agg.field]).filter((v) => typeof v === "number");
              results[alias] = values.length > 0 ? Math.min(...values) : 0;
              break;
            }
            case "MAX": {
              const values = records.map((r) => r[agg.field]).filter((v) => typeof v === "number");
              results[alias] = values.length > 0 ? Math.max(...values) : 0;
              break;
            }
          }
        }
        return results;
      }
      // ============================================================================
      // Transactions
      // ============================================================================
      async beginTransaction() {
        this.ensureConnected();
        return new IndexedDBTransaction(this._db);
      }
      // ============================================================================
      // Schema Operations
      // ============================================================================
      getSchemaEditor() {
        this.ensureConnected();
        return new IndexedDBSchemaEditor(this._db);
      }
      async tableExists(tableName) {
        this.ensureConnected();
        return this._db.objectStoreNames.contains(tableName);
      }
      // ============================================================================
      // Query Compilation
      // ============================================================================
      compile(state) {
        const instance = new state.model();
        const tableName = instance.getTableName();
        const operation = {
          type: "select",
          table: tableName,
          filters: state.filters,
          ordering: state.ordering,
          fields: state.selectFields,
          limit: state.limit,
          offset: state.offset
        };
        return {
          operation,
          params: []
        };
      }
      // ============================================================================
      // Helper Methods
      // ============================================================================
      /**
       * Get all records from an object store
       */
      async _getAllFromStore(storeName) {
        return new Promise((resolve, reject) => {
          const tx = this._db.transaction(storeName, "readonly");
          const store = tx.objectStore(storeName);
          const request = store.getAll();
          request.onsuccess = () => {
            resolve(request.result);
          };
          request.onerror = () => {
            reject(request.error);
          };
        });
      }
      /**
       * Get a record by ID directly
       */
      async getById(model, id) {
        this.ensureConnected();
        const instance = new model();
        const tableName = instance.getTableName();
        if (!this._storeNames.has(tableName)) {
          return null;
        }
        return new Promise((resolve, reject) => {
          const tx = this._db.transaction(tableName, "readonly");
          const store = tx.objectStore(tableName);
          const request = store.get(id);
          request.onsuccess = () => {
            resolve(request.result ?? null);
          };
          request.onerror = () => {
            reject(request.error);
          };
        });
      }
      /**
       * Check if a record exists by ID
       */
      async existsById(model, id) {
        const record = await this.getById(model, id);
        return record !== null;
      }
      /**
       * Clear all data from a store
       */
      async clearStore(storeName) {
        this.ensureConnected();
        if (!this._storeNames.has(storeName)) {
          return;
        }
        return new Promise((resolve, reject) => {
          const tx = this._db.transaction(storeName, "readwrite");
          const store = tx.objectStore(storeName);
          const request = store.clear();
          request.onsuccess = () => {
            resolve();
          };
          request.onerror = () => {
            reject(request.error);
          };
        });
      }
      /**
       * Delete the entire database
       */
      async deleteDatabase() {
        await this.disconnect();
        return new Promise((resolve, reject) => {
          const request = indexedDB.deleteDatabase(this._config.name);
          request.onsuccess = () => {
            resolve();
          };
          request.onerror = () => {
            reject(request.error);
          };
          request.onblocked = () => {
            reject(new Error("Database deletion blocked - close all connections"));
          };
        });
      }
    };
  }
});

// src/alexi_db/backends/indexeddb/mod.ts
var mod_exports = {};
__export(mod_exports, {
  IndexedDBBackend: () => IndexedDBBackend
});
var init_mod = __esm({
  "src/alexi_db/backends/indexeddb/mod.ts"() {
    init_backend2();
  }
});

// src/alexi_db/backends/denokv/backend.ts
var DenoKVTransaction, DenoKVSchemaEditor, DenoKVBackend;
var init_backend3 = __esm({
  "src/alexi_db/backends/denokv/backend.ts"() {
    init_backend();
    DenoKVTransaction = class {
      _kv;
      _operations = [];
      _active = true;
      constructor(kv) {
        this._kv = kv;
      }
      get isActive() {
        return this._active;
      }
      /**
       * Queue a set operation
       */
      queueSet(key, value) {
        this._operations.push({
          type: "set",
          key,
          value
        });
      }
      /**
       * Queue a delete operation
       */
      queueDelete(key) {
        this._operations.push({
          type: "delete",
          key
        });
      }
      async commit() {
        if (!this._active) {
          throw new Error("Transaction is no longer active");
        }
        const atomic = this._kv.atomic();
        for (const op of this._operations) {
          if (op.type === "set") {
            atomic.set(op.key, op.value);
          } else {
            atomic.delete(op.key);
          }
        }
        const result = await atomic.commit();
        this._active = false;
        if (!result.ok) {
          throw new Error("DenoKV atomic transaction failed");
        }
      }
      async rollback() {
        this._operations = [];
        this._active = false;
      }
    };
    DenoKVSchemaEditor = class {
      _kv;
      constructor(kv) {
        this._kv = kv;
      }
      async createTable(model) {
        const tableName = model.getTableName();
        await this._kv.set([
          "_meta",
          "tables",
          tableName
        ], {
          name: tableName,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      async dropTable(model) {
        const tableName = model.getTableName();
        const iter = this._kv.list({
          prefix: [
            tableName
          ]
        });
        const atomic = this._kv.atomic();
        let count = 0;
        for await (const entry of iter) {
          atomic.delete(entry.key);
          count++;
          if (count >= 100) {
            await atomic.commit();
            count = 0;
          }
        }
        if (count > 0) {
          await atomic.commit();
        }
        await this._kv.delete([
          "_meta",
          "tables",
          tableName
        ]);
      }
      async addField(_model, _fieldName) {
      }
      async removeField(_model, _fieldName) {
      }
      async createIndex(model, fields, options) {
        const tableName = model.getTableName();
        const indexName = options?.name ?? `${tableName}_${fields.join("_")}_idx`;
        await this._kv.set([
          "_meta",
          "indexes",
          tableName,
          indexName
        ], {
          fields,
          unique: options?.unique ?? false,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      async dropIndex(model, indexName) {
        const tableName = model.getTableName();
        await this._kv.delete([
          "_meta",
          "indexes",
          tableName,
          indexName
        ]);
      }
    };
    DenoKVBackend = class extends DatabaseBackend {
      _kv = null;
      _idCounters = /* @__PURE__ */ new Map();
      constructor(config11) {
        super({
          engine: "denokv",
          name: config11.name,
          options: {
            path: config11.path
          }
        });
      }
      /**
       * Get the KV instance
       */
      get kv() {
        if (!this._kv) {
          throw new Error("DenoKV backend is not connected");
        }
        return this._kv;
      }
      // ============================================================================
      // Connection Management
      // ============================================================================
      async connect() {
        if (this._connected) {
          return;
        }
        const path = this._config.options?.path;
        this._kv = await Deno.openKv(path);
        this._connected = true;
      }
      async disconnect() {
        if (this._kv) {
          this._kv.close();
          this._kv = null;
        }
        this._connected = false;
      }
      // ============================================================================
      // Query Execution
      // ============================================================================
      async execute(state) {
        this.ensureConnected();
        const instance = new state.model();
        const tableName = instance.getTableName();
        const results = [];
        const iter = this._kv.list({
          prefix: [
            tableName
          ]
        });
        for await (const entry of iter) {
          const record = entry.value;
          if (this.matchesFilters(record, state.filters)) {
            results.push(record);
          }
        }
        const sorted = this.sortRecords(results, state.ordering);
        const limited = this.applyLimitOffset(sorted, state.limit, state.offset);
        if (state.selectFields.length > 0) {
          return limited.map((record) => {
            const selected = {};
            for (const field of state.selectFields) {
              selected[field] = record[field];
            }
            return selected;
          });
        }
        return limited;
      }
      async executeRaw(_query, _params) {
        throw new Error("DenoKV backend does not support raw SQL queries. Use execute() instead.");
      }
      // ============================================================================
      // CRUD Operations
      // ============================================================================
      async insert(instance) {
        this.ensureConnected();
        const tableName = instance.getTableName();
        const data = instance.toDB();
        if (data.id === null || data.id === void 0) {
          data.id = await this._generateId(tableName);
        }
        const key = [
          tableName,
          data.id
        ];
        await this._kv.set(key, data);
        return data;
      }
      async update(instance) {
        this.ensureConnected();
        const tableName = instance.getTableName();
        const data = instance.toDB();
        const id = data.id;
        if (id === null || id === void 0) {
          throw new Error("Cannot update a record without an ID");
        }
        const key = [
          tableName,
          id
        ];
        await this._kv.set(key, data);
      }
      async delete(instance) {
        this.ensureConnected();
        const tableName = instance.getTableName();
        const id = instance.pk;
        if (id === null || id === void 0) {
          throw new Error("Cannot delete a record without an ID");
        }
        const key = [
          tableName,
          id
        ];
        await this._kv.delete(key);
      }
      // ============================================================================
      // Bulk Operations
      // ============================================================================
      async bulkInsert(instances) {
        this.ensureConnected();
        const results = [];
        const atomic = this._kv.atomic();
        for (const instance of instances) {
          const tableName = instance.getTableName();
          const data = instance.toDB();
          if (data.id === null || data.id === void 0) {
            data.id = await this._generateId(tableName);
          }
          const key = [
            tableName,
            data.id
          ];
          atomic.set(key, data);
          results.push(data);
        }
        const result = await atomic.commit();
        if (!result.ok) {
          throw new Error("DenoKV bulk insert failed");
        }
        return results;
      }
      async bulkUpdate(instances, _fields) {
        this.ensureConnected();
        const atomic = this._kv.atomic();
        for (const instance of instances) {
          const tableName = instance.getTableName();
          const data = instance.toDB();
          const id = data.id;
          if (id !== null && id !== void 0) {
            const key = [
              tableName,
              id
            ];
            atomic.set(key, data);
          }
        }
        const result = await atomic.commit();
        if (!result.ok) {
          throw new Error("DenoKV bulk update failed");
        }
        return instances.length;
      }
      async updateMany(state, values) {
        this.ensureConnected();
        const records = await this.execute(state);
        const instance = new state.model();
        const tableName = instance.getTableName();
        const atomic = this._kv.atomic();
        for (const record of records) {
          const updated = {
            ...record,
            ...values
          };
          const key = [
            tableName,
            record.id
          ];
          atomic.set(key, updated);
        }
        const result = await atomic.commit();
        if (!result.ok) {
          throw new Error("DenoKV updateMany failed");
        }
        return records.length;
      }
      async deleteMany(state) {
        this.ensureConnected();
        const records = await this.execute(state);
        const instance = new state.model();
        const tableName = instance.getTableName();
        const atomic = this._kv.atomic();
        for (const record of records) {
          const key = [
            tableName,
            record.id
          ];
          atomic.delete(key);
        }
        const result = await atomic.commit();
        if (!result.ok) {
          throw new Error("DenoKV deleteMany failed");
        }
        return records.length;
      }
      // ============================================================================
      // Aggregation
      // ============================================================================
      async count(state) {
        this.ensureConnected();
        const instance = new state.model();
        const tableName = instance.getTableName();
        let count = 0;
        const iter = this._kv.list({
          prefix: [
            tableName
          ]
        });
        for await (const entry of iter) {
          if (this.matchesFilters(entry.value, state.filters)) {
            count++;
          }
        }
        return count;
      }
      async aggregate(state, aggregations) {
        this.ensureConnected();
        const records = await this.execute(state);
        const results = {};
        for (const [alias, agg] of Object.entries(aggregations)) {
          switch (agg.func) {
            case "COUNT":
              if (agg.distinct && agg.field !== "*") {
                const uniqueValues = new Set(records.map((r) => r[agg.field]).filter((v) => v !== null));
                results[alias] = uniqueValues.size;
              } else if (agg.field === "*") {
                results[alias] = records.length;
              } else {
                results[alias] = records.filter((r) => r[agg.field] !== null).length;
              }
              break;
            case "SUM": {
              const sum = records.reduce((acc, r) => {
                const val = r[agg.field];
                return acc + (typeof val === "number" ? val : 0);
              }, 0);
              results[alias] = sum;
              break;
            }
            case "AVG": {
              const values = records.map((r) => r[agg.field]).filter((v) => typeof v === "number");
              results[alias] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
              break;
            }
            case "MIN": {
              const values = records.map((r) => r[agg.field]).filter((v) => typeof v === "number");
              results[alias] = values.length > 0 ? Math.min(...values) : 0;
              break;
            }
            case "MAX": {
              const values = records.map((r) => r[agg.field]).filter((v) => typeof v === "number");
              results[alias] = values.length > 0 ? Math.max(...values) : 0;
              break;
            }
          }
        }
        return results;
      }
      // ============================================================================
      // Transactions
      // ============================================================================
      async beginTransaction() {
        this.ensureConnected();
        return new DenoKVTransaction(this._kv);
      }
      // ============================================================================
      // Schema Operations
      // ============================================================================
      getSchemaEditor() {
        this.ensureConnected();
        return new DenoKVSchemaEditor(this._kv);
      }
      async tableExists(tableName) {
        this.ensureConnected();
        const meta = await this._kv.get([
          "_meta",
          "tables",
          tableName
        ]);
        return meta.value !== null;
      }
      // ============================================================================
      // Query Compilation
      // ============================================================================
      compile(state) {
        const instance = new state.model();
        const tableName = instance.getTableName();
        const operation = {
          type: "select",
          table: tableName,
          filters: state.filters,
          ordering: state.ordering,
          fields: state.selectFields,
          limit: state.limit,
          offset: state.offset
        };
        return {
          operation,
          params: []
        };
      }
      // ============================================================================
      // Helper Methods
      // ============================================================================
      /**
       * Generate a unique ID for a table
       */
      async _generateId(tableName) {
        const counterKey = [
          "_meta",
          "counters",
          tableName
        ];
        let newId;
        while (true) {
          const current = await this._kv.get(counterKey);
          newId = (current.value ?? 0) + 1;
          const result = await this._kv.atomic().check(current).set(counterKey, newId).commit();
          if (result.ok) {
            break;
          }
        }
        return newId;
      }
      /**
       * Get a record by ID directly
       */
      async getById(model, id) {
        this.ensureConnected();
        const instance = new model();
        const tableName = instance.getTableName();
        const key = [
          tableName,
          id
        ];
        const entry = await this._kv.get(key);
        return entry.value;
      }
      /**
       * Check if a record exists by ID
       */
      async existsById(model, id) {
        const record = await this.getById(model, id);
        return record !== null;
      }
    };
  }
});

// src/alexi_db/backends/denokv/mod.ts
var mod_exports2 = {};
__export(mod_exports2, {
  DenoKVBackend: () => DenoKVBackend
});
var init_mod2 = __esm({
  "src/alexi_db/backends/denokv/mod.ts"() {
    init_backend3();
  }
});

// src/alexi_db/setup.ts
var _settings = null;
var _backend = null;
var _initialized = false;
async function setup(settings) {
  if (_initialized) {
    if (settings.debug) {
      console.warn("[Alexi] Already initialized, skipping setup");
    }
    return;
  }
  _settings = settings;
  if (settings.debug) {
    console.log("[Alexi] Initializing with settings:", settings);
  }
  if (settings.backend) {
    _backend = settings.backend;
    if (!_backend.isConnected) {
      await _backend.connect();
    }
  } else if (settings.database) {
    _backend = await createBackend(settings.database);
    await _backend.connect();
  } else {
    throw new Error("Alexi ORM setup requires either 'backend' or 'database' configuration.");
  }
  _initialized = true;
  if (settings.debug) {
    console.log("[Alexi] Setup complete, backend connected");
  }
}
async function createBackend(dbSettings) {
  switch (dbSettings.engine) {
    case "indexeddb": {
      const { IndexedDBBackend: IndexedDBBackend2 } = await Promise.resolve().then(() => (init_mod(), mod_exports));
      return new IndexedDBBackend2({
        name: dbSettings.name
      });
    }
    case "denokv": {
      const { DenoKVBackend: DenoKVBackend2 } = await Promise.resolve().then(() => (init_mod2(), mod_exports2));
      return new DenoKVBackend2({
        name: dbSettings.name,
        path: dbSettings.path
      });
    }
    case "memory": {
      const { IndexedDBBackend: IndexedDBBackend2 } = await Promise.resolve().then(() => (init_mod(), mod_exports));
      return new IndexedDBBackend2({
        name: `test-${Date.now()}-${Math.random().toString(36).slice(2)}`
      });
    }
    default:
      throw new Error(`Unknown database engine: ${dbSettings.engine}`);
  }
}
function getBackend() {
  if (!_backend) {
    throw new Error("Alexi ORM is not configured. Call setup() first.");
  }
  return _backend;
}
function isInitialized() {
  return _initialized;
}
function setBackend(backend) {
  if (!_initialized) {
    throw new Error("Alexi ORM is not configured. Call setup() first before setting a new backend.");
  }
  _backend = backend;
}

// src/alexi_db/query/q.ts
var Q = class _Q {
  _conditions;
  _connector;
  _negated;
  _children;
  constructor(conditions = {}) {
    this._conditions = conditions;
    this._connector = "AND";
    this._negated = false;
    this._children = [];
  }
  /**
   * Get the filter conditions
   */
  get conditions() {
    return this._conditions;
  }
  /**
   * Get the connector type
   */
  get connector() {
    return this._connector;
  }
  /**
   * Check if this Q is negated
   */
  get negated() {
    return this._negated;
  }
  /**
   * Get child Q objects
   */
  get children() {
    return this._children;
  }
  /**
   * Check if this Q has children
   */
  get hasChildren() {
    return this._children.length > 0;
  }
  /**
   * Check if this Q has conditions
   */
  get hasConditions() {
    return Object.keys(this._conditions).length > 0;
  }
  /**
   * Check if this Q is empty (no conditions and no children)
   */
  get isEmpty() {
    return !this.hasConditions && !this.hasChildren;
  }
  /**
   * Combine with another Q using AND
   *
   * @example
   * ```ts
   * const q = new Q({ status: 'active' }).and(new Q({ verified: true }));
   * ```
   */
  and(other) {
    const combined = new _Q();
    combined._connector = "AND";
    combined._children = [
      this._clone(),
      other._clone()
    ];
    return combined;
  }
  /**
   * Combine with another Q using OR
   *
   * @example
   * ```ts
   * const q = new Q({ status: 'draft' }).or(new Q({ status: 'pending' }));
   * ```
   */
  or(other) {
    const combined = new _Q();
    combined._connector = "OR";
    combined._children = [
      this._clone(),
      other._clone()
    ];
    return combined;
  }
  /**
   * Negate this Q object
   *
   * @example
   * ```ts
   * const notDraft = new Q({ status: 'draft' }).not();
   * ```
   */
  not() {
    const negated = this._clone();
    negated._negated = !this._negated;
    return negated;
  }
  /**
   * Clone this Q object
   */
  _clone() {
    const cloned = new _Q({
      ...this._conditions
    });
    cloned._connector = this._connector;
    cloned._negated = this._negated;
    cloned._children = this._children.map((child) => child._clone());
    return cloned;
  }
  /**
   * Convert this Q object to parsed filters
   */
  toParsedFilters() {
    const filters = [];
    for (const [key, value] of Object.entries(this._conditions)) {
      const parsed = this._parseCondition(key, value);
      if (this._negated) {
        parsed.negated = !parsed.negated;
      }
      filters.push(parsed);
    }
    return filters;
  }
  /**
   * Parse a single condition key into field and lookup
   */
  _parseCondition(key, value) {
    const parts = key.split("__");
    let field;
    let lookup = "exact";
    if (parts.length === 1) {
      field = parts[0];
    } else {
      const possibleLookup = parts[parts.length - 1];
      if (this._isValidLookup(possibleLookup)) {
        lookup = possibleLookup;
        field = parts.slice(0, -1).join("__");
      } else {
        field = key;
        lookup = "exact";
      }
    }
    return {
      field,
      lookup,
      value,
      negated: false
    };
  }
  /**
   * Check if a string is a valid lookup type
   */
  _isValidLookup(lookup) {
    const validLookups = [
      "exact",
      "iexact",
      "contains",
      "icontains",
      "startswith",
      "istartswith",
      "endswith",
      "iendswith",
      "in",
      "gt",
      "gte",
      "lt",
      "lte",
      "range",
      "isnull",
      "regex",
      "iregex",
      "date",
      "year",
      "month",
      "day",
      "week",
      "weekday"
    ];
    return validLookups.includes(lookup);
  }
  /**
   * Recursively resolve this Q object and its children into a tree structure
   * for query compilation
   */
  resolve() {
    return {
      conditions: this.toParsedFilters(),
      connector: this._connector,
      negated: this._negated,
      children: this._children.map((child) => child.resolve())
    };
  }
  /**
   * String representation for debugging
   */
  toString() {
    const parts = [];
    if (this._negated) {
      parts.push("NOT");
    }
    if (this.hasConditions) {
      const condStr = Object.entries(this._conditions).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ");
      parts.push(`(${condStr})`);
    }
    if (this.hasChildren) {
      const childrenStr = this._children.map((child) => child.toString()).join(` ${this._connector} `);
      parts.push(`(${childrenStr})`);
    }
    return parts.join(" ") || "(empty)";
  }
};

// src/alexi_db/query/types.ts
function createQueryState(model) {
  return {
    model,
    filters: [],
    ordering: [],
    selectFields: [],
    deferFields: [],
    selectRelated: [],
    prefetchRelated: [],
    annotations: {},
    distinctFields: [],
    limit: null,
    offset: null,
    reversed: false
  };
}
function cloneQueryState(state) {
  return {
    model: state.model,
    filters: [
      ...state.filters
    ],
    ordering: [
      ...state.ordering
    ],
    selectFields: [
      ...state.selectFields
    ],
    deferFields: [
      ...state.deferFields
    ],
    selectRelated: [
      ...state.selectRelated
    ],
    prefetchRelated: [
      ...state.prefetchRelated
    ],
    annotations: {
      ...state.annotations
    },
    distinctFields: [
      ...state.distinctFields
    ],
    limit: state.limit,
    offset: state.offset,
    reversed: state.reversed
  };
}

// src/alexi_db/query/queryset.ts
var _computedKey;
var _computedKey1;
var _computedKey2;
_computedKey = Symbol.asyncIterator;
var QuerySet = class _QuerySet {
  _state;
  _backend;
  _cache = null;
  constructor(model, backend) {
    this._state = createQueryState(model);
    this._backend = backend;
  }
  /**
   * Create a QuerySet from an existing state
   */
  static _fromState(state, backend) {
    const qs = new _QuerySet(state.model, backend);
    qs._state = state;
    return qs;
  }
  /**
   * Clone this QuerySet with a modified state
   */
  _clone(modifier) {
    const newState = cloneQueryState(this._state);
    if (modifier) {
      modifier(newState);
    }
    return _QuerySet._fromState(newState, this._backend);
  }
  /**
   * Get the query state (for backend use)
   */
  get state() {
    return this._state;
  }
  /**
   * Get the model class
   */
  get model() {
    return this._state.model;
  }
  /**
   * Get the backend
   */
  get backend() {
    return this._backend;
  }
  // ============================================================================
  // Filter Methods
  // ============================================================================
  /**
   * Filter the QuerySet by the given conditions
   *
   * @example
   * ```ts
   * qs.filter({ name: 'John' })
   * qs.filter({ age__gte: 18 })
   * qs.filter({ author__name__contains: 'Smith' })
   * ```
   */
  filter(conditions) {
    return this._clone((state) => {
      const filters = this._parseConditions(conditions);
      state.filters.push(...filters);
    });
  }
  /**
   * Exclude objects matching the given conditions
   *
   * @example
   * ```ts
   * qs.exclude({ status: 'draft' })
   * ```
   */
  exclude(conditions) {
    return this._clone((state) => {
      const filters = this._parseConditions(conditions);
      for (const filter of filters) {
        filter.negated = true;
      }
      state.filters.push(...filters);
    });
  }
  /**
   * Parse filter conditions into ParsedFilter objects
   */
  _parseConditions(conditions) {
    if (conditions instanceof Q) {
      return conditions.toParsedFilters();
    }
    const filters = [];
    for (const [key, value] of Object.entries(conditions)) {
      const parsed = this._parseConditionKey(key, value);
      filters.push(parsed);
    }
    return filters;
  }
  /**
   * Parse a condition key into field and lookup
   */
  _parseConditionKey(key, value) {
    const parts = key.split("__");
    let field;
    let lookup = "exact";
    if (parts.length === 1) {
      field = parts[0];
    } else {
      const possibleLookup = parts[parts.length - 1];
      if (this._isValidLookup(possibleLookup)) {
        lookup = possibleLookup;
        field = parts.slice(0, -1).join("__");
      } else {
        field = key;
        lookup = "exact";
      }
    }
    return {
      field,
      lookup,
      value,
      negated: false
    };
  }
  /**
   * Check if a string is a valid lookup type
   */
  _isValidLookup(lookup) {
    const validLookups = [
      "exact",
      "iexact",
      "contains",
      "icontains",
      "startswith",
      "istartswith",
      "endswith",
      "iendswith",
      "in",
      "gt",
      "gte",
      "lt",
      "lte",
      "range",
      "isnull",
      "regex",
      "iregex",
      "date",
      "year",
      "month",
      "day",
      "week",
      "weekday"
    ];
    return validLookups.includes(lookup);
  }
  // ============================================================================
  // Ordering Methods
  // ============================================================================
  /**
   * Order the QuerySet by the given fields
   *
   * @example
   * ```ts
   * qs.orderBy('name')           // ascending
   * qs.orderBy('-createdAt')     // descending
   * qs.orderBy('-createdAt', 'name')  // multiple fields
   * ```
   */
  orderBy(...fields) {
    return this._clone((state) => {
      state.ordering = fields.map((field) => this._parseOrdering(field));
    });
  }
  /**
   * Parse an ordering field string
   */
  _parseOrdering(field) {
    if (field.startsWith("-")) {
      return {
        field: field.slice(1),
        direction: "DESC"
      };
    }
    return {
      field,
      direction: "ASC"
    };
  }
  /**
   * Reverse the ordering of the QuerySet
   */
  reverse() {
    return this._clone((state) => {
      state.reversed = !state.reversed;
      state.ordering = state.ordering.map((o) => ({
        field: o.field,
        direction: o.direction === "ASC" ? "DESC" : "ASC"
      }));
    });
  }
  // ============================================================================
  // Limiting Methods
  // ============================================================================
  /**
   * Limit the number of results
   */
  limit(count) {
    return this._clone((state) => {
      state.limit = count;
    });
  }
  /**
   * Skip the first N results
   */
  offset(count) {
    return this._clone((state) => {
      state.offset = count;
    });
  }
  /**
   * Python-style slicing
   *
   * @example
   * ```ts
   * qs.slice(10, 20)  // skip 10, take 10
   * qs.slice(5)       // skip 5, take all remaining
   * ```
   */
  slice(start, end) {
    return this._clone((state) => {
      state.offset = start;
      if (end !== void 0) {
        state.limit = end - start;
      }
    });
  }
  // ============================================================================
  // Field Selection Methods
  // ============================================================================
  /**
   * Only load the specified fields
   */
  only(...fields) {
    return this._clone((state) => {
      state.selectFields = fields;
    });
  }
  /**
   * Defer loading of the specified fields
   */
  defer(...fields) {
    return this._clone((state) => {
      state.deferFields = fields;
    });
  }
  /**
   * Return only distinct results
   *
   * @example
   * ```ts
   * qs.distinct()              // all fields
   * qs.distinct('category')    // distinct on specific field
   * ```
   */
  distinct(...fields) {
    return this._clone((state) => {
      state.distinctFields = fields;
    });
  }
  // ============================================================================
  // Related Object Methods
  // ============================================================================
  /**
   * Eagerly load related objects (JOIN)
   *
   * Use for ForeignKey relationships where you want to load
   * the related object in the same query.
   *
   * @example
   * ```ts
   * Article.objects.selectRelated('author', 'category')
   * ```
   */
  selectRelated(...relations) {
    return this._clone((state) => {
      state.selectRelated.push(...relations);
    });
  }
  /**
   * Prefetch related objects (separate queries)
   *
   * Use for ManyToMany or reverse ForeignKey relationships.
   *
   * @example
   * ```ts
   * Article.objects.prefetchRelated('tags', 'comments')
   * ```
   */
  prefetchRelated(...relations) {
    return this._clone((state) => {
      state.prefetchRelated.push(...relations);
    });
  }
  // ============================================================================
  // Aggregation Methods
  // ============================================================================
  /**
   * Add computed annotations to each result
   *
   * @example
   * ```ts
   * Article.objects.annotate({
   *   commentCount: Count('comments'),
   *   avgRating: Avg('ratings__value'),
   * })
   * ```
   */
  annotate(annotations) {
    return this._clone((state) => {
      state.annotations = {
        ...state.annotations,
        ...annotations
      };
    });
  }
  /**
   * Return aggregate values
   *
   * @example
   * ```ts
   * const stats = await Article.objects.aggregate({
   *   total: Count('*'),
   *   avgViews: Avg('views'),
   * });
   * // { total: 100, avgViews: 1500 }
   * ```
   */
  async aggregate(aggregations) {
    const backend = this._getBackend();
    return backend.aggregate(this._state, aggregations);
  }
  /**
   * Return the count of objects
   */
  async count() {
    const backend = this._getBackend();
    return backend.count(this._state);
  }
  // ============================================================================
  // Values Methods
  // ============================================================================
  /**
   * Return plain objects instead of model instances
   *
   * @example
   * ```ts
   * const values = await Article.objects.values('id', 'title').fetch();
   * // [{ id: 1, title: 'Hello' }, { id: 2, title: 'World' }]
   * ```
   */
  values(...fields) {
    return new ValuesQuerySet(this._state, this._backend, fields);
  }
  /**
   * Return arrays of values instead of model instances
   *
   * @example
   * ```ts
   * const values = await Article.objects.valuesList('id', 'title').fetch();
   * // [[1, 'Hello'], [2, 'World']]
   * ```
   */
  valuesList(...fields) {
    return new ValuesListQuerySet(this._state, this._backend, fields);
  }
  // ============================================================================
  // Terminal Methods (execute the query)
  // ============================================================================
  /**
   * Execute the query and return all results
   */
  async fetch() {
    if (this._cache !== null) {
      return this._cache;
    }
    const backend = this._getBackend();
    const results = await backend.execute(this._state);
    const instances = results.map((data) => this._hydrate(data));
    this._cache = instances;
    return instances;
  }
  /**
   * Get a single object matching the conditions
   *
   * @throws DoesNotExist if no object matches
   * @throws MultipleObjectsReturned if more than one object matches
   */
  async get(conditions) {
    let qs = this;
    if (conditions) {
      qs = qs.filter(conditions);
    }
    const results = await qs.limit(2).fetch();
    if (results.length === 0) {
      throw new DoesNotExist(`${this._state.model.name} matching query does not exist.`);
    }
    if (results.length > 1) {
      throw new MultipleObjectsReturned(`get() returned more than one ${this._state.model.name}.`);
    }
    return results[0];
  }
  /**
   * Get the first object, or null if empty
   */
  async first() {
    const results = await this.limit(1).fetch();
    return results[0] ?? null;
  }
  /**
   * Get the last object, or null if empty
   */
  async last() {
    const results = await this.reverse().limit(1).fetch();
    return results[0] ?? null;
  }
  /**
   * Check if any objects exist
   */
  async exists() {
    const count = await this.limit(1).count();
    return count > 0;
  }
  // ============================================================================
  // Modification Methods
  // ============================================================================
  /**
   * Update all objects matching the query
   *
   * @returns Number of objects updated
   *
   * @example
   * ```ts
   * const count = await Article.objects
   *   .filter({ status: 'draft' })
   *   .update({ status: 'published' });
   * ```
   */
  async update(values) {
    const backend = this._getBackend();
    return backend.updateMany(this._state, values);
  }
  /**
   * Delete all objects matching the query
   *
   * @returns Number of objects deleted
   *
   * @example
   * ```ts
   * const count = await Article.objects
   *   .filter({ status: 'trash' })
   *   .delete();
   * ```
   */
  async delete() {
    const backend = this._getBackend();
    return backend.deleteMany(this._state);
  }
  // ============================================================================
  // Async Iterator
  // ============================================================================
  /**
   * Async iterator for streaming results
   *
   * @example
   * ```ts
   * for await (const article of Article.objects.all()) {
   *   console.log(article.title);
   * }
   * ```
   */
  async *[_computedKey]() {
    const results = await this.fetch();
    for (const item of results) {
      yield item;
    }
  }
  // ============================================================================
  // Private Helpers
  // ============================================================================
  /**
   * Get the backend, throwing if not configured
   *
   * Falls back to the global backend from setup() if no local backend is configured.
   */
  _getBackend() {
    if (this._backend) {
      return this._backend;
    }
    if (isInitialized()) {
      return getBackend();
    }
    throw new Error(`No database backend configured for ${this._state.model.name}. Use .using(backend) or call setup() to configure a default backend.`);
  }
  /**
   * Hydrate database data into a model instance
   */
  _hydrate(data) {
    const instance = new this._state.model();
    instance.fromDB(data);
    instance._backend = this._backend;
    return instance;
  }
  // ============================================================================
  // Utility Methods
  // ============================================================================
  /**
   * Create a copy of this QuerySet using a different backend
   */
  using(backend) {
    const qs = this._clone();
    qs._backend = backend;
    return qs;
  }
  /**
   * Clear the result cache
   */
  clearCache() {
    this._cache = null;
  }
  /**
   * String representation for debugging
   */
  toString() {
    const parts = [
      `QuerySet<${this._state.model.name}>`
    ];
    if (this._state.filters.length > 0) {
      parts.push(`filters: ${this._state.filters.length}`);
    }
    if (this._state.ordering.length > 0) {
      parts.push(`ordering: ${this._state.ordering.map((o) => (o.direction === "DESC" ? "-" : "") + o.field).join(", ")}`);
    }
    if (this._state.limit !== null) {
      parts.push(`limit: ${this._state.limit}`);
    }
    if (this._state.offset !== null) {
      parts.push(`offset: ${this._state.offset}`);
    }
    return parts.join(" | ");
  }
};
_computedKey1 = Symbol.asyncIterator;
var ValuesQuerySet = class {
  _state;
  _backend;
  _fields;
  constructor(state, backend, fields) {
    this._state = cloneQueryState(state);
    this._state.selectFields = fields;
    this._backend = backend;
    this._fields = fields;
  }
  /**
   * Execute the query and return results
   */
  async fetch() {
    if (!this._backend) {
      throw new Error("No database backend configured.");
    }
    const results = await this._backend.execute(this._state);
    return results.map((row) => {
      const obj = {};
      for (const field of this._fields) {
        obj[field] = row[field];
      }
      return obj;
    });
  }
  async *[_computedKey1]() {
    const results = await this.fetch();
    for (const item of results) {
      yield item;
    }
  }
};
_computedKey2 = Symbol.asyncIterator;
var ValuesListQuerySet = class {
  _state;
  _backend;
  _fields;
  constructor(state, backend, fields) {
    this._state = cloneQueryState(state);
    this._state.selectFields = fields;
    this._backend = backend;
    this._fields = fields;
  }
  /**
   * Execute the query and return results
   */
  async fetch() {
    if (!this._backend) {
      throw new Error("No database backend configured.");
    }
    const results = await this._backend.execute(this._state);
    return results.map((row) => {
      return this._fields.map((field) => row[field]);
    });
  }
  /**
   * If only one field, return flat array
   */
  async flat() {
    if (this._fields.length !== 1) {
      throw new Error("flat() can only be used with a single field");
    }
    const results = await this.fetch();
    return results.map((row) => row[0]);
  }
  async *[_computedKey2]() {
    const results = await this.fetch();
    for (const item of results) {
      yield item;
    }
  }
};

// src/alexi_db/models/manager.ts
var DoesNotExist = class extends Error {
  constructor(message) {
    super(message);
    this.name = "DoesNotExist";
  }
};
var MultipleObjectsReturned = class extends Error {
  constructor(message) {
    super(message);
    this.name = "MultipleObjectsReturned";
  }
};

// src/alexi_db/mod.ts
init_backend();

// src/comachine/src/backends/rest_backend.ts
var TOKEN_STORAGE_KEY = "comachine_sync_tokens";
var MODEL_ENDPOINT_MAP = {
  UserModel: "users",
  UnitModel: "units",
  AssetModel: "assets",
  LabelModel: "labels",
  TaskModel: "tasks",
  TicketModel: "tickets",
  TicketMessageModel: "ticket-messages",
  TicketAttachmentModel: "ticket-attachments",
  ServiceModel: "services",
  ProductModel: "products",
  ProductDocumentModel: "product-documents"
};
function getEndpointForModel(modelOrName) {
  if (typeof modelOrName !== "string") {
    const modelClass = modelOrName.constructor;
    if (modelClass.meta?.dbTable) {
      return modelClass.meta.dbTable;
    }
    const name = modelClass.name;
    return MODEL_ENDPOINT_MAP[name] || name.toLowerCase().replace("model", "s");
  }
  return MODEL_ENDPOINT_MAP[modelOrName] || modelOrName.toLowerCase().replace("model", "s");
}
var RestBackend = class extends DatabaseBackend {
  _apiUrl;
  _debug;
  _tokens = null;
  _refreshPromise = null;
  constructor(config11) {
    super({
      engine: "rest",
      name: "comachine-api",
      options: config11
    });
    this._apiUrl = config11.apiUrl.replace(/\/$/, "");
    this._debug = config11.debug ?? false;
    this._loadTokens();
  }
  // ===========================================================================
  // Configuration
  // ===========================================================================
  /**
   * Get the API base URL
   */
  get apiUrl() {
    return this._apiUrl;
  }
  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    if (this._tokens === null) {
      this._log("Tokens null, reloading from storage...");
      this._loadTokens();
    }
    const authenticated = this._tokens !== null;
    this._log(`isAuthenticated: ${authenticated}`);
    return authenticated;
  }
  /**
   * Reload tokens from storage
   */
  reloadTokens() {
    this._loadTokens();
  }
  // ===========================================================================
  // Token Management
  // ===========================================================================
  /**
   * Load tokens from storage
   */
  _loadTokens() {
    if (typeof localStorage === "undefined") {
      this._log("localStorage undefined, cannot load tokens");
      return;
    }
    try {
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
      this._log(`Loading tokens from storage: ${stored ? "found" : "not found"}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        this._tokens = {
          ...parsed,
          expiresAt: new Date(parsed.expiresAt)
        };
        this._log(`Tokens loaded, expires: ${this._tokens.expiresAt}`);
      } else {
        this._log("No tokens in localStorage");
      }
    } catch (error) {
      this._log("Failed to load tokens from storage:", error);
      this._tokens = null;
    }
  }
  /**
   * Save tokens to storage
   */
  _saveTokens(tokens) {
    this._tokens = tokens;
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
    } catch (error) {
      this._log("Failed to save tokens to storage:", error);
    }
  }
  /**
   * Clear tokens from storage
   */
  _clearTokens() {
    this._tokens = null;
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (error) {
      this._log("Failed to clear tokens from storage:", error);
    }
  }
  /**
   * Check if access token is expired or about to expire
   */
  _isTokenExpired() {
    if (!this._tokens) return true;
    const bufferMs = 60 * 1e3;
    return this._tokens.expiresAt.getTime() - Date.now() < bufferMs;
  }
  /**
   * Refresh the access token
   */
  async _refreshAccessToken() {
    if (!this._tokens?.refreshToken) {
      return null;
    }
    if (this._refreshPromise) {
      return this._refreshPromise;
    }
    this._refreshPromise = this._doRefreshToken();
    try {
      return await this._refreshPromise;
    } finally {
      this._refreshPromise = null;
    }
  }
  /**
   * Perform the token refresh
   */
  async _doRefreshToken() {
    try {
      const response = await fetch(`${this._apiUrl}/auth/refresh/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          refreshToken: this._tokens.refreshToken
        })
      });
      if (!response.ok) {
        this._log("Token refresh failed:", response.status);
        this._clearTokens();
        return null;
      }
      const data = await response.json();
      const newTokens = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: new Date(Date.now() + data.expiresIn * 1e3)
      };
      this._saveTokens(newTokens);
      return newTokens;
    } catch (error) {
      this._log("Token refresh error:", error);
      return null;
    }
  }
  /**
   * Get authorization headers
   */
  async _getAuthHeaders() {
    if (!this._tokens) {
      return {};
    }
    if (this._isTokenExpired()) {
      const refreshed = await this._refreshAccessToken();
      if (!refreshed) {
        return {};
      }
    }
    return {
      Authorization: `Bearer ${this._tokens.accessToken}`
    };
  }
  // ===========================================================================
  // HTTP Request Helper
  // ===========================================================================
  /**
   * Make an authenticated HTTP request
   */
  async _request(endpoint, options = {}) {
    const authHeaders = await this._getAuthHeaders();
    const response = await fetch(`${this._apiUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...options.headers
      }
    });
    if (!response.ok) {
      const errorBody = await response.text();
      this._log(`API error ${response.status}:`, errorBody);
      throw new RestApiError({
        status: response.status,
        message: `API request failed: ${response.statusText}`,
        body: errorBody
      });
    }
    const text = await response.text();
    if (!text) {
      return {};
    }
    return JSON.parse(text);
  }
  // ===========================================================================
  // Authentication Methods
  // ===========================================================================
  /**
   * Login with credentials
   */
  async login(credentials) {
    this._log("Logging in:", credentials.email);
    const response = await fetch(`${this._apiUrl}/auth/login/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(credentials)
    });
    if (!response.ok) {
      const errorBody = await response.text();
      this._log("Login failed:", errorBody);
      throw new RestApiError({
        status: response.status,
        message: "Login failed",
        body: errorBody
      });
    }
    const data = await response.json();
    const tokens = {
      accessToken: data.tokens.accessToken,
      refreshToken: data.tokens.refreshToken,
      expiresAt: new Date(Date.now() + data.tokens.expiresIn * 1e3)
    };
    this._saveTokens(tokens);
    this._log("Login successful");
    return data;
  }
  /**
   * Register a new user
   */
  async register(data) {
    this._log("Registering:", data.email);
    const response = await fetch(`${this._apiUrl}/auth/register/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName
      })
    });
    if (!response.ok) {
      const errorBody = await response.text();
      this._log("Registration failed:", errorBody);
      throw new RestApiError({
        status: response.status,
        message: "Registration failed",
        body: errorBody
      });
    }
    const responseData = await response.json();
    const tokens = {
      accessToken: responseData.tokens.accessToken,
      refreshToken: responseData.tokens.refreshToken,
      expiresAt: new Date(Date.now() + responseData.tokens.expiresIn * 1e3)
    };
    this._saveTokens(tokens);
    this._log("Registration successful");
    return responseData;
  }
  /**
   * Logout current user
   */
  async logout() {
    this._log("Logging out");
    if (this._tokens) {
      try {
        await fetch(`${this._apiUrl}/auth/logout/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this._tokens.accessToken}`
          }
        });
      } catch (error) {
        this._log("Logout request failed (ignored):", error);
      }
    }
    this._clearTokens();
    this._log("Logged out");
  }
  /**
   * Get current user profile
   */
  async getMe() {
    return this._request("/auth/me/");
  }
  // ===========================================================================
  // Connection Management
  // ===========================================================================
  async connect() {
    this._connected = true;
    this._log("Connected");
  }
  async disconnect() {
    this._connected = false;
    this._log("Disconnected");
  }
  // ===========================================================================
  // Query Execution
  // ===========================================================================
  /**
   * Execute a query against the REST API
   */
  async execute(state) {
    const modelClass = state.model;
    const endpoint = modelClass.meta?.dbTable || getEndpointForModel(modelClass.name);
    const params = new URLSearchParams();
    for (const filter of state.filters) {
      const paramName = filter.lookup === "exact" ? filter.field : `${filter.field}__${filter.lookup}`;
      params.set(paramName, String(filter.value));
    }
    if (state.ordering.length > 0) {
      const orderingStr = state.ordering.map((o) => o.direction === "DESC" ? `-${o.field}` : o.field).join(",");
      params.set("ordering", orderingStr);
    }
    if (state.limit !== null) {
      params.set("limit", String(state.limit));
    }
    if (state.offset !== null) {
      params.set("offset", String(state.offset));
    }
    const queryString = params.toString();
    const url = `/${endpoint}/${queryString ? `?${queryString}` : ""}`;
    const results = await this._request(url);
    return results;
  }
  async executeRaw(_query, _params) {
    throw new Error("executeRaw is not supported by RestBackend");
  }
  // ===========================================================================
  // CRUD Operations
  // ===========================================================================
  /**
   * Insert a new record via POST
   */
  async insert(instance) {
    const endpoint = getEndpointForModel(instance);
    const data = this._extractData(instance);
    this._log(`POST /${endpoint}/`, data);
    const result = await this._request(`/${endpoint}/`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return result;
  }
  /**
   * Update an existing record via PUT/PATCH
   */
  async update(instance) {
    const endpoint = getEndpointForModel(instance);
    const id = this._getRecordId(instance);
    const data = this._extractData(instance);
    this._log(`PUT /${endpoint}/${id}/`, data);
    await this._request(`/${endpoint}/${id}/`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  }
  /**
   * Delete a record via DELETE
   */
  async delete(instance) {
    const endpoint = getEndpointForModel(instance);
    const id = this._getRecordId(instance);
    this._log(`DELETE /${endpoint}/${id}/`);
    await this._request(`/${endpoint}/${id}/`, {
      method: "DELETE"
    });
  }
  // ===========================================================================
  // Bulk Operations
  // ===========================================================================
  async bulkInsert(instances) {
    const results = [];
    for (const instance of instances) {
      const result = await this.insert(instance);
      results.push(result);
    }
    return results;
  }
  async bulkUpdate(instances, _fields) {
    for (const instance of instances) {
      await this.update(instance);
    }
    return instances.length;
  }
  async updateMany(_state, _values) {
    throw new Error("updateMany is not supported by RestBackend");
  }
  async deleteMany(_state) {
    throw new Error("deleteMany is not supported by RestBackend");
  }
  // ===========================================================================
  // Aggregation
  // ===========================================================================
  async count(state) {
    const modelName = state.model.name;
    const endpoint = getEndpointForModel(modelName);
    try {
      const result = await this._request(`/${endpoint}/count/`);
      return result.count;
    } catch {
      const results = await this.execute(state);
      return results.length;
    }
  }
  async aggregate(_state, _aggregations) {
    throw new Error("aggregate is not supported by RestBackend");
  }
  // ===========================================================================
  // Transactions (Not supported)
  // ===========================================================================
  async beginTransaction() {
    throw new Error("Transactions are not supported by RestBackend");
  }
  // ===========================================================================
  // Schema Operations (Not supported)
  // ===========================================================================
  getSchemaEditor() {
    throw new Error("Schema operations are not supported by RestBackend");
  }
  async tableExists(_tableName) {
    return true;
  }
  // ===========================================================================
  // Query Compilation
  // ===========================================================================
  compile(state) {
    const modelName = state.model.name;
    const endpoint = getEndpointForModel(modelName);
    return {
      operation: {
        type: "select",
        table: endpoint,
        filters: state.filters,
        ordering: state.ordering,
        fields: state.selectedFields,
        limit: state.limit,
        offset: state.offset
      },
      params: []
    };
  }
  // ===========================================================================
  // Helper Methods
  // ===========================================================================
  /**
   * Get the primary key value from a model instance
   */
  _getRecordId(instance) {
    const fields = instance;
    if (fields.id && typeof fields.id.get === "function") {
      return fields.id.get();
    }
    if (fields.pk && typeof fields.pk.get === "function") {
      return fields.pk.get();
    }
    throw new Error("Unable to determine record ID");
  }
  /**
   * Extract data from a model instance
   * Excludes null values to avoid API validation errors for optional fields
   */
  _extractData(instance) {
    const data = {};
    const fields = instance;
    for (const key of Object.keys(fields)) {
      const field = fields[key];
      if (field && typeof field === "object" && typeof field.get === "function") {
        if (key === "objects" || key === "meta") continue;
        try {
          const value = field.get();
          if (value !== null) {
            data[key] = value;
          }
        } catch {
        }
      }
    }
    return data;
  }
  /**
   * Log message if debug mode is enabled
   */
  _log(...args) {
    if (this._debug) {
      console.log("[RestBackend]", ...args);
    }
  }
};
var RestApiError = class extends Error {
  status;
  body;
  constructor(data) {
    super(data.message);
    this.name = "RestApiError";
    this.status = data.status;
    this.body = data.body;
  }
  isAuthError() {
    return this.status === 401 || this.status === 403;
  }
  isNotFound() {
    return this.status === 404;
  }
  isServerError() {
    return this.status >= 500;
  }
  isRetryable() {
    return this.isServerError() || this.status === 429;
  }
};

// src/comachine/src/backends/sync_backend.ts
var SyncBackend = class extends DatabaseBackend {
  _localBackend;
  _restBackend;
  _debug;
  _failSilently;
  constructor(localBackend, restBackend, config11 = {}) {
    super({
      engine: "sync",
      name: localBackend.config.name
    });
    this._localBackend = localBackend;
    this._restBackend = restBackend;
    this._debug = config11.debug ?? false;
    this._failSilently = config11.failSilently ?? true;
  }
  // ===========================================================================
  // Accessors
  // ===========================================================================
  /**
   * Get the local backend (IndexedDB)
   */
  get localBackend() {
    return this._localBackend;
  }
  /**
   * Get the REST backend
   */
  get restBackend() {
    return this._restBackend;
  }
  /**
   * Check if user is authenticated for remote operations
   */
  isAuthenticated() {
    return this._restBackend.isAuthenticated();
  }
  // ===========================================================================
  // Connection Management
  // ===========================================================================
  async connect() {
    await this._localBackend.connect();
    await this._restBackend.connect();
    this._connected = true;
    this._log("Connected (local + remote)");
  }
  async disconnect() {
    await this._localBackend.disconnect();
    await this._restBackend.disconnect();
    this._connected = false;
    this._log("Disconnected");
  }
  // ===========================================================================
  // Query Execution
  // ===========================================================================
  /**
   * Execute a query
   *
   * Strategy:
   * - If authenticated: fetch from REST API and cache to local
   * - If not authenticated or offline: read from local
   */
  async execute(state) {
    if (this._restBackend.isAuthenticated()) {
      try {
        const remoteResults = await this._restBackend.execute(state);
        this._log(`Fetched ${remoteResults.length} records from API`);
        return remoteResults;
      } catch (error) {
        this._log("Remote execute failed, falling back to local:", error);
        if (error instanceof RestApiError && error.isAuthError()) {
          throw error;
        }
        if (!this._failSilently && !(error instanceof RestApiError)) {
          throw error;
        }
      }
    }
    return this._localBackend.execute(state);
  }
  async executeRaw(query, params) {
    return this._localBackend.executeRaw(query, params);
  }
  // ===========================================================================
  // CRUD Operations
  // ===========================================================================
  /**
   * Insert a new record
   *
   * Strategy:
   * 1. Insert into local DB first (get local ID)
   * 2. POST to REST API
   * 3. Update local record with server response (reconcile IDs, etc.)
   */
  async insert(instance) {
    const localResult = await this._localBackend.insert(instance);
    const localId = String(localResult.id);
    this._log(`Inserted locally: ${instance.constructor.name}/${localId}`);
    const isAuth = this._restBackend.isAuthenticated();
    this._log(`Checking authentication for remote sync: ${isAuth}`);
    if (isAuth) {
      try {
        const remoteResult = await this._restBackend.insert(instance);
        const remoteId = String(remoteResult.id);
        this._log(`Synced to remote: ${instance.constructor.name}/${remoteId}`);
        if (localId !== remoteId || this._hasNewData(localResult, remoteResult)) {
          await this._reconcileRecord(instance, localId, remoteResult);
          this._log(`Reconciled local record: ${localId} -> ${remoteId}`);
          return remoteResult;
        }
        return remoteResult;
      } catch (error) {
        this._log("Remote insert failed:", error);
        if (!this._failSilently) {
          try {
            await this._localBackend.delete(instance);
          } catch {
          }
          throw error;
        }
      }
    }
    return localResult;
  }
  /**
   * Update an existing record
   *
   * Strategy:
   * 1. Update local DB
   * 2. PUT/PATCH to REST API
   * 3. Update local with any server changes
   */
  async update(instance) {
    await this._localBackend.update(instance);
    this._log(`Updated locally: ${instance.constructor.name}`);
    if (this._restBackend.isAuthenticated()) {
      try {
        await this._restBackend.update(instance);
        this._log(`Synced update to remote: ${instance.constructor.name}`);
      } catch (error) {
        this._log("Remote update failed:", error);
        if (!this._failSilently) {
          throw error;
        }
      }
    }
  }
  /**
   * Delete a record
   *
   * Strategy:
   * 1. Delete from local DB
   * 2. DELETE from REST API
   */
  async delete(instance) {
    await this._localBackend.delete(instance);
    this._log(`Deleted locally: ${instance.constructor.name}`);
    if (this._restBackend.isAuthenticated()) {
      try {
        await this._restBackend.delete(instance);
        this._log(`Synced delete to remote: ${instance.constructor.name}`);
      } catch (error) {
        this._log("Remote delete failed:", error);
        if (!this._failSilently) {
          throw error;
        }
      }
    }
  }
  // ===========================================================================
  // Bulk Operations
  // ===========================================================================
  async bulkInsert(instances) {
    const results = [];
    for (const instance of instances) {
      const result = await this.insert(instance);
      results.push(result);
    }
    return results;
  }
  async bulkUpdate(instances, fields) {
    const count = await this._localBackend.bulkUpdate(instances, fields);
    if (this._restBackend.isAuthenticated()) {
      for (const instance of instances) {
        try {
          await this._restBackend.update(instance);
        } catch (error) {
          this._log("Remote bulk update item failed:", error);
          if (!this._failSilently) {
            throw error;
          }
        }
      }
    }
    return count;
  }
  async updateMany(state, values) {
    return this._localBackend.updateMany(state, values);
  }
  async deleteMany(state) {
    return this._localBackend.deleteMany(state);
  }
  // ===========================================================================
  // Aggregation
  // ===========================================================================
  async count(state) {
    if (this._restBackend.isAuthenticated()) {
      try {
        return await this._restBackend.count(state);
      } catch {
      }
    }
    return this._localBackend.count(state);
  }
  async aggregate(state, aggregations) {
    return this._localBackend.aggregate(state, aggregations);
  }
  // ===========================================================================
  // Transactions
  // ===========================================================================
  async beginTransaction() {
    return this._localBackend.beginTransaction();
  }
  // ===========================================================================
  // Schema Operations
  // ===========================================================================
  getSchemaEditor() {
    return this._localBackend.getSchemaEditor();
  }
  async tableExists(tableName) {
    return this._localBackend.tableExists(tableName);
  }
  // ===========================================================================
  // Query Compilation
  // ===========================================================================
  compile(state) {
    return this._localBackend.compile(state);
  }
  // ===========================================================================
  // Reconciliation Helpers
  // ===========================================================================
  /**
   * Check if remote result has new/different data
   */
  _hasNewData(local, remote) {
    for (const key of Object.keys(remote)) {
      if (key === "id") continue;
      const localVal = local[key];
      const remoteVal = remote[key];
      if (JSON.stringify(localVal) !== JSON.stringify(remoteVal)) {
        return true;
      }
    }
    return false;
  }
  /**
   * Reconcile a local record with server response
   *
   * This updates the local record with server-provided data such as:
   * - Server-generated ID (if different)
   * - Server timestamps (createdAt, updatedAt)
   * - Any computed fields
   */
  async _reconcileRecord(instance, localId, remoteData) {
    const modelClass = instance.constructor;
    const tableName = modelClass.meta.dbTable || modelClass.name;
    const remoteId = String(remoteData.id);
    if (localId !== remoteId) {
      try {
        await this._localBackend.delete(instance);
      } catch {
      }
      const newInstance = new modelClass();
      this._applyDataToInstance(newInstance, remoteData);
      await this._localBackend.insert(newInstance);
    } else {
      this._applyDataToInstance(instance, remoteData);
      await this._localBackend.update(instance);
    }
  }
  /**
   * Apply data to a model instance
   */
  _applyDataToInstance(instance, data) {
    const fields = instance;
    for (const [key, value] of Object.entries(data)) {
      const field = fields[key];
      if (field && typeof field.set === "function") {
        try {
          field.set(value);
        } catch {
        }
      }
    }
  }
  // ===========================================================================
  // Logging
  // ===========================================================================
  _log(...args) {
    if (this._debug) {
      console.log("[SyncBackend]", ...args);
    }
  }
};

// src/comachine/src/backends/setup.ts
var DEFAULT_SETTINGS = {
  backend: "sync",
  apiUrl: "http://localhost:8000/api",
  databaseName: "comachine",
  debug: false,
  failSilently: true
};
var _syncBackend = null;
var _restBackend = null;
var _settings2 = null;
var _initialized2 = false;
async function setupBackend(settings = {}) {
  if (_initialized2) {
    console.warn("[Backend] Already initialized, skipping setup");
    return;
  }
  _settings2 = {
    ...DEFAULT_SETTINGS,
    ...getEnvConfig(),
    ...settings.backendConfig || {}
  };
  const debug = _settings2.debug ?? false;
  if (debug) {
    console.log("[Backend] Initializing with config:", _settings2);
  }
  const backendType = _settings2.backend ?? "sync";
  if (backendType === "sync") {
    await initializeSyncBackend(_settings2, settings, debug);
  } else {
    await initializeIndexedDBBackend(_settings2, settings, debug);
  }
  _initialized2 = true;
  if (debug) {
    console.log("[Backend] Setup complete, using:", backendType);
  }
}
async function initializeSyncBackend(backendSettings, alexiSettings, debug) {
  const databaseName = backendSettings.databaseName ?? DEFAULT_SETTINGS.databaseName;
  const apiUrl = backendSettings.apiUrl ?? DEFAULT_SETTINGS.apiUrl;
  if (debug) {
    console.log("[Backend] Creating SyncBackend with:");
    console.log("  - Database:", databaseName);
    console.log("  - API URL:", apiUrl);
  }
  await setup({
    ...alexiSettings,
    database: {
      engine: "indexeddb",
      name: databaseName
    },
    debug
  });
  const localBackend = getBackend();
  const restConfig = {
    apiUrl,
    debug
  };
  _restBackend = new RestBackend(restConfig);
  await _restBackend.connect();
  const syncConfig = {
    debug,
    failSilently: backendSettings.failSilently ?? true
  };
  _syncBackend = new SyncBackend(localBackend, _restBackend, syncConfig);
  await _syncBackend.connect();
  setBackend(_syncBackend);
  if (debug) {
    console.log("[Backend] SyncBackend initialized");
  }
}
async function initializeIndexedDBBackend(backendSettings, alexiSettings, debug) {
  const databaseName = backendSettings.databaseName ?? DEFAULT_SETTINGS.databaseName;
  if (debug) {
    console.log("[Backend] Creating IndexedDB-only backend");
    console.log("  - Database:", databaseName);
  }
  await setup({
    ...alexiSettings,
    database: {
      engine: "indexeddb",
      name: databaseName
    },
    debug
  });
  if (debug) {
    console.log("[Backend] IndexedDB backend initialized");
  }
}
function getEnvConfig() {
  const config11 = {};
  if (typeof Deno !== "undefined" && Deno.env) {
    try {
      const backend = Deno.env.get("COMACHINE_BACKEND");
      if (backend === "sync" || backend === "indexeddb") {
        config11.backend = backend;
      }
      const apiUrl = Deno.env.get("COMACHINE_API_URL");
      if (apiUrl) {
        config11.apiUrl = apiUrl;
      }
      const databaseName = Deno.env.get("COMACHINE_DATABASE_NAME");
      if (databaseName) {
        config11.databaseName = databaseName;
      }
      const debug = Deno.env.get("COMACHINE_DEBUG");
      if (debug !== void 0) {
        config11.debug = debug === "true";
      }
      const failSilently = Deno.env.get("COMACHINE_FAIL_SILENTLY");
      if (failSilently !== void 0) {
        config11.failSilently = failSilently === "true";
      }
    } catch {
    }
  }
  if (typeof window !== "undefined") {
    const windowConfig = window.__COMACHINE_CONFIG__;
    if (windowConfig) {
      Object.assign(config11, windowConfig);
    }
  }
  return config11;
}

// deno:https://jsr.io/@html-props/signals/1.0.0-beta.1/mod.ts
var SIGNAL_BRAND = Symbol.for("html-props:signal");
var context = [];
var pendingEffects = /* @__PURE__ */ new Set();
var isBatching = false;
var runEffects = /* @__PURE__ */ new Set();
var notifyDepth = 0;
function subscribe(running, subscriptions) {
  subscriptions.add(running.execute);
  running.dependencies.add(subscriptions);
}
function signal(initialValue) {
  let value = initialValue;
  const subscriptions = /* @__PURE__ */ new Set();
  const get = () => {
    const running = context[context.length - 1];
    if (running) subscribe(running, subscriptions);
    return value;
  };
  const notify = () => {
    notifyDepth++;
    try {
      for (const sub of [
        ...subscriptions
      ]) {
        if (!runEffects.has(sub)) {
          runEffects.add(sub);
          pendingEffects.add(sub);
        }
      }
      if (!isBatching) {
        while (pendingEffects.size > 0) {
          const toRun = Array.from(pendingEffects);
          pendingEffects.clear();
          toRun.forEach((fn2) => fn2());
        }
      }
    } finally {
      notifyDepth--;
      if (notifyDepth === 0) {
        runEffects.clear();
      }
    }
  };
  const set = (nextValue) => {
    value = nextValue;
    notify();
  };
  const update = (fn2) => {
    set(fn2(value));
  };
  const fn = get;
  fn.set = set;
  fn.get = get;
  fn.update = update;
  try {
    fn[SIGNAL_BRAND] = true;
  } catch {
  }
  return fn;
}
function cleanup(running) {
  for (const dep of running.dependencies) {
    dep.delete(running.execute);
  }
  running.dependencies.clear();
  if (typeof running.cleanup === "function") {
    try {
      running.cleanup();
    } catch (e) {
    }
    running.cleanup = void 0;
  }
}
function effect(fn, options) {
  let running;
  const execute = () => {
    if (running.disposed || running.executing) return;
    running.executing = true;
    cleanup(running);
    context.push(running);
    try {
      const result = fn();
      if (typeof result === "function") {
        running.cleanup = result;
      }
    } finally {
      context.pop();
      running.executing = false;
    }
  };
  running = {
    execute,
    dependencies: /* @__PURE__ */ new Set(),
    cleanup: void 0,
    disposed: false,
    executing: false
  };
  const dispose = () => {
    if (!running.disposed) {
      running.disposed = true;
      cleanup(running);
    }
  };
  if (options?.signal?.aborted) {
  } else {
    execute();
  }
  if (options?.signal) {
    options.signal.addEventListener("abort", dispose, {
      once: true
    });
  }
  try {
    dispose[Symbol.dispose] = dispose;
  } catch {
  }
  return dispose;
}
function computed(fn) {
  const s = signal(void 0);
  effect(() => s.set(fn()));
  return s;
}
function batch(fn) {
  const prevBatching = isBatching;
  isBatching = true;
  try {
    fn();
  } finally {
    isBatching = prevBatching;
    if (!isBatching) {
      const toRun = Array.from(pendingEffects);
      pendingEffects.clear();
      toRun.forEach((fn2) => fn2());
    }
  }
}

// src/core/controller.ts
var PROPS_CONTROLLER = Symbol.for("html-props:controller");
var HTML_PROPS_MIXIN = Symbol.for("html-props:mixin");
var PropsController = class _PropsController {
  firstRenderDone = false;
  lightDomApplied = false;
  cleanup = null;
  ref = null;
  host;
  propsConfig;
  customProps = {};
  defaultProps = {};
  updateScheduled = false;
  connected = false;
  eventListeners = /* @__PURE__ */ new Map();
  appliedStyleKeys = /* @__PURE__ */ new Set();
  props = {};
  constructor(host, propsConfig = {}, props = {}) {
    this.host = host;
    this.propsConfig = propsConfig;
    this.props = props;
    for (const [key, value] of Object.entries(propsConfig)) {
      if (this.isCustomProp(key)) {
        const defaultValue = "default" in value ? value.default : void 0;
        this.customProps[key] = signal(defaultValue);
        Object.defineProperty(host, key, {
          get: () => this.customProps[key](),
          set: (v) => {
            const oldValue = this.customProps[key]();
            if (oldValue !== v) {
              this.customProps[key].set(v);
              if (value.event && typeof v !== "function") {
                host.dispatchEvent(new CustomEvent(value.event, {
                  detail: v
                }));
              }
            }
          },
          enumerable: true,
          configurable: true
        });
      } else {
        this.defaultProps[key] = value;
      }
    }
    for (const [key, value] of Object.entries(props)) {
      if (this.isCustomProp(key) && this.customProps[key]) {
        this.customProps[key].set(value);
      }
    }
    const mergedProps = this.merge(this.defaultProps, props);
    this.applyProps(host, mergedProps);
  }
  merge(...objects) {
    const prepped = objects.filter((item) => !!item);
    if (prepped.length === 0) {
      return {};
    }
    return prepped.reduce((result, current) => {
      Object.keys(current).forEach((key) => {
        const item = current[key];
        const existing = result[key];
        if (typeof item === "object" && item !== null && !Array.isArray(item) && typeof existing === "object" && existing !== null && !Array.isArray(existing)) {
          result[key] = this.merge(existing, item);
        } else {
          result[key] = item;
        }
      });
      return result;
    }, {});
  }
  isCustomProp(key) {
    const cfg = this.propsConfig ? this.propsConfig[key] : null;
    return cfg && typeof cfg === "object" && (typeof cfg.type === "function" || "default" in cfg || "attribute" in cfg);
  }
  /**
   * Check if this controller has any custom props defined.
   * Used to determine if a component needs re-render after morphing.
   */
  hasCustomProps() {
    return Object.keys(this.customProps).length > 0;
  }
  /**
   * Normalize children array: filter out null/undefined/boolean and convert strings/numbers to text nodes.
   */
  normalizeChildren(items) {
    const result = [];
    for (const item of items) {
      if (item === null || item === void 0 || item === true || item === false) {
        continue;
      }
      if (typeof item === "string" || typeof item === "number") {
        result.push(document.createTextNode(String(item)));
      } else if (item instanceof Node) {
        result.push(item);
      }
    }
    return result;
  }
  // ============================================
  // PUBLIC API: Two main methods
  // ============================================
  /**
   * Apply props to target element (style, dataset, event handlers, rest props).
   * Does NOT manipulate DOM children - safe to call in constructor.
   *
   * @param target - Element to apply props to
   * @param props - Props object (defaults to this.props)
   */
  applyProps(target, props = this.props) {
    this.applyStyle(target, props.style);
    this.applyDataset(target, props.dataset);
    this.applyEventHandlers(target, props);
    this.applyRestProps(target, props);
  }
  /**
   * Apply content to target element.
   *
   * Handles:
   * 1. Props-based content: innerHTML, textContent, content, children
   * 2. render() method output (if component has one)
   *
   * For wrappers (Lit/FAST): Call BEFORE super.connectedCallback() so slots see content.
   * For custom components: Called by requestUpdate/forceUpdate.
   *
   * @param target - Element to apply content to (defaults to this.host)
   */
  applyContent(target = this.host) {
    const { content, children, innerHTML, textContent } = this.props;
    const hostWithRender = this.host;
    if (hostWithRender.render) {
      const renderResult = hostWithRender.render();
      const isTemplateResult = renderResult && typeof renderResult === "object" && ("_$litType$" in renderResult || // Lit template result
      "create" in renderResult || // FAST template result
      "strings" in renderResult);
      if (!isTemplateResult && renderResult != null) {
        this.currentRender = renderResult;
        const nodes2 = this.normalizeChildren(Array.isArray(renderResult) ? renderResult : [
          renderResult
        ]);
        target.replaceChildren(...nodes2);
        return;
      }
    }
    if (this.lightDomApplied) return;
    if (innerHTML !== void 0) {
      target.innerHTML = innerHTML;
      return;
    }
    if (textContent !== void 0) {
      target.textContent = textContent;
      return;
    }
    const nodeContent = content ?? children;
    if (nodeContent === void 0) return;
    const nodes = this.normalizeChildren(Array.isArray(nodeContent) ? nodeContent : [
      nodeContent
    ]);
    target.replaceChildren(...nodes);
  }
  // ============================================
  // PRIVATE: Helper methods for applyProps
  // ============================================
  isEventHandler(key) {
    return key.startsWith("on") && key.length > 2;
  }
  applyStyle(target, style) {
    if (!target.style) return;
    const targetController = target[PROPS_CONTROLLER];
    const trackedKeys = targetController?.appliedStyleKeys ?? this.appliedStyleKeys;
    if (typeof style === "string") {
      trackedKeys.clear();
      target.setAttribute("style", style);
      return;
    }
    const defaultStyle = targetController?.defaultProps?.style;
    const mergedStyle = {
      ...defaultStyle && typeof defaultStyle === "object" ? defaultStyle : {},
      ...style && typeof style === "object" ? style : {}
    };
    const newKeys = new Set(Object.keys(mergedStyle));
    for (const key of trackedKeys) {
      if (!newKeys.has(key)) {
        target.style[key] = "";
      }
    }
    if (Object.keys(mergedStyle).length > 0) {
      Object.assign(target.style, mergedStyle);
    }
    trackedKeys.clear();
    for (const key of newKeys) {
      trackedKeys.add(key);
    }
  }
  applyDataset(target, dataset) {
    if (!dataset) return;
    if (!target.dataset) return;
    Object.assign(target.dataset, dataset);
  }
  applyRef(target, ref) {
    if (!ref) return;
    this.ref = ref;
    if (typeof ref === "function") {
      ref(target);
    } else if (typeof ref === "object" && "current" in ref) {
      ref.current = target;
    }
  }
  applyEventHandlers(target, props) {
    for (const [key, value] of Object.entries(props)) {
      if (this.isEventHandler(key)) {
        target[key] = value;
      }
    }
  }
  applyRestProps(target, props) {
    const reserved = /* @__PURE__ */ new Set([
      "ref",
      "style",
      "dataset",
      "innerHTML",
      "textContent",
      "children",
      "content"
    ]);
    for (const [key, value] of Object.entries(props)) {
      if (reserved.has(key)) continue;
      if (this.isEventHandler(key)) continue;
      if (this.isCustomProp(key)) continue;
      target[key] = value;
    }
  }
  /**
   * Apply custom props from new props object.
   * Used during morphing to update signal-backed props.
   */
  applyCustomProps(props) {
    batch(() => {
      for (const [key, value] of Object.entries(props)) {
        if (this.isCustomProp(key) && this.customProps[key]) {
          this.customProps[key].set(value);
        }
      }
    });
  }
  // ============================================
  // RENDER & UPDATE: Lifecycle methods
  // ============================================
  requestUpdate() {
    if (this.updateScheduled) {
      return;
    }
    this.updateScheduled = true;
    try {
      const hostWithMethods = this.host;
      if (this.firstRenderDone) {
        if (hostWithMethods.update) {
          hostWithMethods.update();
        } else {
          this.defaultUpdate();
        }
      } else {
        this.forceUpdate();
        this.firstRenderDone = true;
      }
    } finally {
      this.updateScheduled = false;
    }
  }
  currentRender = null;
  defaultUpdate() {
    const hostWithRender = this.host;
    if (hostWithRender.render) {
      const target = this.host.shadowRoot ?? this.host;
      if (this.currentRender === null) {
        this.applyContent(target);
        this.currentRender = Array.from(target.childNodes);
      } else {
        const nextRender = hostWithRender.render();
        if (nextRender) {
          const prevChildren = Array.from(target.childNodes);
          const nextChildren = this.normalizeChildren(Array.isArray(nextRender) ? nextRender : [
            nextRender
          ]);
          this.reconcile(prevChildren, nextChildren, target);
          this.currentRender = Array.from(target.childNodes);
        }
      }
    }
  }
  // ============================================
  // Morphlex-inspired reconciliation algorithm
  // ============================================
  static ELEMENT_NODE = 1;
  static TEXT_NODE = 3;
  /**
   * Get the matching key for a node.
   * Priority: id attribute > dataset.key > props.dataset.key
   */
  getNodeKey(node) {
    if (!node) return null;
    if (node.id) return `id:${node.id}`;
    if (node.dataset?.key) return `key:${node.dataset.key}`;
    const propsKey = node[PROPS_CONTROLLER]?.props?.dataset?.key;
    if (propsKey) {
      return `key:${propsKey}`;
    }
    return null;
  }
  /**
   * Get all descendant IDs as a Set (for matching by child IDs)
   */
  getIdSet(node) {
    const ids = /* @__PURE__ */ new Set();
    if (node.querySelectorAll) {
      const elements = Array.from(node.querySelectorAll("[id]"));
      for (const el of elements) {
        if (el.id) ids.add(el.id);
      }
    }
    return ids;
  }
  /**
   * Get all descendant IDs as an Array
   */
  getIdArray(node) {
    const ids = [];
    if (node.querySelectorAll) {
      const elements = Array.from(node.querySelectorAll("[id]"));
      for (const el of elements) {
        if (el.id) ids.push(el.id);
      }
    }
    return ids;
  }
  /**
   * Check if two nodes match for morphing purposes.
   * Returns: 'equal' | 'same' | 'none'
   */
  matchNodes(from, to) {
    if (!from || !to) return "none";
    if (from === to) return "equal";
    if (from.nodeType !== to.nodeType) return "none";
    const fromKey = this.getNodeKey(from);
    const toKey = this.getNodeKey(to);
    if (fromKey && toKey && fromKey !== toKey) return "none";
    if (from.nodeType === _PropsController.TEXT_NODE) {
      if (from.nodeValue === to.nodeValue) return "equal";
      return "same";
    }
    if (from.nodeType === _PropsController.ELEMENT_NODE) {
      if (from.localName !== to.localName) return "none";
      if (from.localName === "input" && from.type !== to.type) {
        return "none";
      }
      if (from[PROPS_CONTROLLER] || to[PROPS_CONTROLLER]) {
        return "same";
      }
      if (from.isEqualNode(to)) return "equal";
      return "same";
    }
    return "none";
  }
  /**
   * Find the longest increasing subsequence indices.
   * Used to minimize DOM move operations.
   */
  longestIncreasingSubsequence(sequence) {
    const n = sequence.length;
    if (n === 0) return [];
    const smallestEnding = [];
    const indices = [];
    const prev = new Array(n);
    for (let i = 0; i < n; i++) {
      const val = sequence[i];
      if (val === void 0) continue;
      let left = 0;
      let right = smallestEnding.length;
      while (left < right) {
        const mid = Math.floor((left + right) / 2);
        if (smallestEnding[mid] < val) left = mid + 1;
        else right = mid;
      }
      prev[i] = left > 0 ? indices[left - 1] : -1;
      smallestEnding[left] = val;
      indices[left] = i;
    }
    const result = [];
    let idx = indices[smallestEnding.length - 1];
    while (idx !== void 0 && idx >= 0) {
      result.push(idx);
      idx = prev[idx];
    }
    return result.reverse();
  }
  /**
   * Main reconciliation method - Morphlex-inspired algorithm
   */
  reconcile(fromNodes, toNodes, parent = this.host) {
    const fromChildren = fromNodes;
    const toChildren = toNodes;
    const fromIdSets = /* @__PURE__ */ new Map();
    for (const node of fromChildren) {
      if (node?.nodeType === _PropsController.ELEMENT_NODE) {
        fromIdSets.set(node, this.getIdSet(node));
      }
    }
    const matches = new Array(toChildren.length);
    const operations = new Array(toChildren.length);
    const unmatchedFrom = new Set(fromChildren.map((_, i) => i));
    for (let toIdx = 0; toIdx < toChildren.length; toIdx++) {
      const toNode = toChildren[toIdx];
      const toKey = this.getNodeKey(toNode);
      if (!toKey) continue;
      for (const fromIdx of unmatchedFrom) {
        const fromNode = fromChildren[fromIdx];
        const fromKey = this.getNodeKey(fromNode);
        if (toKey === fromKey) {
          const match = this.matchNodes(fromNode, toNode);
          if (match !== "none") {
            matches[toIdx] = fromIdx;
            operations[toIdx] = match;
            unmatchedFrom.delete(fromIdx);
            break;
          }
        }
      }
    }
    for (let toIdx = 0; toIdx < toChildren.length; toIdx++) {
      if (matches[toIdx] !== void 0) continue;
      const toNode = toChildren[toIdx];
      if (!toNode || toNode.nodeType !== _PropsController.ELEMENT_NODE) continue;
      const toIdArray = this.getIdArray(toNode);
      if (toIdArray.length === 0) continue;
      for (const fromIdx of unmatchedFrom) {
        const fromNode = fromChildren[fromIdx];
        const fromIdSet = fromIdSets.get(fromNode);
        if (fromIdSet && fromIdSet.size > 0) {
          const hasMatchingId = toIdArray.some((id) => fromIdSet.has(id));
          if (hasMatchingId) {
            const match = this.matchNodes(fromNode, toNode);
            if (match !== "none") {
              matches[toIdx] = fromIdx;
              operations[toIdx] = match;
              unmatchedFrom.delete(fromIdx);
              break;
            }
          }
        }
      }
    }
    for (let toIdx = 0; toIdx < toChildren.length; toIdx++) {
      if (matches[toIdx] !== void 0) continue;
      const toNode = toChildren[toIdx];
      if (!toNode) continue;
      if (toNode[PROPS_CONTROLLER]) continue;
      for (const fromIdx of unmatchedFrom) {
        const fromNode = fromChildren[fromIdx];
        if (!fromNode) continue;
        if (fromNode[PROPS_CONTROLLER]) continue;
        if (fromNode.isEqualNode?.(toNode)) {
          matches[toIdx] = fromIdx;
          operations[toIdx] = "equal";
          unmatchedFrom.delete(fromIdx);
          break;
        }
      }
    }
    for (let toIdx = 0; toIdx < toChildren.length; toIdx++) {
      if (matches[toIdx] !== void 0) continue;
      const toNode = toChildren[toIdx];
      for (const fromIdx of unmatchedFrom) {
        const fromNode = fromChildren[fromIdx];
        const match = this.matchNodes(fromNode, toNode);
        if (match !== "none") {
          matches[toIdx] = fromIdx;
          operations[toIdx] = match;
          unmatchedFrom.delete(fromIdx);
          break;
        }
      }
    }
    for (let toIdx = 0; toIdx < toChildren.length; toIdx++) {
      if (matches[toIdx] === void 0) {
        operations[toIdx] = "new";
      }
    }
    for (const fromIdx of unmatchedFrom) {
      const node = fromChildren[fromIdx];
      if (node?.parentNode) {
        node.remove?.();
      }
    }
    const lisIndices = this.longestIncreasingSubsequence(matches);
    const shouldNotMove = /* @__PURE__ */ new Set();
    for (const lisIdx of lisIndices) {
      const fromIdx = matches[lisIdx];
      if (fromIdx !== void 0) {
        shouldNotMove.add(fromIdx);
      }
    }
    let insertionPoint = parent.firstChild;
    for (let toIdx = 0; toIdx < toChildren.length; toIdx++) {
      const toNode = toChildren[toIdx];
      const fromIdx = matches[toIdx];
      const operation = operations[toIdx];
      if (operation === "new") {
        parent.insertBefore(toNode, insertionPoint);
        insertionPoint = toNode.nextSibling;
      } else if (fromIdx !== void 0) {
        const fromNode = fromChildren[fromIdx];
        if (!shouldNotMove.has(fromIdx)) {
          if (fromNode !== insertionPoint) {
            parent.insertBefore(fromNode, insertionPoint);
          }
        }
        if (operation === "same") {
          this.morphNode(fromNode, toNode);
        }
        insertionPoint = fromNode.nextSibling;
      }
    }
  }
  /**
   * Morph a single node (update attributes, props, and recurse children)
   */
  morphNode(from, to) {
    if (from.nodeType === _PropsController.TEXT_NODE) {
      if (from.nodeValue !== to.nodeValue) {
        from.nodeValue = to.nodeValue;
      }
      return;
    }
    if (from.nodeType === _PropsController.ELEMENT_NODE) {
      const fromController = from[PROPS_CONTROLLER];
      const toController = to[PROPS_CONTROLLER];
      if (fromController && toController) {
        const props = toController.props;
        const target = from;
        fromController.applyProps(target, props);
        fromController.applyCustomProps(props);
        fromController.applyRef(target, props.ref);
        const targetWithRender = target;
        if (targetWithRender.render && fromController.hasCustomProps()) {
          fromController.requestUpdate();
        }
        if (this.applyDirectContent(target, props)) {
          return;
        }
        const nextContent = props.content || props.children;
        if (nextContent) {
          const prevChildren = Array.from(from.childNodes);
          const nextChildren = fromController.normalizeChildren(Array.isArray(nextContent) ? nextContent : [
            nextContent
          ]);
          fromController.reconcile(prevChildren, nextChildren, from);
        }
      } else {
        this.morphAttributes(from, to);
        if (from.hasChildNodes() || to.hasChildNodes()) {
          const prevChildren = Array.from(from.childNodes);
          const nextChildren = Array.from(to.childNodes);
          this.reconcile(prevChildren, nextChildren, from);
        }
      }
    }
  }
  /**
   * Apply direct content props (innerHTML, textContent) to target element.
   * These props replace all children, so no recursion is needed after applying.
   * @returns true if direct content was applied, false otherwise
   */
  applyDirectContent(target, props) {
    if ("innerHTML" in props && props.innerHTML !== void 0) {
      target.innerHTML = String(props.innerHTML);
      return true;
    }
    if ("textContent" in props && props.textContent !== void 0) {
      target.textContent = String(props.textContent);
      return true;
    }
    return false;
  }
  /**
   * Sync attributes from one element to another
   */
  morphAttributes(from, to) {
    for (let i = 0; i < to.attributes.length; i++) {
      const { name, value } = to.attributes[i];
      if (from.getAttribute(name) !== value) {
        from.setAttribute(name, value);
      }
    }
    const toRemove = [];
    for (let i = 0; i < from.attributes.length; i++) {
      const { name } = from.attributes[i];
      if (!to.hasAttribute(name)) {
        toRemove.push(name);
      }
    }
    for (const name of toRemove) {
      from.removeAttribute(name);
    }
  }
  forceUpdate() {
    const target = this.host.shadowRoot ?? this.host;
    this.applyContent(target);
  }
  reflectAttributes() {
    const host = this.host;
    const props = this.propsConfig;
    if (!props) return;
    Object.entries(props).forEach(([key, config11]) => {
      const isPropConfig = config11 && typeof config11 === "object" && (typeof config11.type === "function" || "default" in config11 || "attribute" in config11);
      if (!isPropConfig) return;
      if (config11.attribute) {
        const s = this.customProps[key];
        if (!s) return;
        const val = s();
        const attrName = typeof config11.attribute === "string" ? config11.attribute : key.toLowerCase();
        const isBoolean = config11.type === Boolean || typeof config11.default === "boolean";
        if (isBoolean) {
          if (val) {
            if (!host.hasAttribute(attrName)) {
              host.setAttribute(attrName, "");
            }
          } else {
            if (host.hasAttribute(attrName)) {
              host.removeAttribute(attrName);
            }
          }
        } else {
          if (val != null) {
            const strVal = String(val);
            if (host.getAttribute(attrName) !== strVal) {
              host.setAttribute(attrName, strVal);
            }
          } else {
            host.removeAttribute(attrName);
          }
        }
      }
    });
  }
  /**
   * Setup event listeners for props with 'event' config.
   * Creates wrapper handlers that call the current prop value.
   */
  setupEventListeners() {
    const props = this.propsConfig;
    if (!props) return;
    for (const [key, config11] of Object.entries(props)) {
      if (config11 && typeof config11 === "object" && config11.event) {
        const eventName = config11.event;
        const handler = (e) => {
          const fn = this.customProps[key]?.();
          if (typeof fn === "function") {
            fn.call(this.host, e);
          }
        };
        this.eventListeners.set(eventName, handler);
        this.host.addEventListener(eventName, handler);
      }
    }
  }
  /**
   * Remove all event listeners created by setupEventListeners.
   */
  cleanupEventListeners() {
    const host = this.host;
    for (const [eventName, handler] of this.eventListeners) {
      host.removeEventListener(eventName, handler);
    }
    this.eventListeners.clear();
  }
  /**
   * Called AFTER super.connectedCallback().
   * Sets up effects for reactive updates.
   */
  onConnected() {
    if (this.connected) return;
    this.connected = true;
    this.setupEventListeners();
    const renderDispose = effect(() => this.requestUpdate());
    const reflectDispose = effect(() => this.reflectAttributes());
    this.cleanup = () => {
      if (this.ref) {
        if (typeof this.ref === "function") {
          this.ref(null);
        } else if (typeof this.ref === "object" && "current" in this.ref) {
          this.ref.current = null;
        }
      }
      renderDispose();
      reflectDispose();
      this.cleanupEventListeners();
    };
  }
  /**
   * Update content dynamically (called by content setter).
   * This applies content directly to Light DOM, bypassing the guard.
   */
  updateContent(target) {
    this.applyLightDomContentDirect(target);
  }
  /**
   * Apply Light DOM content from props (innerHTML, textContent, content, children).
   * Does NOT call render() - this is for wrapper components that don't have render().
   * Has a guard to prevent duplicate application during initial connection.
   */
  applyLightDomContent(target) {
    if (this.lightDomApplied) return;
    this.lightDomApplied = true;
    this.applyLightDomContentDirect(target);
  }
  /**
   * Direct Light DOM content application (no guard).
   * Called by both applyLightDomContent and updateContent.
   */
  applyLightDomContentDirect(target) {
    const { content, children, innerHTML, textContent } = this.props;
    if (innerHTML !== void 0) {
      target.innerHTML = innerHTML;
      return;
    }
    if (textContent !== void 0) {
      target.textContent = textContent;
      return;
    }
    const nodeContent = content ?? children;
    if (nodeContent === void 0) return;
    const nodes = this.normalizeChildren(Array.isArray(nodeContent) ? nodeContent : [
      nodeContent
    ]);
    target.replaceChildren(...nodes);
  }
  onDisconnected() {
    this.connected = false;
    this.lightDomApplied = false;
    if (this.cleanup) {
      this.cleanup();
      this.cleanup = null;
    }
  }
  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;
    const props = this.propsConfig;
    if (!props) return;
    const entry = Object.entries(props).find(([key, config11]) => {
      const attr = typeof config11.attribute === "string" ? config11.attribute : key.toLowerCase();
      return attr === name;
    });
    if (entry) {
      const [key, config11] = entry;
      let val = newVal;
      if (config11.type === Boolean || typeof config11.default === "boolean") {
        val = newVal !== null;
      } else if (config11.type === Number || typeof config11.default === "number") {
        val = newVal === null ? null : Number(newVal);
      }
      this.host[key] = val;
    }
  }
};

// src/core/mixin.ts
function HTMLPropsMixin(Base, config11) {
  class HTMLPropsElement extends Base {
    // Marker to identify classes created by HTMLPropsMixin
    static [HTML_PROPS_MIXIN] = true;
    // Single Symbol property to avoid any conflicts
    [PROPS_CONTROLLER];
    static define(tagName, options) {
      customElements.define(tagName, this, options);
      return this;
    }
    static get observedAttributes() {
      const propsConfig = this.__propsConfig;
      if (!propsConfig) return [];
      return Object.entries(propsConfig).filter(([_, cfg]) => cfg.attribute).map(([key, cfg]) => {
        if (typeof cfg.attribute === "string") return cfg.attribute;
        return key.toLowerCase();
      });
    }
    constructor(...args) {
      if ("props" in Base) {
        super(...args);
      } else {
        super();
      }
      const propsConfig = this.constructor.__propsConfig || {};
      const props = args[0] ?? {};
      this[PROPS_CONTROLLER] = new PropsController(this, propsConfig, props);
    }
    connectedCallback() {
      if (this.__html_props_phantom) return;
      this[PROPS_CONTROLLER].applyLightDomContent(this);
      if (super.connectedCallback) super.connectedCallback();
      this[PROPS_CONTROLLER].applyRef(this, this[PROPS_CONTROLLER].props.ref);
      this[PROPS_CONTROLLER].onConnected();
      if (this.mountedCallback) {
        queueMicrotask(() => {
          this.mountedCallback();
        });
      }
    }
    disconnectedCallback() {
      if (super.disconnectedCallback) super.disconnectedCallback();
      if (this.__html_props_phantom) return;
      this[PROPS_CONTROLLER].onDisconnected();
      if (this.unmountedCallback) {
        this.unmountedCallback();
      }
    }
    attributeChangedCallback(name, oldVal, newVal) {
      if (super.attributeChangedCallback) {
        super.attributeChangedCallback(name, oldVal, newVal);
      }
      this[PROPS_CONTROLLER]?.attributeChangedCallback(name, oldVal, newVal);
    }
    requestUpdate() {
      if (super.requestUpdate) {
        super.requestUpdate();
        return;
      }
      this[PROPS_CONTROLLER]?.requestUpdate();
    }
    defaultUpdate() {
      if (super.defaultUpdate) super.defaultUpdate();
      this[PROPS_CONTROLLER]?.defaultUpdate();
    }
    forceUpdate() {
      if (super.forceUpdate) super.forceUpdate();
      this[PROPS_CONTROLLER]?.forceUpdate();
    }
    get content() {
      return this[PROPS_CONTROLLER]?.props?.content;
    }
    set content(value) {
      if (this[PROPS_CONTROLLER]) {
        this[PROPS_CONTROLLER].props.content = value;
        this[PROPS_CONTROLLER].updateContent(this);
      }
    }
  }
  if (config11 && typeof config11 === "object") {
    const parentConfig = Base.__propsConfig || {};
    const mergedConfig = {
      ...parentConfig
    };
    for (const [key, value] of Object.entries(config11)) {
      const parentValue = parentConfig[key];
      const isParentPropConfig = parentValue && typeof parentValue === "object" && (typeof parentValue.type === "function" || "default" in parentValue || "attribute" in parentValue);
      const isChildPropConfig = value && typeof value === "object" && (typeof value.type === "function" || "default" in value || "attribute" in value);
      if (isParentPropConfig && !isChildPropConfig) {
        mergedConfig[key] = {
          ...parentValue,
          default: value
        };
      } else {
        mergedConfig[key] = value;
      }
    }
    HTMLPropsElement.__propsConfig = mergedConfig;
  }
  return HTMLPropsElement;
}

// src/core/prop.ts
function prop(defaultValue, config11 = {}) {
  return {
    default: defaultValue,
    ...config11
  };
}

// deno:https://jsr.io/@html-props/built-ins/1.0.0-beta.5/mod.ts
var Div = HTMLPropsMixin(HTMLDivElement).define("html-div", {
  extends: "div"
});
var Section = HTMLPropsMixin(HTMLElement).define("html-section", {
  extends: "section"
});
var Article = HTMLPropsMixin(HTMLElement).define("html-article", {
  extends: "article"
});
var Aside = HTMLPropsMixin(HTMLElement).define("html-aside", {
  extends: "aside"
});
var Header = HTMLPropsMixin(HTMLElement).define("html-header", {
  extends: "header"
});
var Footer = HTMLPropsMixin(HTMLElement).define("html-footer", {
  extends: "footer"
});
var Nav = HTMLPropsMixin(HTMLElement).define("html-nav", {
  extends: "nav"
});
var Main = HTMLPropsMixin(HTMLElement).define("html-main", {
  extends: "main"
});
var Address = HTMLPropsMixin(HTMLElement).define("html-address", {
  extends: "address"
});
var Heading1 = HTMLPropsMixin(HTMLHeadingElement).define("html-h1", {
  extends: "h1"
});
var Heading2 = HTMLPropsMixin(HTMLHeadingElement).define("html-h2", {
  extends: "h2"
});
var Heading3 = HTMLPropsMixin(HTMLHeadingElement).define("html-h3", {
  extends: "h3"
});
var Heading4 = HTMLPropsMixin(HTMLHeadingElement).define("html-h4", {
  extends: "h4"
});
var Heading5 = HTMLPropsMixin(HTMLHeadingElement).define("html-h5", {
  extends: "h5"
});
var Heading6 = HTMLPropsMixin(HTMLHeadingElement).define("html-h6", {
  extends: "h6"
});
var Paragraph = HTMLPropsMixin(HTMLParagraphElement).define("html-p", {
  extends: "p"
});
var HorizontalRule = HTMLPropsMixin(HTMLHRElement).define("html-hr", {
  extends: "hr"
});
var Preformatted = HTMLPropsMixin(HTMLPreElement).define("html-pre", {
  extends: "pre"
});
var Blockquote = HTMLPropsMixin(HTMLQuoteElement).define("html-blockquote", {
  extends: "blockquote"
});
var OrderedList = HTMLPropsMixin(HTMLOListElement).define("html-ol", {
  extends: "ol"
});
var UnorderedList = HTMLPropsMixin(HTMLUListElement).define("html-ul", {
  extends: "ul"
});
var ListItem = HTMLPropsMixin(HTMLLIElement).define("html-li", {
  extends: "li"
});
var DescriptionList = HTMLPropsMixin(HTMLDListElement).define("html-dl", {
  extends: "dl"
});
var DescriptionTerm = HTMLPropsMixin(HTMLElement).define("html-dt", {
  extends: "dt"
});
var DescriptionDetails = HTMLPropsMixin(HTMLElement).define("html-dd", {
  extends: "dd"
});
var Figure = HTMLPropsMixin(HTMLElement).define("html-figure", {
  extends: "figure"
});
var Figcaption = HTMLPropsMixin(HTMLElement).define("html-figcaption", {
  extends: "figcaption"
});
var Anchor = HTMLPropsMixin(HTMLAnchorElement).define("html-a", {
  extends: "a"
});
var Emphasis = HTMLPropsMixin(HTMLElement).define("html-em", {
  extends: "em"
});
var Strong = HTMLPropsMixin(HTMLElement).define("html-strong", {
  extends: "strong"
});
var Small = HTMLPropsMixin(HTMLElement).define("html-small", {
  extends: "small"
});
var Strikethrough = HTMLPropsMixin(HTMLElement).define("html-s", {
  extends: "s"
});
var Cite = HTMLPropsMixin(HTMLElement).define("html-cite", {
  extends: "cite"
});
var Quote = HTMLPropsMixin(HTMLQuoteElement).define("html-q", {
  extends: "q"
});
var Code = HTMLPropsMixin(HTMLElement).define("html-code", {
  extends: "code"
});
var Data = HTMLPropsMixin(HTMLDataElement).define("html-data", {
  extends: "data"
});
var Time = HTMLPropsMixin(HTMLTimeElement).define("html-time", {
  extends: "time"
});
var Variable = HTMLPropsMixin(HTMLElement).define("html-var", {
  extends: "var"
});
var Sample = HTMLPropsMixin(HTMLElement).define("html-samp", {
  extends: "samp"
});
var Keyboard = HTMLPropsMixin(HTMLElement).define("html-kbd", {
  extends: "kbd"
});
var Subscript = HTMLPropsMixin(HTMLElement).define("html-sub", {
  extends: "sub"
});
var Superscript = HTMLPropsMixin(HTMLElement).define("html-sup", {
  extends: "sup"
});
var Italic = HTMLPropsMixin(HTMLElement).define("html-i", {
  extends: "i"
});
var Bold = HTMLPropsMixin(HTMLElement).define("html-b", {
  extends: "b"
});
var Underline = HTMLPropsMixin(HTMLElement).define("html-u", {
  extends: "u"
});
var Mark = HTMLPropsMixin(HTMLElement).define("html-mark", {
  extends: "mark"
});
var Ruby = HTMLPropsMixin(HTMLElement).define("html-ruby", {
  extends: "ruby"
});
var RubyText = HTMLPropsMixin(HTMLElement).define("html-rt", {
  extends: "rt"
});
var RubyParenthesis = HTMLPropsMixin(HTMLElement).define("html-rp", {
  extends: "rp"
});
var BidirectionalIsolate = HTMLPropsMixin(HTMLElement).define("html-bdi", {
  extends: "bdi"
});
var BidirectionalOverride = HTMLPropsMixin(HTMLElement).define("html-bdo", {
  extends: "bdo"
});
var Span = HTMLPropsMixin(HTMLSpanElement).define("html-span", {
  extends: "span"
});
var LineBreak = HTMLPropsMixin(HTMLBRElement).define("html-br", {
  extends: "br"
});
var WordBreak = HTMLPropsMixin(HTMLElement).define("html-wbr", {
  extends: "wbr"
});
var Image = HTMLPropsMixin(HTMLImageElement).define("html-img", {
  extends: "img"
});
var Audio = HTMLPropsMixin(HTMLAudioElement).define("html-audio", {
  extends: "audio"
});
var Video = HTMLPropsMixin(HTMLVideoElement).define("html-video", {
  extends: "video"
});
var Source = HTMLPropsMixin(HTMLSourceElement).define("html-source", {
  extends: "source"
});
var Track = HTMLPropsMixin(HTMLTrackElement).define("html-track", {
  extends: "track"
});
var Map2 = HTMLPropsMixin(HTMLMapElement).define("html-map", {
  extends: "map"
});
var Area = HTMLPropsMixin(HTMLAreaElement).define("html-area", {
  extends: "area"
});
var IFrame = HTMLPropsMixin(HTMLIFrameElement).define("html-iframe", {
  extends: "iframe"
});
var Embed = HTMLPropsMixin(HTMLEmbedElement).define("html-embed", {
  extends: "embed"
});
var Object2 = HTMLPropsMixin(HTMLObjectElement).define("html-object", {
  extends: "object"
});
var Param = HTMLPropsMixin(HTMLParamElement).define("html-param", {
  extends: "param"
});
var Picture = HTMLPropsMixin(HTMLPictureElement).define("html-picture", {
  extends: "picture"
});
var Canvas = HTMLPropsMixin(HTMLCanvasElement).define("html-canvas", {
  extends: "canvas"
});
var NoScript = HTMLPropsMixin(HTMLElement).define("html-noscript", {
  extends: "noscript"
});
var Script = HTMLPropsMixin(HTMLScriptElement).define("html-script", {
  extends: "script"
});
var Del = HTMLPropsMixin(HTMLModElement).define("html-del", {
  extends: "del"
});
var Ins = HTMLPropsMixin(HTMLModElement).define("html-ins", {
  extends: "ins"
});
var Table = HTMLPropsMixin(HTMLTableElement).define("html-table", {
  extends: "table"
});
var Caption = HTMLPropsMixin(HTMLTableCaptionElement).define("html-caption", {
  extends: "caption"
});
var TableHead = HTMLPropsMixin(HTMLTableSectionElement).define("html-thead", {
  extends: "thead"
});
var TableBody = HTMLPropsMixin(HTMLTableSectionElement).define("html-tbody", {
  extends: "tbody"
});
var TableFoot = HTMLPropsMixin(HTMLTableSectionElement).define("html-tfoot", {
  extends: "tfoot"
});
var TableRow = HTMLPropsMixin(HTMLTableRowElement).define("html-tr", {
  extends: "tr"
});
var TableHeader = HTMLPropsMixin(HTMLTableCellElement).define("html-th", {
  extends: "th"
});
var TableData = HTMLPropsMixin(HTMLTableCellElement).define("html-td", {
  extends: "td"
});
var Col = HTMLPropsMixin(HTMLTableColElement).define("html-col", {
  extends: "col"
});
var ColGroup = HTMLPropsMixin(HTMLTableColElement).define("html-colgroup", {
  extends: "colgroup"
});
var Button = HTMLPropsMixin(HTMLButtonElement).define("html-button", {
  extends: "button"
});
var DataList = HTMLPropsMixin(HTMLDataListElement).define("html-datalist", {
  extends: "datalist"
});
var FieldSet = HTMLPropsMixin(HTMLFieldSetElement).define("html-fieldset", {
  extends: "fieldset"
});
var Form = HTMLPropsMixin(HTMLFormElement).define("html-form", {
  extends: "form"
});
var Input = HTMLPropsMixin(HTMLInputElement).define("html-input", {
  extends: "input"
});
var Label = HTMLPropsMixin(HTMLLabelElement).define("html-label", {
  extends: "label"
});
var Legend = HTMLPropsMixin(HTMLLegendElement).define("html-legend", {
  extends: "legend"
});
var Meter = HTMLPropsMixin(HTMLMeterElement).define("html-meter", {
  extends: "meter"
});
var OptGroup = HTMLPropsMixin(HTMLOptGroupElement).define("html-optgroup", {
  extends: "optgroup"
});
var Option = HTMLPropsMixin(HTMLOptionElement).define("html-option", {
  extends: "option"
});
var Output = HTMLPropsMixin(HTMLOutputElement).define("html-output", {
  extends: "output"
});
var Progress = HTMLPropsMixin(HTMLProgressElement).define("html-progress", {
  extends: "progress"
});
var Select = HTMLPropsMixin(HTMLSelectElement).define("html-select", {
  extends: "select"
});
var TextArea = HTMLPropsMixin(HTMLTextAreaElement).define("html-textarea", {
  extends: "textarea"
});
var Details = HTMLPropsMixin(HTMLDetailsElement).define("html-details", {
  extends: "details"
});
var Dialog = HTMLPropsMixin(HTMLDialogElement).define("html-dialog", {
  extends: "dialog"
});
var Menu = HTMLPropsMixin(HTMLMenuElement).define("html-menu", {
  extends: "menu"
});
var Summary = HTMLPropsMixin(HTMLElement).define("html-summary", {
  extends: "summary"
});
var Slot = HTMLPropsMixin(HTMLSlotElement).define("html-slot", {
  extends: "slot"
});
var Template = HTMLPropsMixin(HTMLTemplateElement).define("html-template", {
  extends: "template"
});
var Thead = TableHead;
var Tbody = TableBody;
var Tr = TableRow;
var Th = TableHeader;
var Td = TableData;
var Textarea = TextArea;

// src/layout/flex_types.ts
var MainAxisAlignment = {
  start: "flex-start",
  end: "flex-end",
  center: "center",
  spaceBetween: "space-between",
  spaceAround: "space-around",
  spaceEvenly: "space-evenly"
};
var CrossAxisAlignment = {
  start: "flex-start",
  end: "flex-end",
  center: "center",
  stretch: "stretch",
  baseline: "baseline"
};

// src/layout/row.ts
var config = {
  mainAxisAlignment: prop("start"),
  crossAxisAlignment: prop("stretch"),
  gap: prop("0"),
  wrap: prop("nowrap"),
  style: {
    display: "flex",
    flexDirection: "row"
  }
};
var RowBase = HTMLPropsMixin(HTMLElement, config);
var Row = class extends RowBase {
  render() {
    const main2 = this.mainAxisAlignment;
    this.style.justifyContent = MainAxisAlignment[main2] || main2;
    const cross = this.crossAxisAlignment;
    this.style.alignItems = CrossAxisAlignment[cross] || cross;
    this.style.gap = this.gap;
    this.style.flexWrap = this.wrap;
  }
};
Row.define("layout-row");

// src/layout/stack.ts
var Alignment = {
  topLeft: "start start",
  topCenter: "start center",
  topRight: "start end",
  centerLeft: "center start",
  center: "center center",
  centerRight: "center end",
  bottomLeft: "end start",
  bottomCenter: "end center",
  bottomRight: "end end"
};
var config2 = {
  alignment: prop("topLeft"),
  style: {
    display: "grid",
    gridTemplateAreas: '"stack"'
  }
};
var StackBase = HTMLPropsMixin(HTMLElement, config2);
var Stack = class extends StackBase {
  _observer;
  connectedCallback() {
    super.connectedCallback();
    this.updateChildren();
    this._observer = new MutationObserver(() => this.updateChildren());
    this._observer.observe(this, {
      childList: true
    });
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this._observer?.disconnect();
  }
  updateChildren() {
    Array.from(this.children).forEach((child) => {
      if (child instanceof HTMLElement) {
        child.style.gridArea = "stack";
      }
    });
  }
  render() {
    const align = this.alignment;
    this.style.placeItems = Alignment[align] || align;
  }
};
Stack.define("layout-stack");

// src/layout/center.ts
var config3 = {
  style: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%"
  }
};
var CenterBase = HTMLPropsMixin(HTMLElement, config3);
var Center = class extends CenterBase {
};
Center.define("layout-center");

// src/layout/padding.ts
var config4 = {
  padding: prop("0"),
  style: {
    display: "block"
  }
};
var PaddingBase = HTMLPropsMixin(HTMLElement, config4);
var Padding = class extends PaddingBase {
  render() {
    this.style.padding = this.padding;
  }
};
Padding.define("layout-padding");

// src/layout/column.ts
var config5 = {
  mainAxisAlignment: prop("start"),
  crossAxisAlignment: prop("stretch"),
  gap: prop("0"),
  wrap: prop("nowrap"),
  style: {
    display: "flex",
    flexDirection: "column"
  }
};
var ColumnBase = HTMLPropsMixin(HTMLElement, config5);
var Column = class extends ColumnBase {
  render() {
    const main2 = this.mainAxisAlignment;
    this.style.justifyContent = MainAxisAlignment[main2] || main2;
    const cross = this.crossAxisAlignment;
    this.style.alignItems = CrossAxisAlignment[cross] || cross;
    this.style.gap = this.gap;
    this.style.flexWrap = this.wrap;
  }
};
Column.define("layout-column");

// src/layout/container.ts
var config6 = {
  width: prop(""),
  height: prop(""),
  padding: prop(""),
  margin: prop(""),
  color: prop(""),
  border: prop(""),
  radius: prop(""),
  alignment: prop(""),
  shadow: prop(""),
  style: {
    display: "block",
    boxSizing: "border-box"
  }
};
var ContainerBase = HTMLPropsMixin(HTMLElement, config6);
var Container = class extends ContainerBase {
  render() {
    const w = this.width;
    if (w) this.style.width = w;
    const h = this.height;
    if (h) this.style.height = h;
    const p = this.padding;
    if (p) this.style.padding = p;
    const m = this.margin;
    if (m) this.style.margin = m;
    const c = this.color;
    if (c) this.style.backgroundColor = c;
    const b = this.border;
    if (b) this.style.border = b;
    const r = this.radius;
    if (r) this.style.borderRadius = r;
    const s = this.shadow;
    if (s) this.style.boxShadow = s;
    const align = this.alignment;
    if (align) {
      this.style.display = "flex";
      const cssAlign = Alignment[align] || align;
      if (cssAlign === "center center") {
        this.style.justifyContent = "center";
        this.style.alignItems = "center";
      } else if (cssAlign === "start start") {
        this.style.justifyContent = "flex-start";
        this.style.alignItems = "flex-start";
      }
      this.style.display = "grid";
      this.style.placeItems = cssAlign;
    }
  }
};
Container.define("layout-container");

// src/layout/sized_box.ts
var config7 = {
  width: prop(""),
  height: prop(""),
  style: {
    display: "block"
  }
};
var SizedBoxBase = HTMLPropsMixin(HTMLElement, config7);
var SizedBox = class extends SizedBoxBase {
  render() {
    const w = this.width;
    const h = this.height;
    if (w) this.style.width = w;
    if (h) this.style.height = h;
  }
};
SizedBox.define("layout-sized-box");

// src/layout/grid.ts
var config8 = {
  columns: prop("1fr"),
  rows: prop("auto"),
  gap: prop("0"),
  style: {
    display: "grid"
  }
};
var GridBase = HTMLPropsMixin(HTMLElement, config8);
var Grid = class extends GridBase {
  render() {
    this.style.gridTemplateColumns = this.columns;
    this.style.gridTemplateRows = this.rows;
    this.style.gap = this.gap;
  }
};
Grid.define("layout-grid");

// src/layout/media_query.ts
var hasWindow = typeof window !== "undefined";
var MediaQueryService = class {
  width = signal(hasWindow ? window.innerWidth || 1024 : 1024);
  height = signal(hasWindow ? window.innerHeight || 768 : 768);
  devicePixelRatio = signal(hasWindow ? window.devicePixelRatio || 1 : 1);
  isMobile = computed(() => this.width() < 768);
  isTablet = computed(() => this.width() >= 768 && this.width() < 1024);
  isDesktop = computed(() => this.width() >= 1024);
  constructor() {
    if (hasWindow) {
      window.addEventListener("resize", () => {
        this.width.set(window.innerWidth);
        this.height.set(window.innerHeight);
        this.devicePixelRatio.set(window.devicePixelRatio);
      });
    }
  }
};
var MediaQuery = new MediaQueryService();

// src/layout/responsive.ts
var config9 = {
  mobile: prop(null),
  tablet: prop(null),
  desktop: prop(null)
};
var ResponsiveBase = HTMLPropsMixin(HTMLElement, config9);
var Responsive = class extends ResponsiveBase {
  render() {
    if (MediaQuery.isMobile()) {
      return this.mobile || this.tablet || this.desktop;
    }
    if (MediaQuery.isTablet()) {
      return this.tablet || this.desktop || this.mobile;
    }
    return this.desktop || this.tablet || this.mobile;
  }
};
Responsive.define("layout-responsive");

// src/layout/layout_builder.ts
var config10 = {
  builder: {
    type: Function
  }
};
var LayoutBuilderBase = HTMLPropsMixin(HTMLElement, config10);
var LayoutBuilder = class extends LayoutBuilderBase {
  _width = signal(0);
  _height = signal(0);
  _observer = null;
  connectedCallback() {
    super.connectedCallback();
    this.style.display = "block";
    this.style.width = "100%";
    this.style.height = "100%";
    if (typeof ResizeObserver !== "undefined") {
      this._observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          this._width.set(entry.contentRect.width);
          this._height.set(entry.contentRect.height);
        }
      });
      this._observer.observe(this);
    }
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
  }
  render() {
    if (this.builder) {
      return this.builder({
        width: this._width(),
        height: this._height()
      });
    }
    return null;
  }
};
LayoutBuilder.define("layout-builder");

// src/alexi_admin/app/services/admin_config.ts
var _cachedConfig = null;
var _cachedModels = /* @__PURE__ */ new Map();
function getApiUrl() {
  return globalThis.location?.origin ?? "http://localhost:8000";
}
async function fetchAdminConfig() {
  if (_cachedConfig) {
    return _cachedConfig;
  }
  const response = await fetch(`${getApiUrl()}/admin/api/config/`, {
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include"
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch admin config: ${response.status}`);
  }
  const config11 = await response.json();
  _cachedConfig = config11;
  for (const model of config11.models) {
    _cachedModels.set(model.name.toLowerCase(), model);
  }
  return config11;
}
async function fetchModelConfig(modelName) {
  const lowerName = modelName.toLowerCase();
  if (_cachedModels.has(lowerName)) {
    return _cachedModels.get(lowerName);
  }
  if (_cachedConfig) {
    const model2 = _cachedConfig.models.find((m) => m.name.toLowerCase() === lowerName);
    if (model2) {
      _cachedModels.set(lowerName, model2);
      return model2;
    }
    return null;
  }
  const response = await fetch(`${getApiUrl()}/admin/api/config/models/${modelName}/`, {
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include"
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch model config: ${response.status}`);
  }
  const model = await response.json();
  _cachedModels.set(lowerName, model);
  return model;
}

// src/alexi_admin/app/views/dashboard.ts
var AdminDashboard = class extends HTMLPropsMixin(HTMLElement, {
  app: prop(null),
  // Config loaded from API
  config: prop(null),
  // Loading state
  isLoading: prop(true),
  // Error message
  errorMessage: prop(""),
  // Styling
  style: {
    display: "block",
    flex: "1"
  }
}) {
  // ===========================================================================
  // Lifecycle
  // ===========================================================================
  mountedCallback() {
    this.loadConfig();
  }
  // ===========================================================================
  // Data Loading
  // ===========================================================================
  async loadConfig() {
    this.isLoading = true;
    this.errorMessage = "";
    try {
      const config11 = await fetchAdminConfig();
      this.config = config11;
      if (this.app && config11.siteTitle) {
        this.app.siteTitle = config11.siteTitle;
      }
    } catch (error) {
      console.error("[AdminDashboard] Failed to load config:", error);
      this.errorMessage = error instanceof Error ? error.message : "Failed to load admin configuration";
    } finally {
      this.isLoading = false;
    }
  }
  // ===========================================================================
  // Event Handlers
  // ===========================================================================
  handleModelClick = (modelName) => {
    navigateTo(`/admin/${modelName}/`);
  };
  handleAddClick = (modelName, event) => {
    event.stopPropagation();
    event.preventDefault();
    navigateTo(`/admin/${modelName}/add/`);
  };
  // ===========================================================================
  // Render
  // ===========================================================================
  render() {
    if (this.isLoading) {
      return this.renderLoading();
    }
    if (this.errorMessage) {
      return this.renderError();
    }
    if (!this.config || this.config.models.length === 0) {
      return this.renderEmpty();
    }
    return new Container({
      dataset: {
        key: "dashboard"
      },
      padding: "24px",
      style: {
        maxWidth: "1400px",
        margin: "0 auto"
      },
      content: new Column({
        gap: "24px",
        content: [
          new Heading2({
            dataset: {
              key: "title"
            },
            textContent: "Site Administration",
            style: {
              fontSize: "24px",
              fontWeight: "600",
              margin: "0",
              color: "#333333"
            }
          }),
          this.renderModelGrid()
        ]
      })
    });
  }
  renderModelGrid() {
    const models = this.config?.models ?? [];
    return new Div({
      dataset: {
        key: "model-grid"
      },
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: "24px"
      },
      content: models.map((model) => this.renderModelCard(model))
    });
  }
  renderModelCard(model) {
    return new Container({
      dataset: {
        key: `model-${model.name}`
      },
      style: {
        backgroundColor: "#ffffff",
        border: "1px solid #cccccc",
        borderRadius: "8px",
        overflow: "hidden"
      },
      content: new Column({
        content: [
          // Header
          new Div({
            dataset: {
              key: `header-${model.name}`
            },
            style: {
              backgroundColor: "#417690",
              color: "#ffffff",
              padding: "12px 16px",
              fontWeight: "600",
              fontSize: "16px"
            },
            textContent: model.verboseNamePlural
          }),
          // Body with links
          new Div({
            dataset: {
              key: `body-${model.name}`
            },
            style: {
              padding: "16px"
            },
            content: [
              // View all link
              new Anchor({
                dataset: {
                  key: `view-${model.name}`
                },
                href: `/admin/${model.name}/`,
                onclick: (e) => {
                  e.preventDefault();
                  this.handleModelClick(model.name);
                },
                style: {
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 12px",
                  margin: "4px 0",
                  borderRadius: "4px",
                  color: "#333333",
                  textDecoration: "none"
                },
                content: [
                  new Div({
                    style: {
                      width: "24px",
                      marginRight: "12px",
                      color: "#666666"
                    },
                    textContent: "\u{1F4CB}"
                  }),
                  new Div({
                    textContent: `View all ${model.verboseNamePlural.toLowerCase()}`
                  })
                ]
              }),
              // Add new link
              new Anchor({
                dataset: {
                  key: `add-${model.name}`
                },
                href: `/admin/${model.name}/add/`,
                onclick: (e) => {
                  this.handleAddClick(model.name, e);
                },
                style: {
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 12px",
                  margin: "4px 0",
                  borderRadius: "4px",
                  color: "#333333",
                  textDecoration: "none"
                },
                content: [
                  new Div({
                    style: {
                      width: "24px",
                      marginRight: "12px",
                      color: "#666666"
                    },
                    textContent: "\u2795"
                  }),
                  new Div({
                    textContent: `Add new ${model.verboseName.toLowerCase()}`
                  })
                ]
              })
            ]
          })
        ]
      })
    });
  }
  renderLoading() {
    return new Container({
      dataset: {
        key: "loading"
      },
      padding: "48px",
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "1"
      },
      content: new Column({
        gap: "16px",
        crossAxisAlignment: "center",
        content: [
          new Div({
            dataset: {
              key: "spinner"
            },
            style: {
              width: "32px",
              height: "32px",
              border: "3px solid #eeeeee",
              borderTopColor: "#417690",
              borderRadius: "50%",
              animation: "admin-spin 0.8s linear infinite"
            }
          }),
          new Span({
            dataset: {
              key: "loading-text"
            },
            style: {
              color: "#666666",
              fontSize: "14px"
            },
            textContent: "Loading..."
          })
        ]
      })
    });
  }
  renderError() {
    return new Container({
      dataset: {
        key: "error"
      },
      padding: "48px",
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "1"
      },
      content: new Column({
        gap: "16px",
        crossAxisAlignment: "center",
        content: [
          new Span({
            dataset: {
              key: "error-icon"
            },
            style: {
              fontSize: "48px"
            },
            textContent: "\u26A0\uFE0F"
          }),
          new Span({
            dataset: {
              key: "error-message"
            },
            style: {
              color: "#ba2121",
              fontSize: "14px",
              textAlign: "center"
            },
            textContent: this.errorMessage
          }),
          new Anchor({
            dataset: {
              key: "retry-link"
            },
            href: "#",
            onclick: (e) => {
              e.preventDefault();
              this.loadConfig();
            },
            style: {
              color: "#417690",
              textDecoration: "none"
            },
            textContent: "Try again"
          })
        ]
      })
    });
  }
  renderEmpty() {
    return new Container({
      dataset: {
        key: "empty"
      },
      padding: "48px",
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "1"
      },
      content: new Column({
        gap: "16px",
        crossAxisAlignment: "center",
        content: [
          new Span({
            dataset: {
              key: "empty-icon"
            },
            style: {
              fontSize: "48px"
            },
            textContent: "\u{1F4ED}"
          }),
          new Span({
            dataset: {
              key: "empty-message"
            },
            style: {
              color: "#666666",
              fontSize: "14px"
            },
            textContent: "No models registered"
          })
        ]
      })
    });
  }
};
AdminDashboard.define("admin-dashboard");

// src/alexi_admin/app/services/auth.ts
var ADMIN_TOKENS_KEY = "alexi_admin_tokens";
var ADMIN_USER_KEY = "alexi_admin_user";
function getApiUrl2() {
  return globalThis.location?.origin ?? "http://localhost:8000";
}
function calculateExpiresAt(expiresIn) {
  const expiresAt = /* @__PURE__ */ new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);
  return expiresAt.toISOString();
}
function saveTokens(tokens) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(ADMIN_TOKENS_KEY, JSON.stringify(tokens));
  } catch (error) {
    console.warn("[AdminAuth] Failed to save tokens:", error);
  }
}
function loadTokens() {
  if (typeof localStorage === "undefined") return null;
  try {
    const stored = localStorage.getItem(ADMIN_TOKENS_KEY);
    if (!stored) return null;
    const tokens = JSON.parse(stored);
    if (new Date(tokens.expiresAt) <= /* @__PURE__ */ new Date()) {
      clearTokens();
      return null;
    }
    return tokens;
  } catch (error) {
    console.warn("[AdminAuth] Failed to load tokens:", error);
    return null;
  }
}
function clearTokens() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(ADMIN_TOKENS_KEY);
  } catch (error) {
    console.warn("[AdminAuth] Failed to clear tokens:", error);
  }
}
function saveUser(user) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.warn("[AdminAuth] Failed to save user:", error);
  }
}
function loadUser() {
  if (typeof localStorage === "undefined") return null;
  try {
    const stored = localStorage.getItem(ADMIN_USER_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.warn("[AdminAuth] Failed to load user:", error);
    return null;
  }
}
function clearUser() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(ADMIN_USER_KEY);
  } catch (error) {
    console.warn("[AdminAuth] Failed to clear user:", error);
  }
}
async function login(credentials) {
  const response = await fetch(`${getApiUrl2()}/api/auth/login/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(credentials)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || error.message || `Login failed: ${response.status}`);
  }
  const data = await response.json();
  const user = {
    id: String(data.user.id),
    email: data.user.email,
    firstName: data.user.first_name || data.user.firstName || "",
    lastName: data.user.last_name || data.user.lastName || "",
    isAdmin: data.user.is_admin ?? data.user.isAdmin ?? false
  };
  if (!user.isAdmin) {
    throw new Error("Access denied. Admin privileges required.");
  }
  const tokens = {
    accessToken: data.tokens.accessToken,
    refreshToken: data.tokens.refreshToken,
    expiresAt: calculateExpiresAt(data.tokens.expiresIn)
  };
  saveTokens(tokens);
  saveUser(user);
  return {
    user,
    tokens: data.tokens
  };
}
async function logout() {
  const tokens = loadTokens();
  if (tokens) {
    try {
      await fetch(`${getApiUrl2()}/api/auth/logout/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokens.accessToken}`
        }
      });
    } catch (error) {
      console.warn("[AdminAuth] Logout request failed:", error);
    }
  }
  clearTokens();
  clearUser();
}
function getAuthState() {
  const tokens = loadTokens();
  const user = loadUser();
  if (!tokens || !user) {
    return {
      isAuthenticated: false,
      isAdmin: false,
      user: null,
      tokens: null
    };
  }
  return {
    isAuthenticated: true,
    isAdmin: user.isAdmin,
    user,
    tokens
  };
}
function getAccessToken() {
  const tokens = loadTokens();
  return tokens?.accessToken ?? null;
}
async function refreshToken() {
  const currentTokens = loadTokens();
  if (!currentTokens?.refreshToken) {
    return null;
  }
  try {
    const response = await fetch(`${getApiUrl2()}/api/auth/refresh/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        refreshToken: currentTokens.refreshToken
      })
    });
    if (!response.ok) {
      clearTokens();
      clearUser();
      return null;
    }
    const data = await response.json();
    const tokens = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || currentTokens.refreshToken,
      expiresAt: calculateExpiresAt(data.expiresIn || 3600)
    };
    saveTokens(tokens);
    return tokens;
  } catch (error) {
    console.warn("[AdminAuth] Token refresh failed:", error);
    clearTokens();
    clearUser();
    return null;
  }
}
async function authenticatedFetch(url, options = {}) {
  let token = getAccessToken();
  if (!token) {
    const newTokens = await refreshToken();
    token = newTokens?.accessToken ?? null;
  }
  if (!token) {
    throw new Error("Not authenticated");
  }
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, {
    ...options,
    headers
  });
  if (response.status === 401) {
    const newTokens = await refreshToken();
    if (newTokens) {
      headers.set("Authorization", `Bearer ${newTokens.accessToken}`);
      return fetch(url, {
        ...options,
        headers
      });
    }
  }
  return response;
}

// src/alexi_admin/app/views/model_list.ts
var AdminModelList = class extends HTMLPropsMixin(HTMLElement, {
  app: prop(null),
  modelName: prop(""),
  // Config loaded from API
  config: prop(null),
  // Data state
  data: prop([]),
  // Loading & errors
  isLoading: prop(true),
  errorMessage: prop(""),
  // Styling
  style: {
    display: "block",
    flex: "1"
  }
}) {
  // ===========================================================================
  // Lifecycle
  // ===========================================================================
  mountedCallback() {
    this.loadData();
  }
  // ===========================================================================
  // Data Loading
  // ===========================================================================
  async loadData() {
    this.isLoading = true;
    this.errorMessage = "";
    try {
      const config11 = await fetchModelConfig(this.modelName);
      if (!config11) {
        this.errorMessage = `Unknown model: ${this.modelName}`;
        this.isLoading = false;
        return;
      }
      this.config = config11;
      const url = new URL(config11.apiEndpoint, globalThis.location.origin);
      const response = await authenticatedFetch(url.toString(), {
        headers: {
          "Content-Type": "application/json"
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      if (Array.isArray(result)) {
        this.data = result;
      } else if (result.results) {
        this.data = result.results;
      } else {
        this.data = [];
      }
    } catch (error) {
      console.error("[AdminModelList] Failed to load data:", error);
      this.errorMessage = error instanceof Error ? error.message : "Failed to load data";
    } finally {
      this.isLoading = false;
    }
  }
  // ===========================================================================
  // Event Handlers
  // ===========================================================================
  handleRowClick = (id) => {
    navigateTo(`/admin/${this.modelName}/${id}/`);
  };
  handleAddClick = (event) => {
    event.preventDefault();
    navigateTo(`/admin/${this.modelName}/add/`);
  };
  // ===========================================================================
  // Render
  // ===========================================================================
  render() {
    if (this.isLoading) {
      return this.renderLoading();
    }
    if (this.errorMessage && !this.config) {
      return this.renderError(this.errorMessage);
    }
    if (!this.config) {
      return this.renderError(`Unknown model: ${this.modelName}`);
    }
    return new Container({
      dataset: {
        key: "model-list"
      },
      padding: "24px",
      style: {
        maxWidth: "1400px",
        margin: "0 auto"
      },
      content: new Column({
        gap: "24px",
        content: [
          this.renderHeader(),
          this.renderContent()
        ]
      })
    });
  }
  renderHeader() {
    const config11 = this.config;
    return new Row({
      dataset: {
        key: "header"
      },
      mainAxisAlignment: "spaceBetween",
      crossAxisAlignment: "center",
      content: [
        new Heading2({
          dataset: {
            key: "title"
          },
          textContent: `Select ${config11.verboseName.toLowerCase()} to change`,
          style: {
            fontSize: "24px",
            fontWeight: "600",
            margin: "0",
            color: "#333333"
          }
        }),
        new Anchor({
          dataset: {
            key: "add-button"
          },
          href: `/admin/${this.modelName}/add/`,
          onclick: this.handleAddClick,
          style: {
            display: "inline-flex",
            alignItems: "center",
            padding: "8px 16px",
            borderRadius: "4px",
            backgroundColor: "#417690",
            color: "#ffffff",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: "500"
          },
          textContent: `+ Add ${config11.verboseName.toLowerCase()}`
        })
      ]
    });
  }
  renderContent() {
    const config11 = this.config;
    if (this.errorMessage) {
      return this.renderError(this.errorMessage);
    }
    if (this.data.length === 0) {
      return this.renderEmpty();
    }
    return this.renderTable();
  }
  renderTable() {
    const config11 = this.config;
    return new Container({
      dataset: {
        key: "table-container"
      },
      style: {
        backgroundColor: "#ffffff",
        border: "1px solid #cccccc",
        borderRadius: "8px",
        overflow: "hidden"
      },
      content: new Table({
        dataset: {
          key: "table"
        },
        style: {
          width: "100%",
          borderCollapse: "collapse"
        },
        content: [
          // Table header
          new Thead({
            dataset: {
              key: "thead"
            },
            style: {
              backgroundColor: "#f8f8f8"
            },
            content: new Tr({
              dataset: {
                key: "header-row"
              },
              content: config11.columns.map((col) => new Th({
                dataset: {
                  key: `th-${col.field}`
                },
                style: {
                  padding: "12px 16px",
                  textAlign: "left",
                  fontWeight: "600",
                  fontSize: "12px",
                  textTransform: "uppercase",
                  color: "#333333",
                  borderBottom: "2px solid #cccccc"
                },
                textContent: col.label
              }))
            })
          }),
          // Table body
          new Tbody({
            dataset: {
              key: "tbody"
            },
            content: this.data.map((row) => this.renderRow(row))
          })
        ]
      })
    });
  }
  renderRow(row) {
    const config11 = this.config;
    const id = String(row.id ?? "");
    return new Tr({
      dataset: {
        key: `row-${id}`
      },
      style: {
        cursor: "pointer"
      },
      onclick: () => this.handleRowClick(id),
      content: config11.columns.map((col) => {
        const value = row[col.field];
        const displayValue = this.formatValue(value);
        return new Td({
          dataset: {
            key: `td-${col.field}`
          },
          style: {
            padding: "12px 16px",
            borderBottom: "1px solid #eeeeee",
            color: "#333333"
          },
          content: col.isLink ? new Anchor({
            href: `/admin/${this.modelName}/${id}/`,
            onclick: (e) => {
              e.preventDefault();
              e.stopPropagation();
              this.handleRowClick(id);
            },
            style: {
              color: "#417690",
              fontWeight: "500",
              textDecoration: "none"
            },
            textContent: displayValue
          }) : new Span({
            textContent: displayValue
          })
        });
      })
    });
  }
  renderLoading() {
    return new Container({
      dataset: {
        key: "loading"
      },
      padding: "48px",
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffffff",
        borderRadius: "8px",
        border: "1px solid #cccccc"
      },
      content: new Column({
        gap: "16px",
        crossAxisAlignment: "center",
        content: [
          new Div({
            dataset: {
              key: "spinner"
            },
            style: {
              width: "32px",
              height: "32px",
              border: "3px solid #eeeeee",
              borderTopColor: "#417690",
              borderRadius: "50%",
              animation: "admin-spin 0.8s linear infinite"
            }
          }),
          new Span({
            dataset: {
              key: "loading-text"
            },
            style: {
              color: "#666666",
              fontSize: "14px"
            },
            textContent: "Loading..."
          })
        ]
      })
    });
  }
  renderEmpty() {
    const config11 = this.config;
    return new Container({
      dataset: {
        key: "empty"
      },
      padding: "48px",
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffffff",
        borderRadius: "8px",
        border: "1px solid #cccccc"
      },
      content: new Column({
        gap: "16px",
        crossAxisAlignment: "center",
        content: [
          new Span({
            dataset: {
              key: "empty-icon"
            },
            style: {
              fontSize: "48px"
            },
            textContent: "\u{1F4CB}"
          }),
          new Span({
            dataset: {
              key: "empty-message"
            },
            style: {
              color: "#666666",
              fontSize: "14px"
            },
            textContent: `No ${config11.verboseNamePlural.toLowerCase()} found`
          })
        ]
      })
    });
  }
  renderError(message) {
    return new Container({
      dataset: {
        key: "error"
      },
      padding: "48px",
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff5f5",
        borderRadius: "8px",
        border: "1px solid #ffcccc"
      },
      content: new Column({
        gap: "16px",
        crossAxisAlignment: "center",
        content: [
          new Span({
            dataset: {
              key: "error-icon"
            },
            style: {
              fontSize: "48px"
            },
            textContent: "\u26A0\uFE0F"
          }),
          new Span({
            dataset: {
              key: "error-message"
            },
            style: {
              color: "#ba2121",
              fontSize: "14px"
            },
            textContent: message
          })
        ]
      })
    });
  }
  // ===========================================================================
  // Helpers
  // ===========================================================================
  formatValue(value) {
    if (value === null || value === void 0) {
      return "-";
    }
    if (typeof value === "boolean") {
      return value ? "\u2713" : "\u2717";
    }
    if (value instanceof Date) {
      return value.toLocaleString();
    }
    if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
      return new Date(value).toLocaleString();
    }
    return String(value);
  }
};
AdminModelList.define("admin-model-list");

// src/alexi_admin/app/views/model_detail.ts
var AdminModelDetail = class extends HTMLPropsMixin(HTMLElement, {
  app: prop(null),
  modelName: prop(""),
  objectId: prop(""),
  // Config loaded from API
  config: prop(null),
  // Form data
  formData: prop({}),
  // State
  isLoading: prop(true),
  isSaving: prop(false),
  errorMessage: prop(""),
  successMessage: prop(""),
  // Styling
  style: {
    display: "block",
    flex: "1"
  }
}) {
  // ===========================================================================
  // Computed
  // ===========================================================================
  get isAddMode() {
    return !this.objectId;
  }
  // ===========================================================================
  // Lifecycle
  // ===========================================================================
  mountedCallback() {
    this.loadConfig();
  }
  // ===========================================================================
  // Data Loading
  // ===========================================================================
  async loadConfig() {
    this.isLoading = true;
    this.errorMessage = "";
    try {
      const config11 = await fetchModelConfig(this.modelName);
      if (!config11) {
        this.errorMessage = `Unknown model: ${this.modelName}`;
        this.isLoading = false;
        return;
      }
      this.config = config11;
      if (!this.isAddMode) {
        await this.loadObjectData();
      } else {
        this.formData = {};
        this.isLoading = false;
      }
    } catch (error) {
      console.error("[AdminModelDetail] Failed to load config:", error);
      this.errorMessage = error instanceof Error ? error.message : "Failed to load configuration";
      this.isLoading = false;
    }
  }
  async loadObjectData() {
    const config11 = this.config;
    if (!config11) return;
    try {
      const url = `${config11.apiEndpoint}${this.objectId}/`;
      const response = await authenticatedFetch(url, {
        headers: {
          "Content-Type": "application/json"
        }
      });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`${config11.verboseName} not found`);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      this.formData = await response.json();
    } catch (error) {
      console.error("[AdminModelDetail] Failed to load data:", error);
      this.errorMessage = error instanceof Error ? error.message : "Failed to load data";
    } finally {
      this.isLoading = false;
    }
  }
  // ===========================================================================
  // Form Handling
  // ===========================================================================
  handleFieldChange = (fieldName, value) => {
    this.formData = {
      ...this.formData,
      [fieldName]: value
    };
  };
  handleSubmit = async (event) => {
    event.preventDefault();
    const config11 = this.config;
    if (!config11) return;
    this.isSaving = true;
    this.errorMessage = "";
    this.successMessage = "";
    try {
      const data = {};
      for (const field of config11.fields) {
        if (!field.readOnly && field.type !== "readonly") {
          data[field.name] = this.formData[field.name];
        }
      }
      const url = this.isAddMode ? config11.apiEndpoint : `${config11.apiEndpoint}${this.objectId}/`;
      const response = await authenticatedFetch(url, {
        method: this.isAddMode ? "POST" : "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      if (this.isAddMode) {
        const newId = result.id;
        navigateTo(`/admin/${this.modelName}/${newId}/`);
      } else {
        this.formData = result;
        this.successMessage = "Changes saved successfully";
      }
    } catch (error) {
      console.error("[AdminModelDetail] Failed to save:", error);
      this.errorMessage = error instanceof Error ? error.message : "Failed to save";
    } finally {
      this.isSaving = false;
    }
  };
  handleDelete = async () => {
    const config11 = this.config;
    if (!config11 || this.isAddMode) return;
    if (!confirm(`Are you sure you want to delete this ${config11.verboseName.toLowerCase()}?`)) {
      return;
    }
    this.isSaving = true;
    this.errorMessage = "";
    try {
      const url = `${config11.apiEndpoint}${this.objectId}/`;
      const response = await authenticatedFetch(url, {
        method: "DELETE"
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      navigateTo(`/admin/${this.modelName}/`);
    } catch (error) {
      console.error("[AdminModelDetail] Failed to delete:", error);
      this.errorMessage = error instanceof Error ? error.message : "Failed to delete";
      this.isSaving = false;
    }
  };
  handleCancel = (event) => {
    event.preventDefault();
    navigateTo(`/admin/${this.modelName}/`);
  };
  // ===========================================================================
  // Render
  // ===========================================================================
  render() {
    if (this.isLoading) {
      return this.renderLoading();
    }
    if (this.errorMessage && !this.config) {
      return this.renderError(this.errorMessage);
    }
    if (!this.config) {
      return this.renderError(`Unknown model: ${this.modelName}`);
    }
    return new Container({
      dataset: {
        key: "model-detail"
      },
      padding: "24px",
      style: {
        maxWidth: "800px",
        margin: "0 auto"
      },
      content: new Column({
        gap: "24px",
        content: [
          this.renderHeader(),
          this.renderMessages(),
          this.renderForm()
        ]
      })
    });
  }
  renderHeader() {
    const config11 = this.config;
    const title = this.isAddMode ? `Add ${config11.verboseName.toLowerCase()}` : `Change ${config11.verboseName.toLowerCase()}`;
    return new Heading2({
      dataset: {
        key: "title"
      },
      textContent: title,
      style: {
        fontSize: "24px",
        fontWeight: "600",
        margin: "0",
        color: "#333333"
      }
    });
  }
  renderMessages() {
    const messages = [];
    if (this.errorMessage) {
      messages.push(new Container({
        dataset: {
          key: "error-message"
        },
        padding: "12px 16px",
        radius: "4px",
        style: {
          backgroundColor: "#fff5f5",
          border: "1px solid #ffcccc"
        },
        content: new Span({
          style: {
            color: "#ba2121"
          },
          textContent: this.errorMessage
        })
      }));
    }
    if (this.successMessage) {
      messages.push(new Container({
        dataset: {
          key: "success-message"
        },
        padding: "12px 16px",
        radius: "4px",
        style: {
          backgroundColor: "#f0fff0",
          border: "1px solid #99cc99"
        },
        content: new Span({
          style: {
            color: "#006600"
          },
          textContent: this.successMessage
        })
      }));
    }
    return new Column({
      dataset: {
        key: "messages"
      },
      gap: "8px",
      content: messages
    });
  }
  renderForm() {
    const config11 = this.config;
    return new Container({
      dataset: {
        key: "form-container"
      },
      padding: "24px",
      radius: "8px",
      color: "#ffffff",
      style: {
        border: "1px solid #cccccc"
      },
      content: new Form({
        dataset: {
          key: "form"
        },
        onsubmit: this.handleSubmit,
        content: new Column({
          gap: "20px",
          content: [
            // Fields
            ...config11.fields.map((field) => this.renderField(field)),
            // Actions
            this.renderActions()
          ]
        })
      })
    });
  }
  renderField(field) {
    const value = this.formData[field.name];
    const isReadonly = field.readOnly || field.type === "readonly";
    return new Column({
      dataset: {
        key: `field-${field.name}`
      },
      gap: "6px",
      content: [
        // Label
        new Label({
          htmlFor: `field-${field.name}`,
          style: {
            fontSize: "13px",
            fontWeight: "600",
            color: "#333333"
          },
          textContent: field.label + (field.required ? " *" : "")
        }),
        // Input based on type
        this.renderFieldInput(field, value, isReadonly)
      ]
    });
  }
  renderFieldInput(field, value, isReadonly) {
    const commonStyle = {
      width: "100%",
      padding: "8px 12px",
      fontSize: "14px",
      border: "1px solid #cccccc",
      borderRadius: "4px",
      backgroundColor: isReadonly ? "#f5f5f5" : "#ffffff"
    };
    const fieldType = field.type.toLowerCase();
    if (fieldType === "readonly" || isReadonly) {
      return new Div({
        dataset: {
          key: `input-${field.name}`
        },
        style: {
          ...commonStyle,
          color: "#666666"
        },
        textContent: this.formatValue(value)
      });
    }
    if (fieldType === "textarea") {
      return new Textarea({
        id: `field-${field.name}`,
        dataset: {
          key: `input-${field.name}`
        },
        value: String(value ?? ""),
        disabled: this.isSaving,
        rows: 4,
        style: {
          ...commonStyle,
          resize: "vertical"
        },
        oninput: (e) => {
          const target = e.target;
          this.handleFieldChange(field.name, target.value);
        }
      });
    }
    if (fieldType === "boolean") {
      return new Row({
        dataset: {
          key: `input-${field.name}`
        },
        gap: "8px",
        crossAxisAlignment: "center",
        content: [
          new Input({
            id: `field-${field.name}`,
            type: "checkbox",
            checked: Boolean(value),
            disabled: this.isSaving,
            style: {
              width: "18px",
              height: "18px",
              accentColor: "#417690"
            },
            onchange: (e) => {
              const target = e.target;
              this.handleFieldChange(field.name, target.checked);
            }
          }),
          new Span({
            style: {
              color: "#666666",
              fontSize: "13px"
            },
            textContent: value ? "Yes" : "No"
          })
        ]
      });
    }
    if (fieldType === "select" && field.choices) {
      const select = document.createElement("select");
      select.id = `field-${field.name}`;
      select.disabled = this.isSaving;
      Object.assign(select.style, commonStyle);
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "---------";
      select.appendChild(emptyOption);
      for (const choice of field.choices) {
        const option = document.createElement("option");
        option.value = choice.value;
        option.textContent = choice.label;
        option.selected = value === choice.value;
        select.appendChild(option);
      }
      select.addEventListener("change", () => {
        this.handleFieldChange(field.name, select.value || null);
      });
      return select;
    }
    if (fieldType === "datetime" || fieldType === "date") {
      return new Input({
        id: `field-${field.name}`,
        dataset: {
          key: `input-${field.name}`
        },
        type: fieldType === "datetime" ? "datetime-local" : "date",
        value: value ? String(value).slice(0, fieldType === "datetime" ? 16 : 10) : "",
        disabled: this.isSaving,
        style: commonStyle,
        oninput: (e) => {
          const target = e.target;
          this.handleFieldChange(field.name, target.value ? new Date(target.value).toISOString() : null);
        }
      });
    }
    if (fieldType === "number") {
      return new Input({
        id: `field-${field.name}`,
        dataset: {
          key: `input-${field.name}`
        },
        type: "number",
        value: value !== void 0 && value !== null ? String(value) : "",
        disabled: this.isSaving,
        style: commonStyle,
        oninput: (e) => {
          const target = e.target;
          this.handleFieldChange(field.name, target.value ? Number(target.value) : null);
        }
      });
    }
    if (fieldType === "email") {
      return new Input({
        id: `field-${field.name}`,
        dataset: {
          key: `input-${field.name}`
        },
        type: "email",
        value: String(value ?? ""),
        disabled: this.isSaving,
        required: field.required,
        style: commonStyle,
        oninput: (e) => {
          const target = e.target;
          this.handleFieldChange(field.name, target.value);
        }
      });
    }
    return new Input({
      id: `field-${field.name}`,
      dataset: {
        key: `input-${field.name}`
      },
      type: "text",
      value: String(value ?? ""),
      disabled: this.isSaving,
      required: field.required,
      style: commonStyle,
      oninput: (e) => {
        const target = e.target;
        this.handleFieldChange(field.name, target.value);
      }
    });
  }
  renderActions() {
    return new Row({
      dataset: {
        key: "actions"
      },
      mainAxisAlignment: "spaceBetween",
      crossAxisAlignment: "center",
      style: {
        marginTop: "16px",
        paddingTop: "16px",
        borderTop: "1px solid #eeeeee"
      },
      content: [
        // Delete button (only for existing records)
        this.isAddMode ? new Div({
          dataset: {
            key: "delete-spacer"
          }
        }) : new Button({
          dataset: {
            key: "delete-button"
          },
          type: "button",
          onclick: this.handleDelete,
          disabled: this.isSaving,
          style: {
            padding: "8px 16px",
            borderRadius: "4px",
            border: "none",
            backgroundColor: "#ba2121",
            color: "#ffffff",
            fontSize: "14px",
            fontWeight: "500",
            cursor: "pointer"
          },
          textContent: "Delete"
        }),
        // Save/Cancel buttons
        new Row({
          dataset: {
            key: "save-cancel"
          },
          gap: "12px",
          content: [
            new Anchor({
              dataset: {
                key: "cancel-button"
              },
              href: `/admin/${this.modelName}/`,
              onclick: this.handleCancel,
              style: {
                display: "inline-flex",
                alignItems: "center",
                padding: "8px 16px",
                borderRadius: "4px",
                backgroundColor: "#f0f0f0",
                color: "#333333",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: "500"
              },
              textContent: "Cancel"
            }),
            new Button({
              dataset: {
                key: "save-button"
              },
              type: "submit",
              disabled: this.isSaving,
              style: {
                padding: "8px 16px",
                borderRadius: "4px",
                border: "none",
                backgroundColor: "#417690",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer"
              },
              textContent: this.isSaving ? "Saving..." : "Save"
            })
          ]
        })
      ]
    });
  }
  renderLoading() {
    return new Container({
      dataset: {
        key: "loading"
      },
      padding: "48px",
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffffff",
        borderRadius: "8px",
        border: "1px solid #cccccc",
        maxWidth: "800px",
        margin: "24px auto"
      },
      content: new Column({
        gap: "16px",
        crossAxisAlignment: "center",
        content: [
          new Div({
            dataset: {
              key: "spinner"
            },
            style: {
              width: "32px",
              height: "32px",
              border: "3px solid #eeeeee",
              borderTopColor: "#417690",
              borderRadius: "50%",
              animation: "admin-spin 0.8s linear infinite"
            }
          }),
          new Span({
            dataset: {
              key: "loading-text"
            },
            style: {
              color: "#666666",
              fontSize: "14px"
            },
            textContent: "Loading..."
          })
        ]
      })
    });
  }
  renderError(message) {
    return new Container({
      dataset: {
        key: "error"
      },
      padding: "48px",
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff5f5",
        borderRadius: "8px",
        border: "1px solid #ffcccc",
        maxWidth: "800px",
        margin: "24px auto"
      },
      content: new Column({
        gap: "16px",
        crossAxisAlignment: "center",
        content: [
          new Span({
            dataset: {
              key: "error-icon"
            },
            style: {
              fontSize: "48px"
            },
            textContent: "\u26A0\uFE0F"
          }),
          new Span({
            dataset: {
              key: "error-message"
            },
            style: {
              color: "#ba2121",
              fontSize: "14px"
            },
            textContent: message
          }),
          new Anchor({
            dataset: {
              key: "back-link"
            },
            href: `/admin/${this.modelName}/`,
            onclick: this.handleCancel,
            style: {
              color: "#417690",
              textDecoration: "none"
            },
            textContent: "\u2190 Back to list"
          })
        ]
      })
    });
  }
  // ===========================================================================
  // Helpers
  // ===========================================================================
  formatValue(value) {
    if (value === null || value === void 0) {
      return "-";
    }
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }
    if (value instanceof Date) {
      return value.toLocaleString();
    }
    if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
      return new Date(value).toLocaleString();
    }
    return String(value);
  }
};
AdminModelDetail.define("admin-model-detail");

// src/alexi_admin/app/views/login.ts
var AdminLogin = class extends HTMLPropsMixin(HTMLElement, {
  // Form state
  email: prop(""),
  password: prop(""),
  // UI state
  isLoading: prop(false),
  errorMessage: prop(""),
  // Callback for successful login
  onLoginSuccess: prop(null),
  // Styling
  style: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    backgroundColor: "#417690",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  }
}) {
  // ===========================================================================
  // Event Handlers
  // ===========================================================================
  handleEmailInput = (event) => {
    const input = event.target;
    this.email = input.value;
    this.errorMessage = "";
  };
  handlePasswordInput = (event) => {
    const input = event.target;
    this.password = input.value;
    this.errorMessage = "";
  };
  handleSubmit = async (event) => {
    event.preventDefault();
    if (!this.email || !this.password) {
      this.errorMessage = "Please enter both email and password.";
      return;
    }
    this.isLoading = true;
    this.errorMessage = "";
    try {
      await login({
        email: this.email,
        password: this.password
      });
      this.email = "";
      this.password = "";
      if (this.onLoginSuccess) {
        this.onLoginSuccess();
      }
    } catch (error) {
      console.error("[AdminLogin] Login failed:", error);
      this.errorMessage = error instanceof Error ? error.message : "Login failed. Please try again.";
    } finally {
      this.isLoading = false;
    }
  };
  handleKeyDown = (event) => {
    if (event.key === "Enter" && !this.isLoading) {
      this.handleSubmit(event);
    }
  };
  // ===========================================================================
  // Render
  // ===========================================================================
  render() {
    return new Container({
      dataset: {
        key: "login-container"
      },
      style: {
        width: "100%",
        maxWidth: "400px",
        margin: "0 auto",
        padding: "20px"
      },
      content: new Column({
        gap: "0",
        content: [
          // Header
          this.renderHeader(),
          // Login form
          this.renderForm(),
          // Footer
          this.renderFooter()
        ]
      })
    });
  }
  renderHeader() {
    return new Container({
      dataset: {
        key: "login-header"
      },
      style: {
        backgroundColor: "#205067",
        padding: "20px 30px",
        borderRadius: "8px 8px 0 0",
        textAlign: "center"
      },
      content: new Column({
        gap: "8px",
        crossAxisAlignment: "center",
        content: [
          new Heading1({
            dataset: {
              key: "title"
            },
            textContent: "CoMachine Admin",
            style: {
              color: "#ffffff",
              fontSize: "24px",
              fontWeight: "600",
              margin: "0"
            }
          }),
          new Paragraph({
            dataset: {
              key: "subtitle"
            },
            textContent: "Sign in to manage your site",
            style: {
              color: "#79aec8",
              fontSize: "14px",
              margin: "0"
            }
          })
        ]
      })
    });
  }
  renderForm() {
    return new Container({
      dataset: {
        key: "login-form"
      },
      style: {
        backgroundColor: "#ffffff",
        padding: "30px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)"
      },
      content: new Form({
        dataset: {
          key: "form"
        },
        onsubmit: this.handleSubmit,
        content: new Column({
          gap: "20px",
          content: [
            // Error message
            this.errorMessage ? this.renderError() : null,
            // Email field
            this.renderEmailField(),
            // Password field
            this.renderPasswordField(),
            // Submit button
            this.renderSubmitButton()
          ].filter(Boolean)
        })
      })
    });
  }
  renderError() {
    return new Container({
      dataset: {
        key: "error"
      },
      style: {
        backgroundColor: "#ffebee",
        border: "1px solid #ef5350",
        borderRadius: "4px",
        padding: "12px 16px"
      },
      content: new Span({
        dataset: {
          key: "error-text"
        },
        textContent: this.errorMessage,
        style: {
          color: "#c62828",
          fontSize: "14px"
        }
      })
    });
  }
  renderEmailField() {
    return new Column({
      dataset: {
        key: "email-field"
      },
      gap: "6px",
      content: [
        new Label({
          dataset: {
            key: "email-label"
          },
          htmlFor: "admin-email",
          textContent: "Email address",
          style: {
            color: "#333333",
            fontSize: "14px",
            fontWeight: "500"
          }
        }),
        new Input({
          dataset: {
            key: "email-input"
          },
          id: "admin-email",
          type: "email",
          name: "email",
          placeholder: "admin@example.com",
          value: this.email,
          oninput: this.handleEmailInput,
          onkeydown: this.handleKeyDown,
          disabled: this.isLoading,
          autocomplete: "email",
          required: true,
          style: {
            width: "100%",
            padding: "12px 14px",
            fontSize: "14px",
            border: "1px solid #cccccc",
            borderRadius: "4px",
            boxSizing: "border-box",
            outline: "none",
            transition: "border-color 0.2s, box-shadow 0.2s"
          }
        })
      ]
    });
  }
  renderPasswordField() {
    return new Column({
      dataset: {
        key: "password-field"
      },
      gap: "6px",
      content: [
        new Label({
          dataset: {
            key: "password-label"
          },
          htmlFor: "admin-password",
          textContent: "Password",
          style: {
            color: "#333333",
            fontSize: "14px",
            fontWeight: "500"
          }
        }),
        new Input({
          dataset: {
            key: "password-input"
          },
          id: "admin-password",
          type: "password",
          name: "password",
          placeholder: "Enter your password",
          value: this.password,
          oninput: this.handlePasswordInput,
          onkeydown: this.handleKeyDown,
          disabled: this.isLoading,
          autocomplete: "current-password",
          required: true,
          style: {
            width: "100%",
            padding: "12px 14px",
            fontSize: "14px",
            border: "1px solid #cccccc",
            borderRadius: "4px",
            boxSizing: "border-box",
            outline: "none",
            transition: "border-color 0.2s, box-shadow 0.2s"
          }
        })
      ]
    });
  }
  renderSubmitButton() {
    return new Button({
      dataset: {
        key: "submit-button"
      },
      type: "submit",
      disabled: this.isLoading,
      style: {
        width: "100%",
        padding: "14px 20px",
        fontSize: "16px",
        fontWeight: "600",
        color: "#ffffff",
        backgroundColor: this.isLoading ? "#6c8a98" : "#417690",
        border: "none",
        borderRadius: "4px",
        cursor: this.isLoading ? "not-allowed" : "pointer",
        transition: "background-color 0.2s",
        marginTop: "8px"
      },
      textContent: this.isLoading ? "Signing in..." : "Sign in"
    });
  }
  renderFooter() {
    return new Container({
      dataset: {
        key: "login-footer"
      },
      style: {
        backgroundColor: "#f5f5f5",
        padding: "16px 30px",
        borderRadius: "0 0 8px 8px",
        textAlign: "center",
        borderTop: "1px solid #eeeeee"
      },
      content: new Anchor({
        dataset: {
          key: "back-link"
        },
        href: "/",
        textContent: "\u2190 Back to site",
        style: {
          color: "#417690",
          textDecoration: "none",
          fontSize: "14px"
        }
      })
    });
  }
};
AdminLogin.define("admin-login");

// src/alexi_admin/app/app.ts
function parseRoute(path, authenticated) {
  const routePath = path.replace(/^\/admin\/?/, "").replace(/\/$/, "");
  if (routePath === "login") {
    return {
      type: "login"
    };
  }
  if (!authenticated) {
    return {
      type: "login"
    };
  }
  if (!routePath) {
    return {
      type: "dashboard"
    };
  }
  const segments = routePath.split("/").filter(Boolean);
  if (segments.length === 1) {
    return {
      type: "model_list",
      modelName: segments[0]
    };
  }
  if (segments.length === 2 && segments[1] === "add") {
    return {
      type: "model_add",
      modelName: segments[0]
    };
  }
  if (segments.length === 2) {
    return {
      type: "model_detail",
      modelName: segments[0],
      objectId: segments[1]
    };
  }
  return {
    type: "dashboard"
  };
}
function navigateTo(path) {
  const adminPath = path.startsWith("/admin") ? path : `/admin${path}`;
  globalThis.history.pushState({}, "", adminPath);
  globalThis.dispatchEvent(new PopStateEvent("popstate"));
}
var AdminApp = class extends HTMLPropsMixin(HTMLElement, {
  // Current route
  route: prop({
    type: "login"
  }),
  // Auth state
  isAuthenticated: prop(false),
  currentUser: prop(null),
  // Loading state
  isLoading: prop(true),
  // Error message
  errorMessage: prop(""),
  // Site title
  siteTitle: prop("Admin"),
  // Styling
  style: {
    display: "block",
    width: "100%",
    height: "100%",
    minHeight: "100vh",
    backgroundColor: "#f5f5f5",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  }
}) {
  // ===========================================================================
  // Lifecycle
  // ===========================================================================
  mountedCallback() {
    this.checkAuth();
    this.route = parseRoute(globalThis.location.pathname, this.isAuthenticated);
    this.isLoading = false;
    globalThis.addEventListener("popstate", this.handlePopState);
  }
  /**
   * Check authentication state from storage
   */
  checkAuth() {
    const authState = getAuthState();
    this.isAuthenticated = authState.isAuthenticated && authState.isAdmin;
    this.currentUser = authState.user;
  }
  unmountedCallback() {
    globalThis.removeEventListener("popstate", this.handlePopState);
  }
  // ===========================================================================
  // Event Handlers
  // ===========================================================================
  handlePopState = () => {
    this.route = parseRoute(globalThis.location.pathname, this.isAuthenticated);
  };
  handleLoginSuccess = () => {
    this.checkAuth();
    navigateTo("/admin/");
  };
  handleLogout = async (event) => {
    event.preventDefault();
    await logout();
    this.isAuthenticated = false;
    this.currentUser = null;
    navigateTo("/admin/login/");
  };
  handleNavClick = (href, event) => {
    event.preventDefault();
    navigateTo(href);
  };
  handleBackToSite = (event) => {
    event.preventDefault();
    globalThis.location.href = "/";
  };
  // ===========================================================================
  // Getters
  // ===========================================================================
  get backend() {
    return getBackend();
  }
  // ===========================================================================
  // Helpers
  // ===========================================================================
  humanize(str) {
    return str.replace(/([A-Z])/g, " $1").replace(/[-_]/g, " ").replace(/\s+/g, " ").trim().split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
  }
  // ===========================================================================
  // Render
  // ===========================================================================
  render() {
    if (this.route.type === "login") {
      return this.renderContent();
    }
    return new Column({
      style: {
        minHeight: "100vh"
      },
      content: [
        this.renderHeader(),
        this.renderBreadcrumb(),
        this.renderContent()
      ]
    });
  }
  renderHeader() {
    return new Container({
      dataset: {
        key: "header"
      },
      style: {
        background: "linear-gradient(to bottom, #417690 0%, #205067 100%)",
        color: "#ffffff",
        padding: "12px 24px"
      },
      content: new Row({
        mainAxisAlignment: "spaceBetween",
        crossAxisAlignment: "center",
        content: [
          // Site title (link to dashboard)
          new Anchor({
            dataset: {
              key: "site-title"
            },
            href: "/admin/",
            onclick: (e) => this.handleNavClick("/admin/", e),
            style: {
              color: "#ffffff",
              textDecoration: "none",
              fontSize: "20px",
              fontWeight: "600"
            },
            textContent: this.siteTitle
          }),
          // Right side: user info and links
          new Row({
            dataset: {
              key: "header-right"
            },
            gap: "16px",
            crossAxisAlignment: "center",
            content: [
              // User info (if logged in)
              this.currentUser ? new Span({
                dataset: {
                  key: "user-info"
                },
                textContent: `Welcome, ${this.currentUser.firstName || this.currentUser.email}`,
                style: {
                  color: "#79aec8",
                  fontSize: "14px"
                }
              }) : null,
              // Logout link (if logged in)
              this.isAuthenticated ? new Anchor({
                dataset: {
                  key: "logout-link"
                },
                href: "#",
                onclick: this.handleLogout,
                style: {
                  color: "#79aec8",
                  textDecoration: "none",
                  fontSize: "14px"
                },
                textContent: "Log out"
              }) : null,
              // Back to site link
              new Anchor({
                dataset: {
                  key: "back-link"
                },
                href: "/",
                onclick: this.handleBackToSite,
                style: {
                  color: "#79aec8",
                  textDecoration: "none",
                  fontSize: "14px"
                },
                textContent: "\u2190 Back to Site"
              })
            ].filter(Boolean)
          })
        ]
      })
    });
  }
  renderBreadcrumb() {
    const breadcrumbs = [
      {
        label: "Home",
        href: "/admin/"
      }
    ];
    if (this.route.modelName) {
      const modelLabel = this.humanize(this.route.modelName);
      if (this.route.type === "model_list") {
        breadcrumbs.push({
          label: modelLabel
        });
      } else {
        breadcrumbs.push({
          label: modelLabel,
          href: `/admin/${this.route.modelName}/`
        });
        if (this.route.type === "model_detail" && this.route.objectId) {
          breadcrumbs.push({
            label: `#${this.route.objectId}`
          });
        } else if (this.route.type === "model_add") {
          breadcrumbs.push({
            label: "Add"
          });
        }
      }
    }
    const crumbNodes = [];
    breadcrumbs.forEach((crumb, index) => {
      if (index > 0) {
        crumbNodes.push(new Span({
          dataset: {
            key: `sep-${index}`
          },
          style: {
            color: "#666666",
            margin: "0 8px"
          },
          textContent: "\u203A"
        }));
      }
      if (crumb.href && index < breadcrumbs.length - 1) {
        crumbNodes.push(new Anchor({
          dataset: {
            key: `crumb-${index}`
          },
          href: crumb.href,
          onclick: (e) => this.handleNavClick(crumb.href, e),
          style: {
            color: "#666666",
            textDecoration: "none"
          },
          textContent: crumb.label
        }));
      } else {
        crumbNodes.push(new Span({
          dataset: {
            key: `crumb-${index}`
          },
          style: {
            color: "#333333"
          },
          textContent: crumb.label
        }));
      }
    });
    return new Nav({
      dataset: {
        key: "breadcrumb"
      },
      style: {
        backgroundColor: "#ffffff",
        padding: "12px 24px",
        borderBottom: "1px solid #cccccc",
        fontSize: "13px"
      },
      content: crumbNodes
    });
  }
  renderContent() {
    if (this.route.type === "login") {
      return new AdminLogin({
        dataset: {
          key: "login"
        },
        onLoginSuccess: this.handleLoginSuccess
      });
    }
    if (this.isLoading) {
      return this.renderLoading();
    }
    if (this.errorMessage) {
      return this.renderError();
    }
    switch (this.route.type) {
      case "dashboard":
        return new AdminDashboard({
          dataset: {
            key: "dashboard"
          },
          app: this
        });
      case "model_list":
        return new AdminModelList({
          dataset: {
            key: "model-list"
          },
          app: this,
          modelName: this.route.modelName ?? ""
        });
      case "model_detail":
        return new AdminModelDetail({
          dataset: {
            key: "model-detail"
          },
          app: this,
          modelName: this.route.modelName ?? "",
          objectId: this.route.objectId ?? ""
        });
      case "model_add":
        return new AdminModelDetail({
          dataset: {
            key: "model-add"
          },
          app: this,
          modelName: this.route.modelName ?? "",
          objectId: ""
        });
      default:
        return this.renderNotFound();
    }
  }
  renderLoading() {
    return new Container({
      dataset: {
        key: "loading"
      },
      padding: "48px",
      style: {
        flex: "1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      },
      content: new Column({
        gap: "16px",
        crossAxisAlignment: "center",
        content: [
          new Div({
            dataset: {
              key: "spinner"
            },
            style: {
              width: "32px",
              height: "32px",
              border: "3px solid #eeeeee",
              borderTopColor: "#417690",
              borderRadius: "50%",
              animation: "admin-spin 0.8s linear infinite"
            }
          }),
          new Span({
            dataset: {
              key: "loading-text"
            },
            style: {
              color: "#666666",
              fontSize: "14px"
            },
            textContent: "Loading..."
          })
        ]
      })
    });
  }
  renderError() {
    return new Container({
      dataset: {
        key: "error"
      },
      padding: "48px",
      style: {
        flex: "1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      },
      content: new Column({
        gap: "16px",
        crossAxisAlignment: "center",
        content: [
          new Span({
            dataset: {
              key: "error-icon"
            },
            style: {
              fontSize: "48px"
            },
            textContent: "\u26A0\uFE0F"
          }),
          new Span({
            dataset: {
              key: "error-message"
            },
            style: {
              color: "#ba2121",
              fontSize: "14px"
            },
            textContent: this.errorMessage
          })
        ]
      })
    });
  }
  renderNotFound() {
    return new Container({
      dataset: {
        key: "not-found"
      },
      padding: "48px",
      style: {
        flex: "1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      },
      content: new Column({
        gap: "16px",
        crossAxisAlignment: "center",
        content: [
          new Span({
            dataset: {
              key: "404-code"
            },
            style: {
              color: "#999999",
              fontSize: "48px"
            },
            textContent: "404"
          }),
          new Span({
            dataset: {
              key: "404-message"
            },
            style: {
              color: "#666666",
              fontSize: "14px"
            },
            textContent: "Page not found"
          })
        ]
      })
    });
  }
};
AdminApp.define("admin-app");

// src/alexi_admin/app/main.ts
async function main() {
  const config11 = globalThis.__ADMIN_CONFIG__ ?? {};
  const apiUrl = config11.apiUrl ?? `${globalThis.location.origin}/api`;
  const debug = config11.debug ?? true;
  if (debug) {
    console.log("[AdminApp] Initializing...");
    console.log("[AdminApp] API URL:", apiUrl);
  }
  await setupBackend({
    backendConfig: {
      backend: "sync",
      apiUrl,
      databaseName: "alexi_admin",
      debug,
      failSilently: true
    },
    debug
  });
  if (debug) {
    console.log("[AdminApp] Backend initialized");
  }
  const root = document.getElementById("admin-root");
  if (!root) {
    throw new Error("Admin root element (#admin-root) not found");
  }
  root.appendChild(new AdminApp());
  if (debug) {
    console.log("[AdminApp] Mounted");
  }
}
main().catch((error) => {
  console.error("[AdminApp] Failed to initialize:", error);
});
