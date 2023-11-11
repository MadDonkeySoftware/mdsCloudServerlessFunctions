import { Static, Type } from '@sinclair/typebox';

export const CreateFunctionResponseBodySchema = Type.Object({
  name: Type.String(),
  orid: Type.String(),
});

export type CreateFunctionResponseBody = Static<
  typeof CreateFunctionResponseBodySchema
>;
