import { IssueReportUpdateSchema } from '../../schemas'
import prisma from '../../utils/prisma'
import { requireSuperAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const id = getRouterParam(event, 'id')
  const parsed = IssueReportUpdateSchema.safeParse(await readBody(event))

  if (!id || !parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Mise à jour du signalement invalide',
      data: parsed.success ? undefined : parsed.error.flatten()
    })
  }

  const existing = await prisma.issueReport.findUnique({ where: { id } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Signalement introuvable' })
  }

  const responseProvided = Object.prototype.hasOwnProperty.call(parsed.data, 'adminResponse')
  const nextStatus = parsed.data.status ?? existing.status
  const response = parsed.data.adminResponse

  const report = await prisma.issueReport.update({
    where: { id },
    data: {
      ...parsed.data,
      respondedAt: responseProvided
        ? (response ? new Date() : null)
        : existing.respondedAt,
      resolvedAt: ['RESOLVED', 'CLOSED'].includes(nextStatus)
        ? (existing.resolvedAt ?? new Date())
        : null
    },
    include: {
      author: {
        select: { id: true, pseudo: true, email: true }
      }
    }
  })

  return { status: 200, data: report }
})
