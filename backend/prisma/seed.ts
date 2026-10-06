import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Clean existing data
  await prisma.productionLog.deleteMany()
  await prisma.workOrder.deleteMany()
  await prisma.productionSetup.deleteMany()
  await prisma.defect.deleteMany()
  await prisma.abnormality.deleteMany()
  await prisma.item.deleteMany()
  await prisma.machine.deleteMany()
  await prisma.shift.deleteMany()
  await prisma.user.deleteMany()
  await prisma.role.deleteMany()

  // Roles
  await prisma.role.createMany({
    data: [
      { code: 'ADMIN', name: 'Administrator', description: 'Akses penuh ke sistem' },
      { code: 'SUPERVISOR', name: 'Supervisor', description: 'Mengawasi jalannya produksi' },
      { code: 'OPERATOR', name: 'Operator', description: 'Mengoperasikan mesin' },
    ],
    skipDuplicates: true,
  })

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } })
  const supervisorRole = await prisma.role.findUniqueOrThrow({ where: { code: 'SUPERVISOR' } })
  const operatorRole = await prisma.role.findUniqueOrThrow({ where: { code: 'OPERATOR' } })

  // Users
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      password: await bcrypt.hash('admin123', 10),
      name: 'Administrator Utama',
      email: 'admin@andon.local',
      roleId: adminRole.id,
    },
  })

  await prisma.user.create({
    data: {
      username: 'supervisor',
      password: await bcrypt.hash('spv123', 10),
      name: 'Supervisor Produksi',
      email: 'supervisor@andon.local',
      roleId: supervisorRole.id,
    },
  })

  await prisma.user.create({
    data: {
      username: 'operator',
      password: await bcrypt.hash('opr123', 10),
      name: 'Operator Lantai Pabrik',
      email: 'operator@andon.local',
      roleId: operatorRole.id,
    },
  })

  // Shifts
  const shift1 = await prisma.shift.create({
    data: { code: 'SHIFT-1', name: 'Shift 1', startTime: '07:00', endTime: '15:00', description: 'Shift 1 (07:00 - 15:00)' },
  })
  const shift2 = await prisma.shift.create({
    data: { code: 'SHIFT-2', name: 'Shift 2', startTime: '15:00', endTime: '23:00', description: 'Shift 2 (15:00 - 23:00)' },
  })
  const shift3 = await prisma.shift.create({
    data: { code: 'SHIFT-3', name: 'Shift 3', startTime: '23:00', endTime: '07:00', description: 'Shift 3 (23:00 - 07:00)' },
  })

  // Machines
  const m1 = await prisma.machine.create({ data: { code: 'M-ASMB-01', name: 'Automatic Door Trim & Torquing Rig (Mesin Pemasangan Panel & Baut Pintu)', location: 'Assembly' } })
  const m2 = await prisma.machine.create({ data: { code: 'M-WELD-02', name: 'Robotic Spot Welding Cell (Sel Pengelasan Titik Robotik Rangka Bodi)', location: 'Welding' } })
  const m3 = await prisma.machine.create({ data: { code: 'M-CKPT-03', name: 'Instrument Panel & Cockpit Rig (Meja Pasang Dashboard Kokpit)', location: 'Interior' } })
  const m4 = await prisma.machine.create({ data: { code: 'M-WHEL-04', name: 'Tire & Wheel Torquing Rig (Mesin Robotik Pasang Roda Mobil)', location: 'Final' } })

  // Items
  const i1 = await prisma.item.create({ data: { code: 'ITEM-TYT-FR01', name: 'Front Right Door Assembly - Toyota Yaris/Raize (Rakitan Pintu Depan Kanan)' } })
  const i2 = await prisma.item.create({ data: { code: 'ITEM-MZD-IP02', name: 'Instrument Panel Module - Mazda CX-5 (Modul Dashboard Utama)' } })
  const i3 = await prisma.item.create({ data: { code: 'ITEM-AXLE-03', name: 'Front Axle & Brake Hub Unit (Unit As & Piringan Rem Depan)' } })
  const i4 = await prisma.item.create({ data: { code: 'ITEM-CNSL-04', name: 'Center Console Unit (Unit Konsol Tengah)' } })

  // Defects
  await prisma.defect.createMany({
    data: [
      { code: 'DEF-01', name: 'Torque NG (Kekencangan Baut di Luar Standar Nm)', itemId: i1.id },
      { code: 'DEF-02', name: 'Surface Scratch & Dent (Goresan / Penyok Part)', itemId: i2.id },
      { code: 'DEF-03', name: 'Loose Clip & Pin Fitting (Kancing Trim Longgar)', itemId: i3.id },
      { code: 'DEF-04', name: 'Gap & Flushness NG (Celah Panel Tidak Presisi)', itemId: i4.id },
    ],
  })

  // Abnormalities
  await prisma.abnormality.createMany({
    data: [
      { code: 'ABN-01', name: 'Nutrunner / Electric Torque Gun Error (Alat Baut Error)', machineId: m1.id },
      { code: 'ABN-02', name: 'Material Shortage / Delay Supplier (Part Kosong)', machineId: m2.id },
      { code: 'ABN-03', name: 'Poka-Yoke Sensor Interrupted (Sensor Eror/Kotor)', machineId: m3.id },
      { code: 'ABN-04', name: 'Jig Clamping Pneumatic Error (Pencekam Macet)', machineId: m4.id },
    ],
  })

  // Production Setups
  await prisma.productionSetup.createMany({
    data: [
      {
        code: 'SETUP-MASMB-001',
        shiftId: shift1.id,
        machineId: m1.id,
        itemId: i1.id,
        operatorId: admin.id,
        targetQuantity: 50,
        status: 'PLANNED',
      },
      {
        code: 'SETUP-MWELD-001',
        shiftId: shift1.id,
        machineId: m2.id,
        itemId: i3.id,
        operatorId: admin.id,
        targetQuantity: 60,
        status: 'PLANNED',
      },
      {
        code: 'SETUP-MCKPT-001',
        shiftId: shift1.id,
        machineId: m3.id,
        itemId: i2.id,
        operatorId: admin.id,
        targetQuantity: 30,
        status: 'PLANNED',
      },
    ],
  })

  // Work Orders
  await prisma.workOrder.createMany({
    data: [
      {
        code: 'WO-2026-TYT-001',
        type: 'HARIAN',
        approvalStatus: 'APPROVED',
        targetQuantity: 50,
        shiftId: shift1.id,
        machineId: m1.id,
        itemId: i1.id,
      },
      {
        code: 'WO-2026-MZD-002',
        type: 'HARIAN',
        approvalStatus: 'DRAFT',
        targetQuantity: 30,
        shiftId: shift1.id,
        machineId: m3.id,
        itemId: i2.id,
      },
    ],
  })

  console.log('Seed completed successfully')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
}).finally(() => prisma.$disconnect())
