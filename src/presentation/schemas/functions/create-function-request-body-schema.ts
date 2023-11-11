import { Static, Type } from '@sinclair/typebox';

export const CreateFunctionRequestBodySchema = Type.Object({
  name: Type.String(),
});

export type CreateFunctionRequestBody = Static<
  typeof CreateFunctionRequestBodySchema
>;
