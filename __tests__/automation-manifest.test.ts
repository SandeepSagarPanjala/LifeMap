import fs from 'node:fs';
import path from 'node:path';

import {
  AUTOMATION_FLOW_IDS,
  AUTOMATION_FLOWS,
  automationFlowRelativePath,
} from '../automation/flows';

const UI_ROOT = path.join(__dirname, '..', '__UI__');

function listMainFlowIds(): string[] {
  const concepts = fs
    .readdirSync(UI_ROOT, {withFileTypes: true})
    .filter(entry => entry.isDirectory() && entry.name !== 'shared')
    .map(entry => entry.name);

  const ids: string[] = [];
  for (const concept of concepts) {
    const conceptDir = path.join(UI_ROOT, concept);
    for (const file of fs.readdirSync(conceptDir)) {
      if (!file.endsWith('.yaml')) {
        continue;
      }
      ids.push(file.replace(/\.yaml$/, ''));
    }
  }
  return ids.sort();
}

describe('automation manifest', () => {
  it('lists a unique yaml flow file for every registered journey', () => {
    const ids = new Set<string>();

    for (const flow of AUTOMATION_FLOWS) {
      expect(ids.has(flow.id)).toBe(false);
      ids.add(flow.id);

      const filePath = path.join(
        __dirname,
        '..',
        automationFlowRelativePath(flow),
      );
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });

  it('does not leave orphan main flow files outside the manifest', () => {
    expect(listMainFlowIds()).toEqual([...AUTOMATION_FLOW_IDS].sort());
  });
});
