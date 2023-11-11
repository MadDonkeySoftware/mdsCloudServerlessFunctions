export class FunctionNotFoundError extends Error {
  id: string;
  constructor(message: string, id: string) {
    super(message);
    this.id = id;
    Object.setPrototypeOf(this, FunctionNotFoundError.prototype);
  }
}
