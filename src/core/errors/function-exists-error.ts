export class FunctionExistsError extends Error {
  id: string;
  constructor(message: string, id: string) {
    super(message);
    this.id = id;
    Object.setPrototypeOf(this, FunctionExistsError.prototype);
  }
}
