export type SQLiteDatabase = {
  exec: jest.Mock;
};

export const open = jest.fn((): SQLiteDatabase => {
  return {
    exec: jest.fn(),
  };
});

