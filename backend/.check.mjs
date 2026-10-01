import prisma from './src/config/prisma.js'
import { getKpiSnapshot, resolveKpiScope } from './src/services/kpi.service.js'

const { scope } = resolveKpiScope({ rangeDays: 1 })
const t = Date.now()
const kpi = await getKpiSnapshot(scope)
console.log(`snapshot ${Date.now() - t} ms`)
console.log('byHour:', JSON.stringify(kpi.byHour.slice(0, 3)), 'len', kpi.byHour.length)
console.log('machineStatus:', JSON.stringify(kpi.machineStatus, null, 1).slice(0, 900))
console.log('oee:', JSON.stringify(kpi.totals.oee))
await prisma.$disconnect()
