import { getFirestore } from 'firebase-admin/firestore';

export async function transactionAtomic<T>(
  callback: (transaction: FirebaseFirestore.Transaction) => Promise<T>,
) {
  const settings = globalThis.alexi.conf.settings;
  const firestore = getFirestore(settings.FIREBASE.APP);
  return firestore.runTransaction(async (transaction) => {
    settings.FIREBASE.TRANSACTION = transaction;
    const result = await callback(transaction);
    settings.FIREBASE.TRANSACTION = null;
    return result;
  });
}
