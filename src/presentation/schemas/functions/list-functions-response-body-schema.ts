import { Static, Type } from '@sinclair/typebox';

export const ListFunctionsResponseBodySchema = Type.Array(
  Type.Object({
    name: Type.String(),
    orid: Type.String(),
  }),
);

export type ListFunctionsResponseBody = Static<
  typeof ListFunctionsResponseBodySchema
>;
