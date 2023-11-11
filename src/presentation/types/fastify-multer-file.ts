import { FastifyRequest } from 'fastify';

// https://github.com/fox1t/fastify-multer?tab=readme-ov-file#file-information
export type FastifyMulterFile = {
  originalname: string;
  path: string;
};

export type FastifyMulterFileRequest = FastifyRequest & {
  file: FastifyMulterFile;
};

export type FastifyMulterFilesRequest = FastifyRequest & {
  files: FastifyMulterFile[];
};
