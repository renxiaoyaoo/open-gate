DROP INDEX `accounts_mobile_fingerprint`;--> statement-breakpoint
ALTER TABLE `accounts` ADD `provider` text DEFAULT 'opengate' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_provider_mobile_fingerprint` ON `accounts` (`provider`,`mobile_fingerprint`);