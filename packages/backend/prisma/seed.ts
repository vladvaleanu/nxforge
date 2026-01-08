/**
 * Database seed script
 * Creates initial roles and admin user
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Administrator with full system access',
      permissions: JSON.parse(JSON.stringify([
        '*:*', // Full access to all resources
      ])),
    },
  });

  const operatorRole = await prisma.role.upsert({
    where: { name: 'operator' },
    update: {},
    create: {
      name: 'operator',
      description: 'Operator with module management and execution permissions',
      permissions: JSON.parse(JSON.stringify([
        'modules:read',
        'modules:write',
        'modules:execute',
        'jobs:read',
        'jobs:write',
        'users:read',
      ])),
    },
  });

  const viewerRole = await prisma.role.upsert({
    where: { name: 'viewer' },
    update: {},
    create: {
      name: 'viewer',
      description: 'Read-only access to system data',
      permissions: JSON.parse(JSON.stringify([
        'modules:read',
        'jobs:read',
        'users:read',
      ])),
    },
  });

  console.log('✅ Created roles:', { adminRole, operatorRole, viewerRole });

  // Create default admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@automation-platform.local' },
    update: {},
    create: {
      email: 'admin@automation-platform.local',
      username: 'admin',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      isActive: true,
    },
  });

  // Assign admin role to admin user
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });

  console.log('✅ Created admin user:', {
    email: adminUser.email,
    username: adminUser.username,
    password: 'admin123',
  });

  console.log('\n🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
