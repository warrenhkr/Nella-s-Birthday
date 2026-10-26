import type { Rng } from './rng.ts'
import { shuffle } from './rng.ts'

export interface Fact {
  text: string
  answer: boolean
  why: string
  tag: 'nature' | 'science' | 'geek' | 'cyber'
}

export const FACTS: Fact[] = [
  { text: 'Une pieuvre a trois cœurs.', answer: true, tag: 'nature', why: 'Deux cœurs envoient le sang vers les branchies, le troisième vers le reste du corps.' },
  { text: 'Sur Vénus, un jour dure plus longtemps qu’une année.', answer: true, tag: 'science', why: 'Vénus tourne très lentement sur elle-même (environ 243 jours terrestres) et fait le tour du Soleil en environ 225 jours.' },
  { text: 'Pour les botanistes, la banane est une baie, mais pas la fraise.', answer: true, tag: 'nature', why: 'Une vraie baie vient d’une seule fleur et garde ses graines à l’intérieur : c’est le cas de la banane, pas de la fraise.' },
  { text: 'La tour Eiffel est un peu plus haute en été qu’en hiver.', answer: true, tag: 'science', why: 'Le métal se dilate avec la chaleur : la tour peut gagner une quinzaine de centimètres.' },
  { text: 'Les wombats font des crottes en forme de cubes.', answer: true, tag: 'nature', why: 'La forme de leur intestin donne des cubes, qui ne roulent pas et marquent leur territoire.' },
  { text: 'Un éclair peut être plus chaud que la surface du Soleil.', answer: true, tag: 'science', why: 'L’air traversé par un éclair peut atteindre environ 30 000 °C, contre environ 5 500 °C pour la surface du Soleil.' },
  { text: 'Les chats ne perçoivent pas le goût sucré.', answer: true, tag: 'nature', why: 'Il leur manque un récepteur du sucré : ils ne goûtent pas cette saveur.' },
  { text: 'Le cœur d’une crevette se trouve dans sa tête.', answer: true, tag: 'nature', why: 'Il est logé dans la partie avant du corps, le céphalothorax.' },
  { text: 'Les girafes ont sept vertèbres dans le cou, comme les humains.', answer: true, tag: 'nature', why: 'Elles sont simplement beaucoup plus longues.' },
  { text: 'Le plus grand désert du monde est l’Antarctique.', answer: true, tag: 'science', why: 'Un désert se définit par le manque de précipitations, pas par la chaleur : l’Antarctique est le plus vaste.' },
  { text: 'Les abeilles indiquent où trouver des fleurs en dansant.', answer: true, tag: 'nature', why: 'La « danse frétillante » donne la direction et la distance de la nourriture.' },
  { text: 'Les flamants roses naissent gris ou blancs.', answer: true, tag: 'nature', why: 'Leur couleur rose vient des pigments de leur nourriture, qu’ils mangent peu à peu.' },
  { text: 'La Lune s’éloigne de la Terre d’environ 4 centimètres par an.', answer: true, tag: 'science', why: 'Les mesures laser le confirment : environ 3,8 cm chaque année.' },
  { text: 'Un octet contient 8 bits.', answer: true, tag: 'geek', why: '1 octet = 8 bits, soit 256 valeurs possibles (de 0 à 255).' },
  { text: 'Le « s » de https veut dire « sécurisé ».', answer: true, tag: 'cyber', why: 'Il indique que la connexion est chiffrée, donc difficile à espionner en route.' },
  { text: 'Le tout premier message du réseau ARPANET, en 1969, s’est arrêté après les lettres « LO ».', answer: true, tag: 'geek', why: 'Le système a planté pendant que « LOGIN » était envoyé : c’est devenu une anecdote célèbre.' },
  { text: 'Un papillon de nuit coincé dans un ordinateur de Harvard, en 1947, est à l’origine d’une célèbre histoire de « bug ».', answer: true, tag: 'geek', why: 'L’insecte a été collé dans le journal de bord avec la mention du « premier cas réel de bug ». Le mot existait déjà avant.' },
  { text: 'Le cadenas du navigateur ne prouve pas que le site soit honnête.', answer: true, tag: 'cyber', why: 'Il dit seulement que la connexion est chiffrée. Un site pirate peut aussi avoir un cadenas.' },
  { text: 'Une phrase de plusieurs mots est souvent plus solide qu’un mot court avec un symbole.', answer: true, tag: 'cyber', why: 'La longueur compte énormément : il y a beaucoup plus de combinaisons à essayer.' },
  { text: 'La double authentification protège ton compte même si ton mot de passe a été volé.', answer: true, tag: 'cyber', why: 'Le pirate a aussi besoin du deuxième élément (code, appli, clé), qu’il n’a pas.' },

  { text: 'Les autruches enfouissent leur tête dans le sable quand elles ont peur.', answer: false, tag: 'nature', why: 'Elles s’enfuient ou se couchent au sol. L’idée vient de leur façon de retourner leurs œufs dans le nid.' },
  { text: 'Nous n’utilisons que 10 % de notre cerveau.', answer: false, tag: 'science', why: 'On se sert de tout le cerveau, à des moments différents, même pendant le sommeil.' },
  { text: 'La Grande Muraille de Chine se voit à l’œil nu depuis la Lune.', answer: false, tag: 'science', why: 'Elle est bien trop fine et trop loin : même depuis l’orbite basse, elle est très difficile à repérer.' },
  { text: 'Les chauves-souris sont aveugles.', answer: false, tag: 'nature', why: 'Elles voient, et elles utilisent aussi l’écholocation pour se repérer dans le noir.' },
  { text: 'Les poissons rouges ont une mémoire de trois secondes.', answer: false, tag: 'nature', why: 'Ils retiennent des choses pendant des mois, comme les heures de repas.' },
  { text: 'Les taureaux foncent parce qu’ils voient du rouge.', answer: false, tag: 'nature', why: 'Ils réagissent au mouvement de la cape, pas à sa couleur.' },
  { text: 'La foudre ne frappe jamais deux fois au même endroit.', answer: false, tag: 'science', why: 'Les grands bâtiments en hauteur sont frappés plusieurs fois par an.' },
  { text: 'Le verre des vieilles fenêtres a coulé : c’est pour ça qu’il est plus épais en bas.', answer: false, tag: 'science', why: 'Le verre ne coule pas à l’échelle humaine. Les vitres anciennes étaient simplement fabriquées de façon inégale.' },
  { text: 'Il fait chaud en été parce que la Terre est plus proche du Soleil.', answer: false, tag: 'science', why: 'C’est l’inclinaison de l’axe de la Terre qui change les saisons. La Terre est même plus proche du Soleil début janvier.' },
  { text: 'Wi-Fi veut dire « Wireless Fidelity ».', answer: false, tag: 'geek', why: 'Le nom a été inventé par une agence de marketing et ne signifie rien du tout.' },
  { text: 'Le langage Python doit son nom au serpent.', answer: false, tag: 'geek', why: 'Son créateur l’a nommé d’après les Monty Python, une troupe d’humoristes britanniques.' },
  { text: 'La navigation privée te rend invisible pour ton fournisseur d’accès Internet.', answer: false, tag: 'cyber', why: 'Elle n’efface que l’historique sur ton appareil. Le fournisseur d’accès et les sites voient toujours ta connexion.' },
  { text: 'Un antivirus suffit pour être protégé à 100 %.', answer: false, tag: 'cyber', why: 'C’est une aide, pas un bouclier magique. Les mises à jour et la prudence restent indispensables.' },
  { text: 'Les ordinateurs Apple ne peuvent pas attraper de virus.', answer: false, tag: 'cyber', why: 'Il existe des logiciels malveillants pour tous les systèmes, y compris macOS.' },
  { text: 'Un message qui vient d’une adresse que tu connais est forcément écrit par cette personne.', answer: false, tag: 'cyber', why: 'L’adresse peut être imitée ou le compte piraté. En cas de doute, demande par un autre moyen.' },
  { text: 'Un mot de passe de 6 caractères avec des symboles est plus sûr qu’une phrase de 25 caractères.', answer: false, tag: 'cyber', why: 'La longueur l’emporte : 25 caractères offrent bien plus de combinaisons que 6, même avec des symboles.' },
  { text: 'Les caméléons changent de couleur uniquement pour se camoufler.', answer: false, tag: 'nature', why: 'Ils changent aussi de couleur pour communiquer leur humeur et pour réguler leur température.' },
  { text: 'Un fichier nommé « photo.jpg.exe » est forcément une image.', answer: false, tag: 'cyber', why: 'L’extension finale compte : « .exe » est un programme. Les doubles extensions servent à tromper.' }
]

/** Questions d'une partie : `count` faits, moitié vrais moitié faux, mélangés. */
export function drawFacts(count: number, rng: Rng): Fact[] {
  const trues = shuffle(FACTS.filter(f => f.answer), rng)
  const falses = shuffle(FACTS.filter(f => !f.answer), rng)
  const half = Math.floor(count / 2)
  return shuffle([...trues.slice(0, half), ...falses.slice(0, count - half)], rng)
}
