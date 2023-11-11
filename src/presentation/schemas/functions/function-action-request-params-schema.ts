import { Static, Type } from '@sinclair/typebox';

export const FunctionActionRequestParamsSchema = Type.Object({
  orid: Type.String(),
});

export type FunctionActionRequestParams = Static<
  typeof FunctionActionRequestParamsSchema
>;
