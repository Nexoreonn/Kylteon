// Serve para indicar que o bot está pronto e logado, exibindo uma mensagem no console com o nome do usuário do bot.
const { Events, PresenceUpdateStatus, ActivityType } = require('discord.js');

const activityMap = {
	'PLAYING': ActivityType.Playing,
	'STREAMING': ActivityType.Streaming,
	'LISTENING': ActivityType.Listening,
	'WATCHING': ActivityType.Watching,
	'COMPETING': ActivityType.Competing
};

const statusMap = {
	'ONLINE': PresenceUpdateStatus.Online,
	'IDLE': PresenceUpdateStatus.Idle,
	'DND': PresenceUpdateStatus.DoNotDisturb,
	'INVISIBLE': PresenceUpdateStatus.Invisible,
	'OFFLINE': PresenceUpdateStatus.Offline
};

module.exports = {
	name: Events.ClientReady,
	once: true,
	execute(client) {
		console.log(`Ready! Logged in as ${client.user.tag}`);

		// Configurações de atividade e status do bot, com base nas variáveis de ambiente.
        const envType = (process.env.ACTIVITY_TYPE || 'PLAYING').toUpperCase();
		const activityName = process.env.ACTIVITY_NAME || 'com vocês!';
		const envStatus = (process.env.STATUS || 'ONLINE').toUpperCase();

		// Define a atividade e o status do bot com base nas variáveis de ambiente, usando os mapas para converter os valores.
		client.user.setActivity(activityName, {
			type: activityMap[envType] || ActivityType.Playing
		});

		// Define o status do bot com base na variável de ambiente, usando o mapa para converter o valor.
		client.user.setStatus(statusMap[envStatus] || PresenceUpdateStatus.Online);
	},
};