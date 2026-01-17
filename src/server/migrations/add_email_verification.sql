-- Add email verification fields to users table
ALTER TABLE users 
ADD COLUMN email_verified TINYINT(1) DEFAULT 0 AFTER password,
ADD COLUMN email_verification_token VARCHAR(255) DEFAULT NULL AFTER email_verified,
ADD COLUMN email_verification_expires DATETIME DEFAULT NULL AFTER email_verification_token;

-- Create index for faster token lookup
CREATE INDEX idx_email_verification_token ON users(email_verification_token);

-- Update existing users to be verified (migration compatibility)
UPDATE users SET email_verified = 1 WHERE email_verified = 0;
