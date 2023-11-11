import { Static, Type } from '@sinclair/typebox';
import { HealthCheckResult } from '../../../core/types/health-check-result';

export const GetHealthResponseSchema = Type.Object({
  serverStatus: Type.Enum(HealthCheckResult),
  // queueStatus: Type.Enum(HealthCheckResult),
  // redisStatus: Type.Enum(HealthCheckResult),
});

export type GetHealthResponse = Static<typeof GetHealthResponseSchema>;
