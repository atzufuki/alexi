export { getFunctions } from 'firebase-admin/functions';
export { onRequest } from 'firebase-functions/v2/https';
export { onSchedule } from 'firebase-functions/v2/scheduler';
export { onTaskDispatched } from 'firebase-functions/v2/tasks';
export {
  Change,
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentUpdated,
  onDocumentWritten,
} from 'firebase-functions/v2/firestore';
export type { FirestoreEvent } from 'firebase-functions/v2/firestore';
export * as logger from 'firebase-functions/logger';

export function setupFunctions() {
  const apps = globalThis.alexi.conf.apps;
  const appFunctions = {};
  for (const appName in apps) {
    const app = apps[appName];
    if (app.functions) {
      appFunctions[appName] = {};
      for (const funcName in app.functions) {
        const func = app.functions[funcName];
        appFunctions[appName][funcName] = func;
      }
    }
  }
  return appFunctions;
}
