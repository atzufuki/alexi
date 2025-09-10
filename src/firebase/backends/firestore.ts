import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  documentId,
  DocumentReference,
  Firestore,
  GeoPoint,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  Query,
  query as firestoreQuery,
  QueryDocumentSnapshot,
  setDoc,
  Timestamp,
  Transaction,
  updateDoc,
  where,
} from 'firebase/firestore';

import {
  DateField,
  Field,
  ForeignKey,
  GeoField,
  ManyToManyField,
  Model,
} from '@alexi/db/models';
import { QuerySet } from '@alexi/db/models';
import { BaseDatabaseBackend } from '@alexi/db/backends';

export default class FirestoreBackend extends BaseDatabaseBackend {
  declare db: Firestore;

  getTransaction(): Transaction | null {
    const settings = globalThis.alexi.conf.settings;
    return settings.FIREBASE?.TRANSACTION || null;
  }

  docToData(doc: QueryDocumentSnapshot<DocumentData>) {
    const data = doc.data();

    for (const key in data) {
      const value = data[key];

      if (value instanceof Timestamp) {
        data[key] = value.toDate();
      }

      if (value instanceof DocumentReference) {
        data[key] = value.id;
      }

      if (value instanceof Array && value[0] instanceof DocumentReference) {
        data[key] = value.map((docRef) => docRef.id);
      }

      if (value instanceof GeoPoint) {
        data[key] = { latitude: value.latitude, longitude: value.longitude };
      }
    }

    return data;
  }

  serialize(instance: Model<any>): { [key: string]: any } {
    const serialized: { [key: string]: any } = {};

    for (const key in instance) {
      const field = instance[key];
      if (field && field.value !== undefined) {
        serialized[key] = this.serializeField(field);
      }
    }

    return serialized;
  }

  serializeField(field: Field): any {
    if (field instanceof DateField) {
      const date = field.get();

      if (date === null) {
        return null;
      }

      if (date === undefined) {
        return undefined;
      }

      return Timestamp.fromDate(date);
    }

    if (field instanceof ForeignKey) {
      if (field.id) {
        return doc(this.db, field.relatedModel.meta.dbTable, field.id);
      }
      return field.id; // returns null or undefined
    }

    if (field instanceof ManyToManyField) {
      return field.ids.map((id) =>
        doc(this.db, field.relatedModel.meta.dbTable, id)
      );
    }

    if (field instanceof GeoField) {
      const coordinates = field.get();

      if (coordinates === null) {
        return null;
      }

      if (coordinates.latitude === undefined) {
        return undefined;
      }

      return new GeoPoint(coordinates.latitude, coordinates.longitude);
    }

    return field.get();
  }

  async init() {
    const settings = globalThis.alexi.conf.settings;
    this.db = getFirestore(settings.FIREBASE.APP);
  }

  async create(qs: QuerySet<any>, serialized: any): Promise<any> {
    const { id, ...data } = serialized;

    if (id) {
      const docRef = doc(this.db, qs.modelClass.meta.dbTable, id);
      await setDoc(docRef, data);
      return {
        id: docRef.id,
      };
    }

    const colRef = collection(this.db, qs.modelClass.meta.dbTable);
    const docRef = await addDoc(colRef, data);

    return {
      id: docRef.id,
    };
  }

  async get(qs: QuerySet<any>): Promise<any[]> {
    const filter = qs.query.where[0];

    if (filter.id) {
      const docRef = doc(this.db, qs.modelClass.meta.dbTable, filter.id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return [];
      }

      return [
        {
          ...this.docToData(docSnap),
          id: docSnap.id,
        },
      ];
    }

    return await this.fetch(qs);
  }

  async fetch<T extends Model<T>>(qs: QuerySet<T>): Promise<any[]> {
    const docs = await this.queryDocs(qs);

    return docs.map((doc) => {
      return {
        ...this.docToData(doc),
        id: doc.id,
      };
    });
  }

  async update(qs: QuerySet<any>, serialized: any) {
    const { id, ...data } = serialized;

    if (id) {
      const docRef = doc(this.db, qs.modelClass.meta.dbTable, id);
      await updateDoc(docRef, data);
      return [
        {
          id: docRef.id,
        },
      ];
    }

    const docs = await this.fetch(qs);

    for (const docItem of docs) {
      const docRef = doc(this.db, qs.modelClass.meta.dbTable, docItem.id);
      await updateDoc(docRef, data);
    }

    return docs.map((docItem) => {
      return {
        id: docItem.id,
      };
    });
  }

  async delete<T extends Model<T>>(qs: QuerySet<T>): Promise<void> {
    const { id } = qs.query.where[0] ?? { id: null };

    if (id) {
      const docRef = doc(this.db, qs.modelClass.meta.dbTable, id);
      await deleteDoc(docRef);
      return;
    }

    const docs = await this.queryDocs(qs);
    for (const docSnap of docs) {
      await deleteDoc(docSnap.ref);
    }
  }

  async getDocs(query: Query<DocumentData>) {
    const snapshot = await getDocs(query);
    return snapshot;
  }

  async getDoc(docRef: DocumentReference<DocumentData>) {
    const transaction = this.getTransaction();
    if (transaction) {
      return await transaction.get(docRef);
    }
    return await getDoc(docRef);
  }

  async setDoc(
    docRef: DocumentReference<DocumentData>,
    data: { [key: string]: any },
  ) {
    const transaction = this.getTransaction();
    if (transaction) {
      return await transaction.set(docRef, data);
    }
    return await setDoc(docRef, data);
  }

  async createDoc(
    collectionRef: ReturnType<typeof collection>,
    data: { [key: string]: any },
  ) {
    const transaction = this.getTransaction();
    if (transaction) {
      const docRef = doc(
        collectionRef.firestore,
        collectionRef.path,
        collectionRef.id || undefined,
      );
      await transaction.set(docRef, data);
      return docRef;
    }
    return await addDoc(collectionRef, data);
  }

  async updateDoc(
    docRef: DocumentReference<DocumentData>,
    data: { [key: string]: any },
  ) {
    const transaction = this.getTransaction();
    if (transaction) {
      return await transaction.update(docRef, data);
    }
    return await updateDoc(docRef, data);
  }

  async deleteDoc(docRef: DocumentReference<DocumentData>) {
    const transaction = this.getTransaction();
    if (transaction) {
      return await transaction.delete(docRef);
    }
    return await deleteDoc(docRef);
  }

  async queryDocs<T extends Model<T>>(qs: QuerySet<T>) {
    let q: Query<DocumentData> = collection(
      this.db,
      qs.modelClass.meta.dbTable,
    );

    // Apply filters
    for (const filter of qs.query.where) {
      const instance = new qs.modelClass({}) as any;
      for (const key in filter) {
        const [fieldName, condition = 'eq'] = key.split('__');
        const field = instance[fieldName];

        switch (condition) {
          case 'eq': {
            field.set(filter[key]);
            const value = this.serializeField(field);
            if (fieldName === 'id') {
              q = firestoreQuery(q, where(documentId(), '==', value));
            } else {
              q = firestoreQuery(q, where(fieldName, '==', value));
            }
            break;
          }
          case 'ne': {
            field.set(filter[key]);
            const value = this.serializeField(field);
            if (fieldName === 'id') {
              q = firestoreQuery(q, where(documentId(), '!=', value));
            } else {
              q = firestoreQuery(q, where(fieldName, '!=', value));
            }
            break;
          }
          case 'in': {
            const arr = filter[key].map((item) => {
              field.set(item);
              return this.serializeField(field);
            });

            if (fieldName === 'id') {
              q = firestoreQuery(q, where(documentId(), 'in', arr));
            } else {
              q = firestoreQuery(q, where(fieldName, 'in', arr));
            }

            break;
          }
          case 'nin': {
            const arr = filter[key].map((item) => {
              field.set(item);
              return this.serializeField(field);
            });
            if (fieldName === 'id') {
              q = firestoreQuery(q, where(documentId(), 'not-in', arr));
            } else {
              q = firestoreQuery(q, where(fieldName, 'not-in', arr));
            }
            break;
          }
          case 'gt': {
            field.set(filter[key]);
            const value = this.serializeField(field);
            q = firestoreQuery(q, where(fieldName, '>', value));
            break;
          }
          case 'lt': {
            field.set(filter[key]);
            const value = this.serializeField(field);
            q = firestoreQuery(q, where(fieldName, '<', value));
            break;
          }
          case 'gte': {
            field.set(filter[key]);
            const value = this.serializeField(field);
            q = firestoreQuery(q, where(fieldName, '>=', value));
            break;
          }
          case 'lte': {
            field.set(filter[key]);
            const value = this.serializeField(field);
            q = firestoreQuery(q, where(fieldName, '<=', value));
            break;
          }
          default:
            throw new Error(
              `Unsupported condition '${condition}' used in filter for field '${fieldName}'.`,
            );
        }
      }
    }

    // Apply ordering
    for (const order of qs.query.ordering) {
      const direction = order.startsWith('-') ? 'desc' : 'asc';
      const field = order.startsWith('-') ? order.slice(1) : order;
      q = firestoreQuery(q, orderBy(field, direction));
    }

    try {
      const snapshot = await getDocs(q);
      return snapshot.docs;
    } catch (error) {
      // Firestore throws an error when using an empty array for 'in' filters,
      // but Alexi ORM returns an empty array in these cases.
      const message =
        "Invalid Query. A non-empty array is required for 'in' filters.";
      if (error instanceof Error && error.message === message) {
        return [];
      } else {
        throw error;
      }
    }
  }
}
