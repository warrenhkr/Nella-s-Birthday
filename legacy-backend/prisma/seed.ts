import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../server/utils/password.ts'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required to seed the database')

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
})

async function ensureUsers() {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@otaku.club'
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'demo-password')
  if (!superAdminPassword) {
    throw new Error('SUPER_ADMIN_PASSWORD is required when seeding in production')
  }
  // Comptes de démonstration : jamais de mot de passe connu en production.
  // Le 11/09/2026, six comptes @otaku.club (dont DEUX administrateurs) étaient
  // actifs en production avec le mot de passe publié dans ce dépôt ; leurs mots
  // de passe ont été tournés (scripts/secure-demo-accounts.mjs). Cette garde
  // empêche que le problème revienne à la prochaine exécution du seed.
  const demoPassword = process.env.SEED_DEMO_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'demo-password')
  const existingRoot = await prisma.user.findUnique({ where: { pseudo: 'OtakuRoot' } })
  if (existingRoot && existingRoot.email !== superAdminEmail) {
    await prisma.user.update({ where: { id: existingRoot.id }, data: { email: superAdminEmail } })
  }

  await prisma.user.updateMany({ where: { role: 'SUPER_ADMIN' }, data: { role: 'MEMBER' } })

  const demoUsers = [
    { email: superAdminEmail, pseudo: 'OtakuRoot', pole: 'Culture', role: 'SUPER_ADMIN', password: superAdminPassword },
    { email: 'aiko@otaku.club', pseudo: 'Aiko', pole: 'Anime', role: 'MEMBER' },
    { email: 'yuno@otaku.club', pseudo: 'Yuno', pole: 'Gaming', role: 'MEMBER' },
    { email: 'mika@otaku.club', pseudo: 'Mika', pole: 'Culture', role: 'SHOP_MANAGER' },
    { email: 'ryu@otaku.club', pseudo: 'Ryu', pole: 'Danse', role: 'MEMBER' }
  ] as const

  const createdUsers = [] as Array<{ id: string; pseudo: string; email: string }>

  for (const user of demoUsers) {
    const explicitPassword = 'password' in user && typeof user.password === 'string' ? user.password : ''
    const password = explicitPassword || demoPassword
    if (!password) {
      throw new Error(
        `SEED_DEMO_PASSWORD est requis pour (re)créer les comptes de démonstration en production `
        + `(compte concerné : ${user.email}). Les mots de passe connus du dépôt ne doivent jamais être réutilisés en production.`
      )
    }

    const record = await prisma.user.upsert({
      where: { email: user.email },
      update: { password: await hashPassword(password), role: user.role },
      create: {
        email: user.email,
        pseudo: user.pseudo,
        password: await hashPassword(password),
        role: user.role,
        pole: user.pole
      },
      select: { id: true, pseudo: true, email: true }
    })

    createdUsers.push(record)
  }

  return createdUsers
}

async function ensureEvents() {
  const demoEvents = [
    {
      title: 'Cosplay Night',
      description: 'Soirée costume, défilé et ateliers de création.',
      date: new Date('2026-10-12T18:00:00.000Z'),
      place: 'Campus ENEAM',
      pole: 'Culture',
      status: 'Ouvert'
    },
    {
      title: 'Anime Battle Arena',
      description: 'Tournoi rapide de jeux et matchs en équipe.',
      date: new Date('2026-10-19T17:30:00.000Z'),
      place: 'Hall S',
      pole: 'Gaming',
      status: 'À venir'
    },
    {
      title: 'K-Drama Social',
      description: 'Projection, débats et recommandations de dramas.',
      date: new Date('2026-11-02T19:00:00.000Z'),
      place: 'Taverne du Club',
      pole: 'K-Drama',
      status: 'Ouvert'
    }
  ] as const

  const createdEvents = [] as Array<{ id: string; title: string }>

  for (const event of demoEvents) {
    const record = await prisma.event.upsert({
      where: {
        id: (await prisma.event.findFirst({ where: { title: event.title }, select: { id: true } }))?.id ?? 'seed-not-found'
      },
      update: {},
      create: event,
      select: { id: true, title: true }
    })

    createdEvents.push(record)
  }

  return createdEvents
}

async function ensureProducts() {
  const demoProducts = [
    {
      name: 'T-shirt Club Deluxe',
      price: 12000,
      category: 'Mode',
      tag: 'Edition limitée',
      description: 'T-shirt officiel du club Otaku.'
    },
    {
      name: 'Badge Otaku',
      price: 4500,
      category: 'Accessoires',
      tag: 'Collector',
      description: 'Badge collector de la communauté.'
    },
    {
      name: 'Sticker Pack',
      price: 2000,
      category: 'Décoration',
      tag: 'Bonus',
      description: 'Pack de stickers pour téléphone et ordinateur.'
    }
  ] as const

  const createdProducts = [] as Array<{ id: string; name: string }>

  for (const product of demoProducts) {
    const record = await prisma.product.upsert({
      where: {
        id: (await prisma.product.findFirst({ where: { name: product.name }, select: { id: true } }))?.id ?? 'seed-not-found'
      },
      update: {},
      create: product,
      select: { id: true, name: true }
    })

    createdProducts.push(record)
  }

  return createdProducts
}

async function ensurePosts(users: Array<{ id: string; pseudo: string }>) {
  const posts = [
    {
      content: 'Préparation de la prochaine session cosplay, qui est votre thème préféré ?',
      pole: 'Culture',
      authorId: users[0]?.id
    },
    {
      content: 'Qui veut participer au tournoi de la semaine ?',
      pole: 'Gaming',
      authorId: users[1]?.id
    }
  ]

  const createdPosts = [] as Array<{ id: string; content: string }>

  for (const post of posts) {
    if (!post.authorId) continue

    const record = await prisma.post.upsert({
      where: { id: (await prisma.post.findFirst({ where: { content: post.content }, select: { id: true } }))?.id ?? 'seed-not-found' },
      update: {},
      create: post,
      select: { id: true, content: true }
    })

    createdPosts.push(record)
  }

  return createdPosts
}

async function ensureLikes(posts: Array<{ id: string }>, users: Array<{ id: string }>) {
  if (!posts[0] || !users[0]) return

  await prisma.like.upsert({
    where: {
      userId_postId: {
        userId: users[0].id,
        postId: posts[0].id
      }
    },
    update: {},
    create: {
      userId: users[0].id,
      postId: posts[0].id
    }
  })
}

async function main() {
  console.log('Seeding database...')

  const users = await ensureUsers()
  const events = await ensureEvents()
  const products = await ensureProducts()
  const posts = await ensurePosts(users)
  await ensureLikes(posts, users)

  console.log('Seeding completed!')
  console.log('Users:', users.length)
  console.log('Events:', events.length)
  console.log('Products:', products.length)
  console.log('Posts:', posts.length)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
