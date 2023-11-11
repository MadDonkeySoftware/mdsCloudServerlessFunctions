import { Static, Type } from '@sinclair/typebox';

export const InspectFunctionResponseBodySchema = Type.Object({
  id: Type.String(),
  orid: Type.String(),
  name: Type.String(),
  runtime: Type.Optional(Type.String()),
  entryPoint: Type.Optional(Type.String()),
  created: Type.String(),
  lastUpdate: Type.Optional(Type.String()),
  lastInvoke: Type.Optional(Type.String()),
});

export type InspectFunctionResponseBody = Static<
  typeof InspectFunctionResponseBodySchema
>;
