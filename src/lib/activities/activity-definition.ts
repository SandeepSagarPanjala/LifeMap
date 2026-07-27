/** Canonical activity field types (YAML schemaVersion 1). */
export const ACTIVITY_FIELD_TYPES = [
  'photo',
  'scan',
  'money',
  'number',
  'text',
  'choice',
  'duration',
  'toggle',
] as const;

export type ActivityFieldType = (typeof ACTIVITY_FIELD_TYPES)[number];

export const ACTIVITY_SCHEMA_VERSION = 1;
export const ACTIVITY_MAX_FIELDS = 24;
export const ACTIVITY_MAX_LABEL_LENGTH = 80;
export const ACTIVITY_MAX_FIELD_ID_LENGTH = 64;
export const ACTIVITY_MAX_CHOICE_OPTIONS = 20;

export type ActivityFieldExtract = 'amount';

export type ActivityFieldDefinition = {
  id: string;
  type: ActivityFieldType;
  label: string;
  required: boolean;
  /** For `choice` — chip options. */
  options?: string[];
  /** For `scan` — what to extract (v1: amount only). */
  extract?: ActivityFieldExtract;
  /** For `scan` — target field id (must be `money` when extract is amount). */
  fillField?: string;
};

export type ActivityDefinition = {
  schemaVersion: number;
  name: string;
  emoji: string;
  fields: ActivityFieldDefinition[];
  /** Optional stable id when installed from a catalog. */
  templateId?: string;
};

export type ActivityDefinitionSource = 'blank' | 'yaml' | 'catalog';

/** Runtime values keyed by field id when logging. */
export type ActivityFieldValue =
  | { type: 'photo'; uri: string }
  | { type: 'scan'; uri: string }
  | { type: 'money'; amount: number }
  | { type: 'number'; value: number }
  | { type: 'text'; value: string }
  | { type: 'choice'; value: string }
  | { type: 'duration'; seconds: number }
  | { type: 'toggle'; value: boolean };

export type ActivityValuesMap = Record<string, ActivityFieldValue>;

export function emptyActivityDefinition(
  emoji: string,
  name: string,
): ActivityDefinition {
  return {
    schemaVersion: ACTIVITY_SCHEMA_VERSION,
    name: name.trim(),
    emoji: emoji.trim(),
    fields: [],
  };
}

export function activityHasFields(definition: ActivityDefinition): boolean {
  return definition.fields.length > 0;
}

export function parseActivityFieldsJson(
  raw: string | null | undefined,
): ActivityFieldDefinition[] {
  if (raw == null || raw.trim() === '') {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isLooseFieldShape).map(normalizeStoredField);
  } catch {
    return [];
  }
}

function isLooseFieldShape(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeStoredField(
  raw: Record<string, unknown>,
): ActivityFieldDefinition {
  const type = ACTIVITY_FIELD_TYPES.includes(raw.type as ActivityFieldType)
    ? (raw.type as ActivityFieldType)
    : 'text';
  const field: ActivityFieldDefinition = {
    id: String(raw.id ?? ''),
    type,
    label: String(raw.label ?? ''),
    required: Boolean(raw.required),
  };
  if (Array.isArray(raw.options)) {
    field.options = raw.options.map(String);
  }
  if (raw.extract === 'amount') {
    field.extract = 'amount';
  }
  if (typeof raw.fillField === 'string' && raw.fillField.trim()) {
    field.fillField = raw.fillField.trim();
  }
  return field;
}

export function serializeActivityFieldsJson(
  fields: ActivityFieldDefinition[],
): string {
  return JSON.stringify(fields);
}

export function parseActivityValuesJson(
  raw: string | null | undefined,
): ActivityValuesMap {
  if (raw == null || raw.trim() === '') {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed as ActivityValuesMap;
  } catch {
    return {};
  }
}

export function serializeActivityValuesJson(values: ActivityValuesMap): string {
  return JSON.stringify(values);
}

export function definitionFromActivityRow(input: {
  emoji: string;
  label: string;
  schemaVersion?: number | null;
  definitionJson?: string | null;
  templateId?: string | null;
}): ActivityDefinition {
  return {
    schemaVersion: input.schemaVersion ?? ACTIVITY_SCHEMA_VERSION,
    name: input.label,
    emoji: input.emoji,
    fields: parseActivityFieldsJson(input.definitionJson),
    templateId: input.templateId ?? undefined,
  };
}
