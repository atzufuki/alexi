export class DoesNotExist extends Error {
  constructor() {
    super();
    this.name = 'DoesNotExist';
    this.message = 'Object does not exist';
  }
}

export class MultipleObjectsReturned extends Error {
  constructor() {
    super();
    this.name = 'MultipleObjectsReturned';
    this.message = 'Multiple objects returned';
  }
}

export default {
  DoesNotExist,
  MultipleObjectsReturned,
};
