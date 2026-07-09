export type DB = {
  execute: jest.Mock;
  executeAsync: jest.Mock;
  transaction: jest.Mock;
};

export const open = jest.fn((): DB => {
  const db: DB = {
    execute: jest.fn().mockResolvedValue({ rows: [] }),
    executeAsync: jest.fn().mockResolvedValue({ rows: [] }),
    transaction: jest.fn(async (fn: (tx: DB) => Promise<void>) => fn(db)),
  };
  return db;
});
