import { getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export async function transactionAtomic<T>(
  callback: (transaction: FirebaseFirestore.Transaction) => Promise<T>,
) {
  const app = getApp();
  const firestore = getFirestore(app);
  const settings = globalThis.alexi.conf.settings;
  return firestore.runTransaction(async (transaction) => {
    settings.FIREBASE.TRANSACTION = transaction;
    const result = await callback(transaction);
    settings.FIREBASE.TRANSACTION = null;
    return result;
  });
}
