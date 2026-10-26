import type { Rng } from './rng.ts'
import { shuffle } from './rng.ts'

export interface Message {
  id: number
  channel: 'email' | 'sms'
  context: string
  from: string
  subject?: string
  body: string
  link?: { text: string, target: string }
  attachment?: string
  phishing: boolean
  /** Les indices : ce qui est suspect (piège) ou ce qui rassure (légitime). */
  clues: string[]
}

export const MESSAGES: Message[] = [
  {
    id: 1, channel: 'email', context: 'Tu n’attends aucun colis.',
    from: 'service-client@livraison-express.colis-verif.net', subject: 'Colis bloqué : agis dans 24 h',
    body: 'Bonjour cher client, ton colis est retenu à l’entrepôt. Règle 1,99 € de frais avant 24 h, sinon il sera détruit.',
    link: { text: 'Régler maintenant', target: 'http://colis-verif.net/payer' }, phishing: true,
    clues: ['Urgence et menace (« détruit »).', 'Le vrai nom de domaine est « colis-verif.net », pas « livraison-express ».', 'Salutation vague (« cher client ») et demande de paiement par un lien.']
  },
  {
    id: 2, channel: 'sms', context: 'Tu es client de la Banque Horizon.',
    from: 'BanqueHorizon', body: 'Activité suspecte sur ta carte. Confirme tes codes sur horizon-secure-login.top ou ta carte sera bloquée dans 1 h.',
    link: { text: 'horizon-secure-login.top', target: 'https://horizon-secure-login.top' }, phishing: true,
    clues: ['Une banque ne demande jamais tes codes par SMS.', 'Adresse en « .top » qui n’a rien d’officiel.', 'Compte à rebours pour t’empêcher de réfléchir.']
  },
  {
    id: 3, channel: 'email', context: 'Tu viens de recevoir ce message.',
    from: 'gagnant@gros-lot-anniv.com', subject: '🎁 Tu as gagné un cadeau d’anniversaire !',
    body: 'Félicitations, tu es notre millionième visiteur ! Pour recevoir ton smartphone gratuit, indique ton numéro de carte bancaire pour les frais de port.',
    phishing: true,
    clues: ['Trop beau pour être vrai : tu n’as participé à aucun concours.', 'On te demande ton numéro de carte pour un cadeau « gratuit ».']
  },
  {
    id: 4, channel: 'email', context: 'Tu as un abonnement Streamix.',
    from: 'support@compte-streamix.help', subject: 'Ton abonnement expire : mets à jour ton mot de passe',
    body: 'Pour continuer à regarder tes séries, confirme ton mot de passe dans les 12 heures.',
    link: { text: 'streamix.com/compte', target: 'https://streamix.com.verifier-compte.help/login' }, phishing: true,
    clues: ['Le texte du lien montre streamix.com, mais l’adresse réelle finit par « verifier-compte.help ».', 'L’expéditeur n’est pas « streamix.com ».', 'On te demande ton mot de passe sous la pression du temps.']
  },
  {
    id: 5, channel: 'email', context: 'Message reçu sur ta boîte mail.',
    from: 'assistance@mail-support-boite.org', subject: 'Ta boîte mail est pleine',
    body: 'Réponds à ce message avec ton identifiant et ton mot de passe pour que nous libérions de l’espace.', phishing: true,
    clues: ['Personne de sérieux ne demande ton mot de passe par message.', 'Expéditeur sans lien avec ton fournisseur habituel.']
  },
  {
    id: 6, channel: 'sms', context: 'Numéro inconnu, aucun contact enregistré.',
    from: '+00 000 00 00 00', body: 'Maman : j’ai cassé mon téléphone, voici mon nouveau numéro. Peux-tu me faire un virement de 50 € ? C’est urgent !',
    phishing: true,
    clues: ['Numéro que tu ne connais pas.', 'Demande d’argent urgente. Appelle ton parent sur son ancien numéro pour vérifier.']
  },
  {
    id: 7, channel: 'email', context: 'Tu n’as pas de facture en attente.',
    from: 'compta@fournisseur-factures.biz', subject: 'Facture impayée : ouvrir le fichier',
    body: 'Veuillez trouver la facture ci-jointe. Paiement exigé aujourd’hui.', attachment: 'facture_2026.pdf.exe', phishing: true,
    clues: ['Le fichier finit par « .exe » : c’est un programme, pas un PDF.', 'Facture que tu n’attends pas, avec un ton menaçant.']
  },
  {
    id: 8, channel: 'email', context: 'Tu viens de demander à te connecter à Streamix.',
    from: 'notifications@streamix.com', subject: 'Ton code de connexion',
    body: 'Ton code est 482913. Il est valable 10 minutes. Si tu n’as pas demandé ce code, ignore ce message.', phishing: false,
    clues: ['Tu l’attendais, tu venais de demander ce code.', 'Aucun lien à cliquer et aucune demande de mot de passe.']
  },
  {
    id: 9, channel: 'sms', context: 'Tu as un rendez-vous noté dans ton agenda.',
    from: 'Cabinet Lumière', body: 'Rappel : ton rendez-vous est demain à 15 h. Pour le modifier, appelle le cabinet au numéro habituel.', phishing: false,
    clues: ['Tu connais l’expéditeur et le rendez-vous.', 'Pas de lien : on te renvoie vers le numéro que tu as déjà.']
  },
  {
    id: 10, channel: 'email', context: 'Tu étais à la fête samedi.',
    from: 'papa@famille-martin.fr', subject: 'Photos de la fête',
    body: 'Voici les photos de samedi ! Je les ai mises dans l’album partagé qu’on utilise déjà.', phishing: false,
    clues: ['Expéditeur connu, contexte cohérent.', 'Aucune urgence, aucune demande d’information personnelle.']
  },
  {
    id: 11, channel: 'email', context: 'Tu es client de la Banque Horizon.',
    from: 'no-reply@banque-horizon.fr', subject: 'Ton relevé mensuel est disponible',
    body: 'Ton relevé est disponible dans ton espace client. Ouvre ton application ou tape toi-même l’adresse habituelle de la banque.', phishing: false,
    clues: ['Aucun lien cliquable, tu es invité à passer par ton appli.', 'Aucune demande de code ou de mot de passe.']
  },
  {
    id: 12, channel: 'sms', context: 'Tu as commandé un livre hier en point relais.',
    from: 'PointRelais', body: 'Ton colis est arrivé au point relais, rue du Moulin. Retrait avec ta pièce d’identité et le code de ta commande.', phishing: false,
    clues: ['Tu attends vraiment ce colis.', 'Pas de lien, pas de paiement demandé : tu récupères le colis sur place.']
  },
  {
    id: 13, channel: 'email', context: 'Tu es membre du club d’informatique.',
    from: 'equipe@club-informatique.org', subject: 'Réunion de jeudi',
    body: 'Rappel : la réunion du club est jeudi à 18 h, salle 3. Réponds simplement pour confirmer ta venue.', phishing: false,
    clues: ['Expéditeur connu, message banal et attendu.', 'On te demande seulement de répondre « oui » ou « non ».']
  },
  {
    id: 14, channel: 'email', context: 'Tu as un compte Streamix.',
    from: 'securite@streamix.com', subject: 'Nouvelle connexion détectée',
    body: 'Une connexion a eu lieu depuis un nouvel appareil. Si c’est toi, tu n’as rien à faire. Sinon, ouvre l’application Streamix toi-même et change ton mot de passe.', phishing: false,
    clues: ['Aucun lien : on te dit d’ouvrir l’appli toi-même.', 'Pas d’urgence ni de menace, et expéditeur cohérent.']
  }
]

/** `count` messages : moitié piégés, moitié légitimes, mélangés. */
export function drawMessages(count: number, rng: Rng): Message[] {
  const bad = shuffle(MESSAGES.filter(m => m.phishing), rng)
  const good = shuffle(MESSAGES.filter(m => !m.phishing), rng)
  const nBad = Math.ceil(count / 2)
  return shuffle([...bad.slice(0, nBad), ...good.slice(0, count - nBad)], rng)
}
