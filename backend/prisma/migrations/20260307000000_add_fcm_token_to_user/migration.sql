-- AddColumn fcmToken to User for push notifications
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "fcmToken" TEXT;
