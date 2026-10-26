import { IssueReportCreateSchema } from '../../schemas'
import prisma from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const parsed = IssueReportCreateSchema.safeParse(await readBody(event))

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Signalement invalide',
      data: parsed.error.flatten()
    })
  }

  const report = await prisma.issueReport.create({
    data: {
      authorId: user.id,
      ...parsed.data
    }
  })

  return { status: 201, data: report }
})
