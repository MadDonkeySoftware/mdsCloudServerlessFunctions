import { Jwt, JwtPayload } from 'jsonwebtoken';

export interface IdentityJwt extends Jwt {
  payload: IdentityJwtPayload;
}

export interface IdentityJwtPayload extends JwtPayload {
  accountId: string;
  userId: string;
  friendlyName: string;
  impersonatedBy?: string;
}
