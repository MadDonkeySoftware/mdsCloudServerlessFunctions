export type Provider = {
  type: string;
  [key: string]: any;
};

export type ProviderConfiguration = {
  version: string;
  runtimeMap: Record<string, string>;
  providers: Record<string, Provider>;
};
