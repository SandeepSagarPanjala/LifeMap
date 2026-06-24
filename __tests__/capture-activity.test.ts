import {
  createActivity,
  listActiveActivities,
  updateActivity,
  archiveActivity,
} from '@/db/repositories/activities';
import {saveActivityMoment} from '@/lib/moments/capture-activity';
import {getMomentById} from '@/db/repositories/moments';

jest.mock('@/db/client', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('@/db/repositories/activities');
jest.mock('@/db/repositories/moments', () => ({
  ...jest.requireActual('@/db/repositories/moments'),
  insertMoment: jest.fn(),
  getMomentById: jest.fn(),
}));

const mockedInsertMoment = jest.requireMock('@/db/repositories/moments')
  .insertMoment as jest.Mock;

describe('capture activity', () => {
  it('snapshots emoji and label when logging', async () => {
    const activity = {
      id: 3,
      emoji: '🏋️',
      label: 'Gym',
      sortOrder: 0,
      createdAt: new Date('2026-06-08T12:00:00.000Z'),
      archivedAt: null,
    };
    mockedInsertMoment.mockResolvedValue({
      id: 99,
      type: 'activity',
      timestamp: new Date('2026-06-08T14:00:00.000Z'),
      activityId: 3,
      activityEmoji: '🏋️',
      activityLabel: 'Gym',
    });

    await saveActivityMoment(activity);

    expect(mockedInsertMoment).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'activity',
        activityId: 3,
        activityEmoji: '🏋️',
        activityLabel: 'Gym',
        contentFormat: 'activity',
      }),
    );
  });
});

describe('activities repository exports', () => {
  it('exports catalog helpers', () => {
    expect(typeof listActiveActivities).toBe('function');
    expect(typeof createActivity).toBe('function');
    expect(typeof updateActivity).toBe('function');
    expect(typeof archiveActivity).toBe('function');
    expect(typeof getMomentById).toBe('function');
  });
});
