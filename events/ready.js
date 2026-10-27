// Serve para indicar que o bot está pronto e logado, exibindo uma mensagem no console com o nome do usuário do bot.
const { Events, PresenceUpdateStatus, ActivityType } = require('discord.js');


module.exports = {
	name: Events.ClientReady,
	once: true,
	execute(client) {
		console.log(`Ready! Logged in as ${client.user.tag}`);
        client.user.setActivity('com vocês', { type: ActivityType.Playing });
        client.user.setStatus(PresenceUpdateStatus.Online);
	},
};