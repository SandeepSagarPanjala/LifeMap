import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import type { ActivityDefinition } from '@/lib/activities/activity-definition';
import {
  validateActivityDefinition,
  type ActivityDefinitionValidationResult,
} from '@/lib/activities/validate-activity-definition';

/** Parse YAML activity template text into a validated definition. */
export function parseActivityYaml(
  source: string,
): ActivityDefinitionValidationResult {
  const trimmed = source.trim();
  if (!trimmed) {
    return { ok: false, error: 'Paste an activity YAML definition.' };
  }
  let parsed: unknown;
  try {
    parsed = parseYaml(trimmed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Invalid YAML syntax.';
    return { ok: false, error: `YAML syntax error: ${message}` };
  }
  return validateActivityDefinition(parsed);
}

/** Serialize a definition to human-readable YAML for copy/export. */
export function stringifyActivityYaml(definition: ActivityDefinition): string {
  const doc: Record<string, unknown> = {
    schemaVersion: definition.schemaVersion,
    name: definition.name,
    emoji: definition.emoji,
  };
  if (definition.templateId) {
    doc.id = definition.templateId;
  }
  doc.fields = definition.fields.map(field => {
    const entry: Record<string, unknown> = {
      id: field.id,
      type: field.type,
      label: field.label,
      required: field.required,
    };
    if (field.options != null) {
      entry.options = field.options;
    }
    if (field.extract != null) {
      entry.extract = field.extract;
    }
    if (field.fillField != null) {
      entry.fillField = field.fillField;
    }
    return entry;
  });
  return stringifyYaml(doc, { lineWidth: 0 }).trimEnd() + '\n';
}

export type ActivityCatalogFile = {
  schemaVersion: number;
  activities: ActivityDefinition[];
};

/** Parse a catalog YAML with top-level `activities:` list. */
export function parseActivityCatalogYaml(
  source: string,
):
  | { ok: true; catalog: ActivityCatalogFile }
  | { ok: false; error: string } {
  const trimmed = source.trim();
  if (!trimmed) {
    return { ok: false, error: 'Catalog is empty.' };
  }
  let parsed: unknown;
  try {
    parsed = parseYaml(trimmed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Invalid YAML syntax.';
    return { ok: false, error: `YAML syntax error: ${message}` };
  }
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Catalog must be an object with activities.' };
  }
  const record = parsed as Record<string, unknown>;
  const schemaVersion =
    typeof record.schemaVersion === 'number' ? record.schemaVersion : 1;
  const list = record.activities;
  if (!Array.isArray(list)) {
    return { ok: false, error: 'Catalog must include an activities list.' };
  }
  const activities: ActivityDefinition[] = [];
  for (let index = 0; index < list.length; index += 1) {
    const result = validateActivityDefinition(list[index]);
    if (!result.ok) {
      return {
        ok: false,
        error: `Activity ${index + 1}: ${result.error}`,
      };
    }
    activities.push(result.definition);
  }
  return {
    ok: true,
    catalog: { schemaVersion, activities },
  };
}
