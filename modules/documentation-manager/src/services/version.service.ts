/**
 * Version Service
 * Handles document version control
 */

// import { prisma } from '../../../../packages/backend/src/lib/prisma';
import { PrismaClient } from '@prisma/client';

export class VersionService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create a new version for a document
   */
  async createVersion(
    documentId: string,
    title: string,
    content: string,
    authorId: string,
    changeNote?: string
  ) {
    // Get current max version number
    const maxVersion = await this.prisma.$queryRaw<Array<{ max: number }>>`
      SELECT COALESCE(MAX(version), 0) as max
      FROM document_versions
      WHERE document_id = ${documentId}::uuid
    `;

    const nextVersion = (maxVersion[0]?.max || 0) + 1;

    await this.prisma.$executeRaw`
      INSERT INTO document_versions (document_id, version, title, content, author_id, change_note)
      VALUES (
        ${documentId}::uuid,
        ${nextVersion},
        ${title},
        ${content},
        ${authorId},
        ${changeNote || null}
      )
    `;

    return nextVersion;
  }

  /**
   * Get all versions for a document
   */
  async getVersions(documentId: string) {
    const versions = await this.prisma.$queryRaw<Array<any>>`
      SELECT
        v.id,
        v.version,
        v.title,
        v.change_note,
        v.created_at,
        json_build_object(
          'id', u.id,
          'username', u.username,
          'email', u.email
        ) as author
      FROM document_versions v
      JOIN users u ON v.author_id = u.id
      WHERE v.document_id = ${documentId}::uuid
      ORDER BY v.version DESC
    `;

    return versions;
  }

  /**
   * Get specific version
   */
  async getVersion(documentId: string, version: number) {
    const versions = await this.prisma.$queryRaw<Array<any>>`
      SELECT
        v.*,
        json_build_object(
          'id', u.id,
          'username', u.username,
          'email', u.email
        ) as author
      FROM document_versions v
      JOIN users u ON v.author_id = u.id
      WHERE v.document_id = ${documentId}::uuid AND v.version = ${version}
    `;

    return versions[0] || null;
  }

  /**
   * Restore document to a previous version
   */
  async restoreVersion(documentId: string, version: number, userId: string) {
    const versionData = await this.getVersion(documentId, version);

    if (!versionData) {
      throw new Error('Version not found');
    }

    // Update document with version content
    await this.prisma.$executeRaw`
      UPDATE documents
      SET
        title = ${versionData.title},
        content = ${versionData.content},
        updated_at = NOW()
      WHERE id = ${documentId}::uuid
    `;

    // Create new version for the restore action
    await this.createVersion(
      documentId,
      versionData.title,
      versionData.content,
      userId,
      `Restored from version ${version}`
    );
  }
}
