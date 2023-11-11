export function defaultMakeRequestDelay(
  attempt: number,
  {
    base,
  }: {
    base: number;
  } = {
    base: 500,
  },
) {
  return new Promise<void>((resolve) => {
    setTimeout(
      () => {
        resolve();
      },
      Math.pow(2, attempt) * base,
    );
  });
}
