import { defaultMakeRequestDelay } from '../default-make-request-delay';

describe('default-make-request-delay', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('when attempt is 1, returns promise that resolves after 500ms', async () => {
    // Arrange
    jest.useFakeTimers();
    const attempt = 1;
    const expectedDelay = 1000;
    const spySetTimeout = jest.spyOn(global, 'setTimeout');

    // Act
    const result = defaultMakeRequestDelay(attempt);
    jest.advanceTimersByTime(expectedDelay + 1);
    jest.runAllTimers();

    // Assert
    await expect(result).resolves.toBeUndefined();
    expect(spySetTimeout).toHaveBeenCalledWith(
      expect.any(Function),
      expectedDelay,
    );
  });
});
