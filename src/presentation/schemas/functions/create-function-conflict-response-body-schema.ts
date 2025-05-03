import { Static, Type } from '@sinclair/typebox';

export const CreateFunctionConflictResponseBodySchema = Type.Object({
  orid: Type.String(),
});

export type CreateFunctionConflictResponseBody = Static<
  typeof CreateFunctionConflictResponseBodySchema
>;
