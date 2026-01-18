-- Add missing ModuleStatus enum values
-- These values exist in TypeScript but were missing from the database

ALTER TYPE "ModuleStatus" ADD VALUE IF NOT EXISTS 'INSTALLED';
ALTER TYPE "ModuleStatus" ADD VALUE IF NOT EXISTS 'ENABLING';
ALTER TYPE "ModuleStatus" ADD VALUE IF NOT EXISTS 'DISABLING';
ALTER TYPE "ModuleStatus" ADD VALUE IF NOT EXISTS 'ERROR';
