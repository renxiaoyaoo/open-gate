CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`mobile_mask` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` text,
	`action` text NOT NULL,
	`target` text,
	`success` integer NOT NULL,
	`message` text,
	`idempotency_key` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `doors` (
	`account_id` text NOT NULL,
	`community_id` integer NOT NULL,
	`door_control_id` integer NOT NULL,
	`name` text NOT NULL,
	`community_name` text,
	`community_code` text,
	`mac` text,
	`device_model` text,
	`password_supported` integer DEFAULT false NOT NULL,
	`refreshed_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `doors_account_community_door` ON `doors` (`account_id`,`community_id`,`door_control_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`account_id` text PRIMARY KEY NOT NULL,
	`encrypted_state` text NOT NULL,
	`verified_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
