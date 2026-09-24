import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const roles = [
    { code: 'ADMIN', name: 'Administrator', description: 'Akses penuh ke sistem' },
    { code: 'SUPERVISOR', name: 'Supervisor', description: 'Mengawasi jalannya produksi' },
    { code: 'OPERATOR', name: 'Operator', description: 'Mengoperasikan mesin' },
  ]

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {},
      create: role,
    })
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } })

  const hashedPassword = await bcrypt.hash('admin123', 10)

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      password: hashedPassword,
      roleId: adminRole.id,
    },
    create: {
      username: 'admin',
      password: hashedPassword,
      name: 'Administrator Utama',
      email: 'admin@andon.local',
      roleId: adminRole.id,
    },
  })

  const shift = await prisma.shift.upsert({
    where: { code: 'SHIFT-1' },
    update: {},
    create: {
      code: 'SHIFT-1',
      name: 'Shift 1',
      startTime: '07:00',
      endTime: '15:00',
      description: 'Shift pagi',
    },
  })

  const machine = await prisma.machine.upsert({
    where: { code: 'M-001' },
    update: {},
    create: { code: 'M-001', name: 'CNC Milling', location: 'Lantai Produksi A' },
  })

  const item = await prisma.item.upsert({
    where: { code: 'ITEM-001' },
    update: {},
    create: { code: 'ITEM-001', name: 'Shaft Bearing', description: 'Komponen utama gearbox' },
  })

  await prisma.abnormality.createMany({
    data: [
      { code: 'AB-001', name: 'Pallet Tabrak', machineId: machine.id },
      { code: 'AB-002', name: 'Overload', machineId: machine.id },
    ],
    skipDuplicates: true,
  })

  await prisma.defect.createMany({
    data: [
      { code: 'DF-001', name: 'Scratch', itemId: item.id },
      { code: 'DF-002', name: 'Dimension NG', itemId: item.id },
    ],
    skipDuplicates: true,
  })

  await prisma.productionSetup.upsert({
    where: { code: 'PS-001' },
    update: {},
    create: {
      code: 'PS-001',
      shiftId: shift.id,
      machineId: machine.id,
      itemId: item.id,
      operatorId: admin.id,
      targetQuantity: 500,
      status: 'PLANNED',
    },
  })

  console.log('Seed selesai. Akun admin: admin / admin123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())