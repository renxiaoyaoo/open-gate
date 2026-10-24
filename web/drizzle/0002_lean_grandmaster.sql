ALTER TABLE `accounts` ADD `mobile_fingerprint` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `display_name` text;--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_mobile_fingerprint` ON `accounts` (`mobile_fingerprint`);--> statement-breakpoint
ALTER TABLE `doors` ADD `public_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `doors_public_id` ON `doors` (`public_id`);