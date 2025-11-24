ALTER TABLE chat_assignments
ADD COLUMN conversation_status ENUM('open', 'pending', 'closed') DEFAULT 'open';
