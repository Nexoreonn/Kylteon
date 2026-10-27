// Serve para gerenciar as interações de comandos do bot, garantindo que cada comando seja executado corretamente e lidando com erros de execução.
const { Events, MessageFlags } = require('discord.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isChatInputCommand()) return;

		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			await interaction.reply({
				content: 'Este comando não está carregado no momento. Avise a equipe responsável pelo bot.',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		try {
			await command.execute(interaction);
		} catch (error) {
			console.error(error);
			try {
				if (interaction.replied || interaction.deferred) {
					await interaction.followUp({
						content: 'Ocorreu um erro ao executar este comando.',
						flags: MessageFlags.Ephemeral,
					});
				} else {
					await interaction.reply({
						content: 'Ocorreu um erro ao executar este comando.',
						flags: MessageFlags.Ephemeral,
					});
				}
			} catch (replyError) {
				console.error('Falha ao enviar a mensagem de erro da interação:', replyError);
			}
		}
	},
};