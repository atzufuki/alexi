import { getFirestore, runTransaction, Transaction } from 'firebase/firestore';

export async function transactionAtomic<T>(
  callback: (transaction: Transaction) => Promise<T>,
) {
  const settings = globalThis.alexi.conf.settings;
  const firestore = getFirestore(settings.FIREBASE.APP);
  return runTransaction(firestore, async (transaction) => {
    settings.FIREBASE.TRANSACTION = transaction;
    const result = await callback(transaction);
    settings.FIREBASE.TRANSACTION = null;
    return result;
  });
}
