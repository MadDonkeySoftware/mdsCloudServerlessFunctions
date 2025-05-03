export type FunctionData = {
  id: string;
  accountId: string;
  name: string;
  created: string;
  runtime?: string;
  providerFuncId?: string;
  entryPoint?: string;
  lastUpdate?: string;
  lastInvoke?: string;
};

export interface FunctionsRepo {
  listFunctions(accountId?: string): Promise<FunctionData[]>;

  getFunctionByNameAndAccount({
    name,
    accountId,
  }: {
    name: string;
    accountId: string;
  }): Promise<FunctionData | null>;

  getFunctionByIdAndAccount({
    id,
    accountId,
  }: {
    id: string;
    accountId: string;
  }): Promise<FunctionData | null>;

  createFunction({
    name,
    accountId,
  }: {
    name: string;
    accountId: string;
  }): Promise<string>;

  deleteFunction({
    id,
    accountId,
  }: {
    id: string;
    accountId: string;
  }): Promise<void>;

  updateFunctionInfo({
    id,
    payload,
  }: {
    id: string;
    payload: Partial<FunctionData>;
  }): Promise<void>;
}
