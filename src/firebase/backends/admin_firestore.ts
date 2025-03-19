import { firestore } from 'firebase-admin';
import {
  DocumentReference,
  FieldPath,
  GeoPoint,
  getFirestore,
  Timestamp,
  Transaction,
} from 'firebase-admin/firestore';

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
  declare db: firestore.Firestore;

  getTransaction() {
    const settings = globalThis.alexi.conf.settings;
    return settings.FIREBASE?.TRANSACTION as Transaction | null;
  }

  docToData(doc: firestore.DocumentData) {
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
    const serialized = {};

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
      return Timestamp.fromDate(field.get());
    }

    if (field instanceof ForeignKey) {
      if (field.id) {
        return this.db
          .collection(field.relatedModel.meta.dbTable)
          .doc(field.id);
      }
      return field.id; // returns null or undefined
    }

    if (field instanceof ManyToManyField) {
      return field.ids.map((id) =>
        this.db.collection(field.relatedModel.meta.dbTable).doc(id)
      );
    }

    if (field instanceof GeoField) {
      const { latitude, longitude } = field.get();
      return new GeoPoint(latitude, longitude);
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
      const docRef = this.db.collection(qs.modelClass.meta.dbTable).doc(id);
      await this.setDoc(docRef, data);
      return {
        id: docRef.id,
      };
    }

    const docRef = await this.createDoc(
      this.db.collection(qs.modelClass.meta.dbTable),
      data,
    );

    return {
      id: docRef.id,
    };
  }

  async get(qs: QuerySet<any>): Promise<any[]> {
    const filter = qs.query.where[0];

    if (filter.id) {
      const docRef = this.db
        .collection(qs.modelClass.meta.dbTable)
        .doc(filter.id);
      const doc = await this.getDoc(docRef);

      if (!doc.exists) {
        return [];
      }

      return [
        {
          ...this.docToData(doc),
          id: doc.id,
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
      const docRef = this.db.collection(qs.modelClass.meta.dbTable).doc(id);
      await this.updateDoc(docRef, data);
      return [
        {
          id: docRef.id,
        },
      ];
    }

    const docs = await this.fetch(qs);

    for (const doc of docs) {
      const docRef = this.db.collection(qs.modelClass.meta.dbTable).doc(doc.id);
      await this.updateDoc(docRef, data);
    }

    return docs.map((doc) => {
      return {
        id: doc.id,
      };
    });
  }

  async delete<T extends Model<T>>(qs: QuerySet<T>): Promise<void> {
    const docs = await this.queryDocs(qs);
    for (const doc of docs) {
      await this.deleteDoc(doc.ref);
    }
  }

  async getDocs(query: firestore.Query) {
    const transaction = this.getTransaction();
    if (transaction) {
      return await transaction.get(query);
    } else {
      return await query.get();
    }
  }

  async getDoc(docRef: DocumentReference) {
    const transaction = this.getTransaction();
    if (transaction) {
      return await transaction.get(docRef);
    } else {
      return await docRef.get();
    }
  }

  async setDoc(docRef: DocumentReference, data: { [key: string]: any }) {
    const transaction = this.getTransaction();
    if (transaction) {
      return await transaction.set(docRef, data);
    } else {
      return await docRef.set(data);
    }
  }

  async createDoc(
    collectionRef: firestore.CollectionReference,
    data: { [key: string]: any },
  ) {
    const transaction = this.getTransaction();
    if (transaction) {
      const docRef = collectionRef.doc();
      await transaction.create(docRef, data);
      return docRef;
    } else {
      return await collectionRef.add(data);
    }
  }

  async updateDoc(docRef: DocumentReference, data: { [key: string]: any }) {
    const transaction = this.getTransaction();
    if (transaction) {
      return await transaction.update(docRef, data);
    } else {
      return await docRef.update(data);
    }
  }

  async deleteDoc(docRef: DocumentReference) {
    const transaction = this.getTransaction();
    if (transaction) {
      return await transaction.delete(docRef);
    } else {
      return await docRef.delete();
    }
  }

  async queryDocs<T extends Model<T>>(qs: QuerySet<T>) {
    const query = async () => {
      let firestoreQuery:
        | firestore.CollectionReference<
          firestore.DocumentData,
          firestore.DocumentData
        >
        | firestore.Query<firestore.DocumentData, firestore.DocumentData> = this
          .db.collection(qs.modelClass.meta.dbTable);

      // Apply filters
      for (const filter of qs.query.where) {
        const instance = new qs.modelClass({}) as any;
        for (const key in filter) {
          const [fieldName, condition = 'eq']:
            (string | firestore.FieldPath)[] = key.split('__');
          const field = instance[fieldName];

          switch (condition) {
            case 'eq': {
              field.set(filter[key]);
              const value = this.serializeField(field);
              if (fieldName === 'id') {
                firestoreQuery = firestoreQuery.where(
                  FieldPath.documentId(),
                  '==',
                  value,
                );
              } else {
                firestoreQuery = firestoreQuery.where(fieldName, '==', value);
              }
              break;
            }
            case 'ne': {
              field.set(filter[key]);
              const value = this.serializeField(field);
              if (fieldName === 'id') {
                firestoreQuery = firestoreQuery.where(
                  FieldPath.documentId(),
                  '!=',
                  value,
                );
              } else {
                firestoreQuery = firestoreQuery.where(fieldName, '!=', value);
              }
              break;
            }
            case 'in': {
              const arr = filter[key].map((item) => {
                field.set(item);
                return this.serializeField(field);
              });

              if (fieldName === 'id') {
                firestoreQuery = firestoreQuery.where(
                  FieldPath.documentId(),
                  'in',
                  arr,
                );
              } else {
                firestoreQuery = firestoreQuery.where(fieldName, 'in', arr);
              }

              break;
            }
            case 'nin': {
              const arr = filter[key].map((item) => {
                field.set(item);
                return this.serializeField(field);
              });
              if (fieldName === 'id') {
                firestoreQuery = firestoreQuery.where(
                  FieldPath.documentId(),
                  'not-in',
                  arr,
                );
              } else {
                firestoreQuery = firestoreQuery.where(fieldName, 'not-in', arr);
              }
              break;
            }
            case 'gt': {
              field.set(filter[key]);
              const value = this.serializeField(field);
              firestoreQuery = firestoreQuery.where(fieldName, '>', value);
              break;
            }
            case 'lt': {
              field.set(filter[key]);
              const value = this.serializeField(field);
              firestoreQuery = firestoreQuery.where(fieldName, '<', value);
              break;
            }
            case 'gte': {
              field.set(filter[key]);
              const value = this.serializeField(field);
              firestoreQuery = firestoreQuery.where(fieldName, '>=', value);
              break;
            }
            case 'lte': {
              field.set(filter[key]);
              const value = this.serializeField(field);
              firestoreQuery = firestoreQuery.where(fieldName, '<=', value);
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
        firestoreQuery = firestoreQuery.orderBy(field, direction);
      }

      return await this.getDocs(firestoreQuery);
    };

    try {
      const snapshot = await query();
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
