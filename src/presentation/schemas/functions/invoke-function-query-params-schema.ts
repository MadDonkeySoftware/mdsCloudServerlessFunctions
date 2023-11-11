import { Static, Type } from '@sinclair/typebox';

export const InvokeFunctionQueryParamsSchema = Type.Object({
  async: Type.Optional(Type.Boolean()),
});

export type InvokeFunctionQueryParams = Static<
  typeof InvokeFunctionQueryParamsSchema
>;
