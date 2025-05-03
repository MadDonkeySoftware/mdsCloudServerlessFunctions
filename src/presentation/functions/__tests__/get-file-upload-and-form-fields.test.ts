import { getFileUploadAndFormFields } from '../get-file-upload-and-form-fields';
import { FastifyMulterFileRequest } from '../../types/fastify-multer-file';

jest.mock('fs/promises', () => ({
  rm: jest.fn(),
}));
const mockRm = jest.requireMock('fs/promises').rm as jest.MockedFunction<
  typeof import('fs/promises').rm
>;

describe('get-file-upload-and-form-fields', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  function getFakeRequest(overrides: Partial<FastifyMulterFileRequest> = {}) {
    return {
      body: {},
      ...overrides,
      log: {
        trace: jest.fn(),
        warn: jest.fn(),
      },
    };
  }

  it('Returns validation error when required field missing from payload', async () => {
    // Arrange
    const fakeRequest = getFakeRequest({
      file: {
        path: 'filePath',
        originalname: 'originalName',
      },
    });

    // Act
    const { validationErrors, fieldValues, cleanupCallback } =
      getFileUploadAndFormFields(
        fakeRequest as unknown as FastifyMulterFileRequest,
        {
          fields: [{ key: 'test', required: true }, { key: 'test2' }],
        },
      );

    // Assert
    expect(validationErrors).toEqual(['test missing from payload']);
    expect(fieldValues).toEqual({
      test: undefined,
      test2: undefined,
      sourcePath: 'filePath',
    });
    expect(cleanupCallback).toBeDefined();
  });

  it('cleanup callback removes files in request payload', async () => {
    // Arrange
    const fakeRequest = getFakeRequest({
      file: {
        path: 'filePath',
        originalname: 'filePath',
      },
    });
    const { cleanupCallback } = getFileUploadAndFormFields(
      fakeRequest as unknown as FastifyMulterFileRequest,
      {
        fields: [{ key: 'test', required: true }, { key: 'test2' }],
      },
    );

    // Act
    await cleanupCallback();

    // Assert
    expect(mockRm).toHaveBeenCalledTimes(1);
    expect(mockRm).toHaveBeenCalledWith('filePath');
  });

  it('Returns fields provided in payload', async () => {
    // Arrange
    const fakeRequest = getFakeRequest({
      file: {
        path: 'filePath',
        originalname: 'originalName',
      },
      body: {
        test: 'test',
      },
    });

    // Act
    const { validationErrors, fieldValues, cleanupCallback } =
      getFileUploadAndFormFields(
        fakeRequest as unknown as FastifyMulterFileRequest,
        {
          fields: [{ key: 'test', required: true }, { key: 'test2' }],
        },
      );

    // Assert
    expect(validationErrors).toEqual([]);
    expect(fieldValues).toEqual({
      test: 'test',
      test2: undefined,
      sourcePath: 'filePath',
    });
    expect(cleanupCallback).toBeDefined();
  });
});
