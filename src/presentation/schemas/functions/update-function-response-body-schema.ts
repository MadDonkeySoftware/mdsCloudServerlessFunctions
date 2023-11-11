import { Static, Type } from '@sinclair/typebox';

export const UpdateFunctionResponseBodySchema = Type.Object({
  id: Type.String(),
  orid: Type.Optional(Type.String()),
  status: Type.String(),
});

export type UpdateFunctionResponseBody = Static<
  typeof UpdateFunctionResponseBodySchema
>;
