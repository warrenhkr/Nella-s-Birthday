import { IssueReportFilterSchema } from '../../schemas'
import prisma from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = IssueReportFilterSchema.safeParse(getQuery(event))
  const isSuperAdmin = user.role === 'SUPER_ADMIN'

  if (!query.success && isSuperAdmin) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Filtres invalides',
      data: query.error.flatten()
    })
  }

  const reports = await prisma.issueReport.findMany({
    where: isSuperAdmin
      ? (query.success ? query.data : {})
      : { authorId: user.id },
    orderBy: { createdAt: 'desc' },
    include: isSuperAdmin
      ? {
          author: {
            select: { id: true, pseudo: true, email: true }
          }
        }
      : undefined
  })

  return { status: 200, data: reports }
})
