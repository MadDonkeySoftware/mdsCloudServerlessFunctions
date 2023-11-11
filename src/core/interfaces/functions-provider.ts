export type FunctionInvokeResult = {
  status: number;
  data: string;
};

export interface FunctionsProvider {
  /**
   * Create a function
   * @param name
   * @param accountId
   * @returns id The new function's ID
   */
  createFunction({
    name,
    accountId,
  }: {
    name: string;
    accountId: string;
  }): Promise<string | undefined>;

  /**
   * Updates a function
   * @param id The function's ID
   * @param source The path or stream to the source code used to update the function
   * @param runtime The runtime to use
   * @param entryPoint The entry point to use
   * @param context The optional user context to provide to function executions
   */
  updateFunction({
    id,
    source,
    runtime,
    entryPoint,
    context,
  }: {
    id: string;
    source: string | ReadableStream;
    runtime: string;
    entryPoint: string;
    context?: string;
  }): Promise<boolean>;

  /**
   * Invokes a function
   * @param id The function's ID
   * @param payload The payload to send to the function
   */
  invokeFunction({
    id,
    payload,
  }: {
    id: string;
    payload: string;
  }): Promise<FunctionInvokeResult | undefined>;

  /**
   * Deletes a function
   * @param id The function's ID
   */
  deleteFunction({ id }: { id: string }): Promise<boolean>;
}
