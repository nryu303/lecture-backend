-- =====================================================================
-- Supabase / PostgreSQL schema for the lecture backend
-- Migrated from MongoDB/Mongoose.
--
-- Column names intentionally match the original Mongoose field names
-- (camelCase + snake_case) so the application code needs no field mapping.
-- Nested document fields are stored as jsonb.
-- Primary keys are uuid, exposed to app code as both `id` and `_id`.
--
-- Run this whole file once in the Supabase SQL Editor.
-- =====================================================================

create extension if not exists pgcrypto;  -- provides gen_random_uuid()

-- ---------------------------------------------------------------------
-- updatedAt auto-touch trigger
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$ language plpgsql;

-- =====================================================================
-- users
-- =====================================================================
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  "email"       text not null unique,
  "password"    text not null,
  "username"    text not null,
  "role"        text not null default 'student' check ("role" in ('admin','student','group_admin')),
  "lastLoginAt" timestamptz,
  "isBlocked"   boolean not null default false,
  "createdAt"   timestamptz not null default now(),
  "updatedAt"   timestamptz not null default now()
);
create index if not exists idx_users_email on users ("email");
create index if not exists idx_users_username on users ("username");
create index if not exists idx_users_role on users ("role");
create index if not exists idx_users_email_role on users ("email", "role");
drop trigger if exists trg_users_updated on users;
create trigger trg_users_updated before update on users for each row execute function set_updated_at();

-- =====================================================================
-- profiles
-- =====================================================================
create table if not exists profiles (
  id               uuid primary key default gen_random_uuid(),
  "userId"         text not null unique,
  "avatar"         text default '',
  "phone"          text default '',
  "gender"         text default '男性' check ("gender" in ('男性','女性')),
  "birthday"       timestamptz,
  "faceDescriptor" jsonb not null default '[]'::jsonb,
  "favorites"      jsonb not null default '[]'::jsonb,
  "group_id"       text default '',
  "student_id"     text unique,                -- sparse: NULL allowed many times
  "companyName"    text default '',
  "postalCode"     text default '',
  "prefecture"     text default '',
  "city"           text default '',
  "addressOther"   text default '',
  "createdAt"      timestamptz not null default now(),
  "updatedAt"      timestamptz not null default now()
);
create index if not exists idx_profiles_userId on profiles ("userId");
create index if not exists idx_profiles_student_id on profiles ("student_id");
drop trigger if exists trg_profiles_updated on profiles;
create trigger trg_profiles_updated before update on profiles for each row execute function set_updated_at();

-- =====================================================================
-- courses (enrollment-with-credentials records)
-- =====================================================================
create table if not exists courses (
  id                 uuid primary key default gen_random_uuid(),
  "userId"           text not null,
  "courseId"         text not null,
  "courseName"       text not null,
  "studentId"        text not null unique,
  "password"         text not null,
  "enrollmentAt"     timestamptz not null default now(),
  "videoProgress"    jsonb not null default '[]'::jsonb,
  "documentProgress" jsonb not null default '[]'::jsonb,
  "lectureProgress"  jsonb not null default '[]'::jsonb,
  "completionRate"   numeric not null default 0,
  "examEligible"     boolean not null default false,
  "status"           text not null default 'active' check ("status" in ('active','completed','suspended','cancelled')),
  "paymentId"        text,
  "subscriptionId"   text,
  "paymentAmount"    numeric not null default 0,
  "lastAccessedAt"   timestamptz default now(),
  "expiresAt"        timestamptz,
  "completedAt"      timestamptz,
  "notes"            text default '',
  "createdAt"        timestamptz not null default now(),
  "updatedAt"        timestamptz not null default now(),
  unique ("userId", "courseId")
);
create index if not exists idx_courses_userId on courses ("userId");
create index if not exists idx_courses_courseId on courses ("courseId");
create index if not exists idx_courses_studentId on courses ("studentId");
create index if not exists idx_courses_userId_status on courses ("userId", "status");
create index if not exists idx_courses_status_enrollmentAt on courses ("status", "enrollmentAt" desc);
create index if not exists idx_courses_examEligible on courses ("examEligible");
drop trigger if exists trg_courses_updated on courses;
create trigger trg_courses_updated before update on courses for each row execute function set_updated_at();

-- =====================================================================
-- materials
-- =====================================================================
create table if not exists materials (
  id              uuid primary key default gen_random_uuid(),
  "type"          text not null default 'video' check ("type" in ('video','pdf')),
  "title"         text not null,
  "description"   text not null,
  "courseId"      text not null,
  "courseName"    text not null,
  "videoUrl"      text,
  "videoFileName" text,
  "videoSize"     numeric default 0,
  "pdfUrl"        text,
  "pdfFileName"   text,
  "pdfSize"       numeric default 0,
  "tags"          jsonb not null default '[]'::jsonb,
  "uploadedBy"    text not null,
  "uploadedAt"    timestamptz default now(),
  "lastModified"  timestamptz default now(),
  "viewCount"     numeric not null default 0,
  "downloadCount" numeric not null default 0,
  "createdAt"     timestamptz not null default now(),
  "updatedAt"     timestamptz not null default now()
);
create index if not exists idx_materials_courseId on materials ("courseId");
create index if not exists idx_materials_uploadedBy on materials ("uploadedBy");
create index if not exists idx_materials_type on materials ("type");
create index if not exists idx_materials_createdAt on materials ("createdAt" desc);
drop trigger if exists trg_materials_updated on materials;
create trigger trg_materials_updated before update on materials for each row execute function set_updated_at();

-- =====================================================================
-- enrollments
-- =====================================================================
create table if not exists enrollments (
  id                uuid primary key default gen_random_uuid(),
  "enrollment_id"   text not null unique,
  "student_id"      text not null,
  "course_id"       text not null,
  "ticket_id"       text not null,
  "enrolled_date"   timestamptz not null default now(),
  "progress_status" text not null default 'not_started' check ("progress_status" in ('not_started','in_progress','completed')),
  "createdAt"       timestamptz not null default now(),
  "updatedAt"       timestamptz not null default now(),
  unique ("student_id", "course_id")
);
create index if not exists idx_enrollments_student_id on enrollments ("student_id");
create index if not exists idx_enrollments_course_id on enrollments ("course_id");
create index if not exists idx_enrollments_ticket_id on enrollments ("ticket_id");
create index if not exists idx_enrollments_student_date on enrollments ("student_id", "enrolled_date" desc);
drop trigger if exists trg_enrollments_updated on enrollments;
create trigger trg_enrollments_updated before update on enrollments for each row execute function set_updated_at();

-- =====================================================================
-- exams
-- =====================================================================
create table if not exists exams (
  id                   uuid primary key default gen_random_uuid(),
  "title"              text not null,
  "description"        text not null,
  "courseId"           text not null,
  "courseName"         text not null,
  "instructions"       text default '',
  "timeLimit"          numeric,
  "maxAttempts"        numeric not null default 1,
  "passingScore"       numeric not null default 70,
  "shuffleQuestions"   boolean not null default false,
  "shuffleOptions"     boolean not null default false,
  "showCorrectAnswers" boolean not null default true,
  "showFeedback"       boolean not null default true,
  "status"             text not null default 'draft' check ("status" in ('draft','published','archived')),
  "questions"          jsonb not null default '[]'::jsonb,   -- array of question id strings
  "totalQuestions"     numeric not null default 0,
  "totalPoints"        numeric not null default 0,
  "createdBy"          text not null,
  "createdAt"          timestamptz not null default now(),
  "updatedAt"          timestamptz not null default now()
);
create index if not exists idx_exams_courseId on exams ("courseId");
create index if not exists idx_exams_status on exams ("status");
create index if not exists idx_exams_createdBy on exams ("createdBy");
create index if not exists idx_exams_createdAt on exams ("createdAt" desc);
drop trigger if exists trg_exams_updated on exams;
create trigger trg_exams_updated before update on exams for each row execute function set_updated_at();

-- =====================================================================
-- questions (belong to an exam)
-- =====================================================================
create table if not exists questions (
  id               uuid primary key default gen_random_uuid(),
  "examId"         uuid not null,
  "type"           text not null check ("type" in ('true_false','multiple_choice','single_choice')),
  "title"          text not null,
  "content"        text not null,
  "points"         numeric not null default 1,
  "order"          numeric not null,
  "correctAnswer"  boolean,
  "options"        jsonb not null default '[]'::jsonb,
  "correctOptions" jsonb not null default '[]'::jsonb,
  "explanation"    text default '',
  "feedback"       text default '',
  "difficulty"     text not null default 'medium' check ("difficulty" in ('easy','medium','hard')),
  "tags"           jsonb not null default '[]'::jsonb,
  "isActive"       boolean not null default true,
  "createdBy"      text not null,
  "createdAt"      timestamptz not null default now(),
  "updatedAt"      timestamptz not null default now()
);
create index if not exists idx_questions_examId_order on questions ("examId", "order");
create index if not exists idx_questions_type on questions ("type");
create index if not exists idx_questions_isActive on questions ("isActive");
create index if not exists idx_questions_createdBy on questions ("createdBy");
drop trigger if exists trg_questions_updated on questions;
create trigger trg_questions_updated before update on questions for each row execute function set_updated_at();

-- =====================================================================
-- standalone_questions (course-level question bank, not tied to an exam)
-- =====================================================================
create table if not exists standalone_questions (
  id               uuid primary key default gen_random_uuid(),
  "type"           text not null check ("type" in ('true_false','multiple_choice','single_choice')),
  "title"          text not null,
  "content"        text not null,
  "courseId"       text not null,
  "courseName"     text not null,
  "correctAnswer"  boolean,
  "options"        jsonb not null default '[]'::jsonb,
  "correctOptions" jsonb not null default '[]'::jsonb,
  "estimatedTime"  numeric not null default 2,
  "explanation"    text default '',
  "feedback"       text default '',
  "tags"           jsonb not null default '[]'::jsonb,
  "isActive"       boolean not null default true,
  "createdBy"      text not null,
  "createdAt"      timestamptz not null default now(),
  "updatedAt"      timestamptz not null default now()
);
create index if not exists idx_squestions_type on standalone_questions ("type");
create index if not exists idx_squestions_courseId on standalone_questions ("courseId");
create index if not exists idx_squestions_isActive on standalone_questions ("isActive");
create index if not exists idx_squestions_createdBy on standalone_questions ("createdBy");
drop trigger if exists trg_squestions_updated on standalone_questions;
create trigger trg_squestions_updated before update on standalone_questions for each row execute function set_updated_at();

-- =====================================================================
-- exam_attempts
-- =====================================================================
create table if not exists exam_attempts (
  id              uuid primary key default gen_random_uuid(),
  "examId"        uuid not null,
  "studentId"     text not null,
  "studentName"   text not null,
  "attemptNumber" numeric not null,
  "status"        text not null default 'in_progress' check ("status" in ('in_progress','completed','abandoned','timeout')),
  "startedAt"     timestamptz default now(),
  "completedAt"   timestamptz,
  "timeSpent"     numeric not null default 0,
  "answers"       jsonb not null default '[]'::jsonb,
  "score"         numeric not null default 0,
  "percentage"    numeric not null default 0,
  "passed"        boolean not null default false,
  "feedback"      text default '',
  "createdAt"     timestamptz not null default now(),
  "updatedAt"     timestamptz not null default now(),
  unique ("examId", "studentId", "attemptNumber")
);
create index if not exists idx_attempts_examId on exam_attempts ("examId");
create index if not exists idx_attempts_studentId on exam_attempts ("studentId");
create index if not exists idx_attempts_status on exam_attempts ("status");
create index if not exists idx_attempts_completedAt on exam_attempts ("completedAt" desc);
drop trigger if exists trg_attempts_updated on exam_attempts;
create trigger trg_attempts_updated before update on exam_attempts for each row execute function set_updated_at();

-- =====================================================================
-- exam_histories
-- =====================================================================
create table if not exists exam_histories (
  id               uuid primary key default gen_random_uuid(),
  "examineeId"     text not null,
  "examineeName"   text not null,
  "answers"        jsonb not null default '[]'::jsonb,
  "score"          numeric not null,
  "totalQuestions" numeric not null,
  "percentage"     numeric not null,
  "passed"         boolean not null,
  "passingGrade"   numeric not null default 60,
  "timeAll"        numeric not null,
  "timeSpent"      numeric not null,
  "submittedAt"    timestamptz not null,
  "gradedAt"       timestamptz not null,
  "status"         text not null default 'completed' check ("status" in ('completed','incomplete','timeout')),
  "createdAt"      timestamptz not null default now(),
  "updatedAt"      timestamptz not null default now()
);
create index if not exists idx_histories_examinee_submitted on exam_histories ("examineeId", "submittedAt" desc);
create index if not exists idx_histories_passed on exam_histories ("passed");
create index if not exists idx_histories_percentage on exam_histories ("percentage");
create index if not exists idx_histories_submittedAt on exam_histories ("submittedAt" desc);
drop trigger if exists trg_histories_updated on exam_histories;
create trigger trg_histories_updated before update on exam_histories for each row execute function set_updated_at();

-- =====================================================================
-- exam_settings (single-row settings)
-- =====================================================================
create table if not exists exam_settings (
  id                                uuid primary key default gen_random_uuid(),
  "timeLimit"                       numeric not null default 60,
  "numberOfQuestions"               numeric not null default 20,
  "passingScore"                    numeric not null default 70,
  "faceVerificationIntervalMinutes" numeric not null default 15,
  "lastUpdated"                     timestamptz default now(),
  "updatedBy"                       text default 'admin',
  "createdAt"                       timestamptz not null default now(),
  "updatedAt"                       timestamptz not null default now()
);
drop trigger if exists trg_settings_updated on exam_settings;
create trigger trg_settings_updated before update on exam_settings for each row execute function set_updated_at();

-- =====================================================================
-- certificates
-- =====================================================================
create table if not exists certificates (
  id                  uuid primary key default gen_random_uuid(),
  "userId"            text not null,
  "certificateNumber" text not null unique,
  "name"              text not null,
  "gender"            text not null,
  "startDate"         timestamptz not null,
  "endDate"           timestamptz not null,
  "issueDate"         timestamptz not null default now(),
  "issuedBy"          text not null,
  "createdAt"         timestamptz not null default now(),
  "updatedAt"         timestamptz not null default now()
);
create index if not exists idx_certificates_userId on certificates ("userId");
create index if not exists idx_certificates_issuedBy on certificates ("issuedBy");
drop trigger if exists trg_certificates_updated on certificates;
create trigger trg_certificates_updated before update on certificates for each row execute function set_updated_at();

-- =====================================================================
-- face_data (one per user)
-- =====================================================================
create table if not exists face_data (
  id                        uuid primary key default gen_random_uuid(),
  "userId"                  uuid not null unique,
  "descriptor"              jsonb not null,
  "imageData"               text,
  "registeredAt"            timestamptz default now(),
  "lastVerifiedAt"          timestamptz,
  "verificationCount"       numeric not null default 0,
  "failedVerificationCount" numeric not null default 0,
  "createdAt"               timestamptz not null default now(),
  "updatedAt"               timestamptz not null default now()
);
create index if not exists idx_facedata_userId on face_data ("userId");
drop trigger if exists trg_facedata_updated on face_data;
create trigger trg_facedata_updated before update on face_data for each row execute function set_updated_at();

-- =====================================================================
-- notifications
-- =====================================================================
create table if not exists notifications (
  id            uuid primary key default gen_random_uuid(),
  "title"       text not null,
  "message"     text not null,
  "recipientId" text not null,
  "senderId"    text not null,
  "isRead"      boolean not null default false,
  "readAt"      timestamptz,
  "type"        text not null default 'info' check ("type" in ('info','warning','success','error')),
  "metadata"    jsonb,
  "createdAt"   timestamptz not null default now(),
  "updatedAt"   timestamptz not null default now()
);
create index if not exists idx_notifications_recipientId on notifications ("recipientId");
create index if not exists idx_notifications_senderId on notifications ("senderId");
create index if not exists idx_notifications_recipient_read on notifications ("recipientId", "isRead");
create index if not exists idx_notifications_recipient_created on notifications ("recipientId", "createdAt" desc);
drop trigger if exists trg_notifications_updated on notifications;
create trigger trg_notifications_updated before update on notifications for each row execute function set_updated_at();

-- =====================================================================
-- orders
-- =====================================================================
create table if not exists orders (
  id                uuid primary key default gen_random_uuid(),
  "order_id"        text not null unique,
  "group_admin_id"  text not null,
  "purchase_date"   timestamptz not null default now(),
  "course_id"       text not null,
  "quantity"        numeric not null check ("quantity" >= 1),
  "payment_id"      text not null,
  "status"          text not null default 'pending' check ("status" in ('pending','completed','cancelled','refunded')),
  "createdAt"       timestamptz not null default now(),
  "updatedAt"       timestamptz not null default now()
);
create index if not exists idx_orders_group_admin_id on orders ("group_admin_id");
create index if not exists idx_orders_course_id on orders ("course_id");
create index if not exists idx_orders_payment_id on orders ("payment_id");
create index if not exists idx_orders_group_purchase on orders ("group_admin_id", "purchase_date" desc);
drop trigger if exists trg_orders_updated on orders;
create trigger trg_orders_updated before update on orders for each row execute function set_updated_at();

-- =====================================================================
-- tickets
-- =====================================================================
create table if not exists tickets (
  id              uuid primary key default gen_random_uuid(),
  "ticket_id"     text not null unique,
  "course_id"     text not null,
  "purchased_by"  text not null,
  "assigned_to"   text,
  "assigned_date" timestamptz,
  "status"        text not null default 'unused' check ("status" in ('unused','assigned','in_use','completed','cancelled')),
  "order_id"      text not null,
  "createdAt"     timestamptz not null default now(),
  "updatedAt"     timestamptz not null default now()
);
create index if not exists idx_tickets_course_id on tickets ("course_id");
create index if not exists idx_tickets_purchased_by on tickets ("purchased_by");
create index if not exists idx_tickets_assigned_to on tickets ("assigned_to");
create index if not exists idx_tickets_purchased_status on tickets ("purchased_by", "status");
create index if not exists idx_tickets_assigned_course on tickets ("assigned_to", "course_id");
create index if not exists idx_tickets_course_status on tickets ("course_id", "status");
drop trigger if exists trg_tickets_updated on tickets;
create trigger trg_tickets_updated before update on tickets for each row execute function set_updated_at();
