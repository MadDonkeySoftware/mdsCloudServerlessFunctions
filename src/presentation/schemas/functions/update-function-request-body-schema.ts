import { Static, Type } from '@sinclair/typebox';

export const UpdateFunctionRequestBodySchema = Type.Object({
  runtime: Type.String(), // TODO: make this a enum?
  entryPoint: Type.String(),
  context: Type.Optional(Type.String()),
  sourceArchive: Type.Any(),
});

export type UpdateFunctionRequestBody = Static<
  typeof UpdateFunctionRequestBodySchema
>;
