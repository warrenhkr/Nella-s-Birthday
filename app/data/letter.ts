export type LetterCompliment = {
	id: string
	character: string
	adjective: string
	message: string
}

export type ComplimentWord = {
	name: string
	letters: LetterCompliment[]
}

export const nameWords: ComplimentWord[] = [
	{
		name: 'Osnella',
		letters: [
			{ id: 'o', character: 'O', adjective: 'Optimiste', message: 'Tu sais voir le meilleur dans les petits moments et partager cette belle énergie autour de toi.' },
			{ id: 's', character: 'S', adjective: 'Solaire', message: 'Ton sourire et ta bonne humeur apportent de la lumière aux journées de ceux qui t’entourent.' },
			{ id: 'n', character: 'N', adjective: 'Naturelle', message: 'Ta façon d’être simplement toi rend chaque moment passé avec toi précieux.' },
			{ id: 'e', character: 'E', adjective: 'Épanouissante', message: 'Te voir avancer et t’épanouir est une vraie joie pour les personnes qui t’aiment.' },
			{ id: 'l', character: 'L', adjective: 'Lumineuse', message: 'Ta présence illumine les journées et rend les souvenirs encore plus doux.' },
			{ id: 'l2', character: 'L', adjective: 'Loyale', message: 'On peut compter sur toi, et cette fidélité est une belle preuve de ton grand cœur.' },
			{ id: 'a', character: 'A', adjective: 'Admirable', message: 'Ta force et ta gentillesse sont de belles raisons de t’admirer chaque jour.' }
		]
	},
	{
		name: 'Sènami',
		letters: [
			{ id: 's', character: 'S', adjective: 'Souriante', message: 'Ton sourire rend les moments partagés plus joyeux et plus lumineux.' },
			{ id: 'e-grave', character: 'È', adjective: 'Épanouie', message: 'Ta joie de vivre et ta belle énergie donnent envie de célébrer tout ce que tu es.' },
			{ id: 'n', character: 'N', adjective: 'Naturelle', message: 'Ta sincérité et ta simplicité font de toi une personne profondément attachante.' },
			{ id: 'a', character: 'A', adjective: 'Attachante', message: 'Ta présence compte beaucoup et laisse de doux souvenirs dans le cœur de ceux qui t’aiment.' },
			{ id: 'm', character: 'M', adjective: 'Merveilleuse', message: 'Tu as une belle façon de rendre les journées ordinaires un peu plus spéciales.' },
			{ id: 'i', character: 'I', adjective: 'Inoubliable', message: 'Les beaux moments passés avec toi restent longtemps dans les mémoires.' }
		]
	}
]
