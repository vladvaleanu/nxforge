/**
 * Permission Service
 * Handles document and category permission checks
 */

// import { prisma } from '../../../../packages/backend/src/lib/prisma';
import { PrismaClient } from '@prisma/client';

type PermissionLevel = 'VIEW' | 'EDIT' | 'ADMIN';

export class PermissionService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Check if user has permission to perform action on category
   */
  async hasCategoryPermission(
    userId: string,
    categoryId: string,
    requiredLevel: PermissionLevel
  ): Promise<boolean> {
    // Check if user has category-level permission
    const permission = await this.prisma.$queryRaw<Array<{ permission: string }>>`
      SELECT permission FROM document_category_permissions
      WHERE category_id = ${categoryId}::uuid
      AND user_id = ${userId}
    `;

    if (permission.length === 0) {
      // No explicit permission - check if user is admin
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          roles: {
            include: {
              role: true
            }
          }
        }
      });

      const isAdmin = user?.roles.some(ur => ur.role.name === 'admin');
      return isAdmin || false;
    }

    const userPermission = permission[0].permission;
    return this.hasRequiredLevel(userPermission as PermissionLevel, requiredLevel);
  }

  /**
   * Check if user has permission to perform action on document
   */
  async hasDocumentPermission(
    userId: string,
    documentId: string,
    requiredLevel: PermissionLevel
  ): Promise<boolean> {
    // First check document-level permissions
    const docPermission = await this.prisma.$queryRaw<Array<{ permission: string }>>`
      SELECT permission FROM document_permissions
      WHERE document_id = ${documentId}::uuid
      AND user_id = ${userId}
    `;

    if (docPermission.length > 0) {
      const userPermission = docPermission[0].permission;
      return this.hasRequiredLevel(userPermission as PermissionLevel, requiredLevel);
    }

    // If no document-level permission, check if user is the author
    const document = await this.prisma.$queryRaw<Array<{ author_id: string; category_id: string }>>`
      SELECT author_id, category_id FROM documents WHERE id = ${documentId}::uuid
    `;

    if (document.length === 0) {
      return false;
    }

    // Authors have EDIT permission by default
    if (document[0].author_id === userId) {
      return this.hasRequiredLevel('EDIT', requiredLevel);
    }

    // Fall back to category-level permission
    return this.hasCategoryPermission(userId, document[0].category_id, requiredLevel);
  }

  /**
   * Check if permission level is sufficient
   */
  private hasRequiredLevel(userLevel: PermissionLevel, requiredLevel: PermissionLevel): boolean {
    const levels: PermissionLevel[] = ['VIEW', 'EDIT', 'ADMIN'];
    const userLevelIndex = levels.indexOf(userLevel);
    const requiredLevelIndex = levels.indexOf(requiredLevel);
    return userLevelIndex >= requiredLevelIndex;
  }

  /**
   * Grant category permission to user
   */
  async grantCategoryPermission(
    categoryId: string,
    userId: string,
    permission: PermissionLevel
  ): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO document_category_permissions (category_id, user_id, permission)
      VALUES (${categoryId}::uuid, ${userId}, ${permission}::document_permission_level)
      ON CONFLICT (category_id, user_id)
      DO UPDATE SET permission = ${permission}::document_permission_level
    `;
  }

  /**
   * Grant document permission to user
   */
  async grantDocumentPermission(
    documentId: string,
    userId: string,
    permission: PermissionLevel
  ): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO document_permissions (document_id, user_id, permission)
      VALUES (${documentId}::uuid, ${userId}, ${permission}::document_permission_level)
      ON CONFLICT (document_id, user_id)
      DO UPDATE SET permission = ${permission}::document_permission_level
    `;
  }

  /**
   * Revoke category permission from user
   */
  async revokeCategoryPermission(categoryId: string, userId: string): Promise<void> {
    await this.prisma.$executeRaw`
      DELETE FROM document_category_permissions
      WHERE category_id = ${categoryId}::uuid AND user_id = ${userId}
    `;
  }

  /**
   * Revoke document permission from user
   */
  async revokeDocumentPermission(documentId: string, userId: string): Promise<void> {
    await this.prisma.$executeRaw`
      DELETE FROM document_permissions
      WHERE document_id = ${documentId}::uuid AND user_id = ${userId}
    `;
  }
}
