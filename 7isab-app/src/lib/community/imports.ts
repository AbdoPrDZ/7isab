/**
 * Imports of shared community items into the user's own data.
 * Everything is written through the vault, so it is encrypted like any other
 * record; the server is only told that an import happened (for the count).
 */
import { saveTask } from '@/lib/ledger/tasks';
import type { TaskRepeat } from '@/lib/ledger/types';
import { endFromLength, saveProgram } from '@/lib/programs/programs';
import { saveTestament } from '@/lib/testaments/testaments';

import { importPost } from './api';
import type { CommunityPost, ProgramPayload, SharedTask, TestamentPayload } from './types';

/** Tells the server about the import. Never blocks it: the copy is already saved locally. */
async function recordImport(token: string | null, post: CommunityPost): Promise<void> {
  try {
    await importPost(token, post.id);
  } catch {
    // Offline or not reachable: the count is only informational.
  }
}

export async function importTestament(token: string | null, post: CommunityPost, enabled: boolean): Promise<void> {
  const payload = post.payload as TestamentPayload;
  await saveTestament({ category: payload.category, text: payload.text, source: payload.source, enabled });
  await recordImport(token, post);
}

const REPEATS: Record<string, TaskRepeat> = {
  daily: { kind: 'daily' },
  weekly: { kind: 'weekly' },
  monthly: { kind: 'monthly' },
};

function repeatOf(task: SharedTask): TaskRepeat {
  return REPEATS[task.type] ?? { kind: 'daily' };
}

/** A program and its tasks, starting on `startDate` (YYYY-MM-DD, local day). */
export async function importProgram(token: string | null, post: CommunityPost, startDate: string): Promise<void> {
  const payload = post.payload as ProgramPayload;
  const program = await saveProgram({
    name: payload.name,
    category: payload.category,
    customCategory: payload.custom_category,
    goal: payload.goal,
    startDate,
    endDate: endFromLength(startDate, payload.length),
    archived: false,
  });

  for (const task of payload.tasks) {
    await saveTask({
      kind: 'custom',
      title: task.name,
      target: { unit: 'check', amount: 1 },
      // Every configurable reward and penalty defaults to 1.
      reward: task.reward ?? 1,
      penalty: 1,
      repeat: repeatOf(task),
      startDate,
      programId: program.id,
    });
  }

  await recordImport(token, post);
}
