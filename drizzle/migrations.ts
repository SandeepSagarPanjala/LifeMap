import journal from './meta/_journal.json';

const m0000 = `CREATE TABLE \`location_points\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`timestamp\` integer NOT NULL,
	\`lat\` real NOT NULL,
	\`lng\` real NOT NULL,
	\`accuracy\` real,
	\`altitude\` real,
	\`speed\` real,
	\`source\` text DEFAULT 'gps' NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`moments\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`type\` text NOT NULL,
	\`timestamp\` integer NOT NULL,
	\`lat\` real,
	\`lng\` real,
	\`content_path\` text,
	\`text_body\` text,
	\`caption\` text,
	\`place_label\` text,
	\`linked_point_id\` integer,
	\`share_visibility\` text DEFAULT 'private' NOT NULL,
	\`content_sync_state\` text DEFAULT 'local_only' NOT NULL,
	FOREIGN KEY (\`linked_point_id\`) REFERENCES \`location_points\`(\`id\`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE \`settings\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`key\` text NOT NULL,
	\`value\` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`settings_key_unique\` ON \`settings\` (\`key\`);`;

export default {
  journal,
  migrations: {
    m0000,
  },
};
