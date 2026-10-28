const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const DEFAULT_MIN = 1;
const DEFAULT_MAX = 6;
const LIMIT = 1_000_000_000; // limite de segurança para os valores

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dado')
    .setDescription('[Utilidade] Rola um dado com valores personalizáveis')
    .addIntegerOption((opt) =>
      opt
        .setName('minimo')
        .setDescription(`Valor mínimo do dado (padrão: ${DEFAULT_MIN})`)
        .setMinValue(-LIMIT)
        .setMaxValue(LIMIT)
        .setRequired(false),
    )
    .addIntegerOption((opt) =>
      opt
        .setName('maximo')
        .setDescription(`Valor máximo do dado (padrão: ${DEFAULT_MAX})`)
        .setMinValue(-LIMIT)
        .setMaxValue(LIMIT)
        .setRequired(false),
    ),

  async execute(interaction) {
    let min = interaction.options.getInteger('minimo') ?? DEFAULT_MIN;
    let max = interaction.options.getInteger('maximo') ?? DEFAULT_MAX;

    // Se estiver invertido, conserta automaticamente e avisa o usuário
    let swapped = false;
    if (min > max) {
      [min, max] = [max, min];
      swapped = true;
    }

    // Número inteiro aleatório entre min e max (ambos inclusos)
    const result = Math.floor(Math.random() * (max - min + 1)) + min;

    const embed = new EmbedBuilder()
      .setColor(0x460FBF)
      .setTitle('🎲 Dado rolado!')
      .setDescription(`${interaction.user} rolou um dado de **${min}** a **${max}** e tirou:\n# ${result}`);

    if (swapped) {
      embed.setFooter({ text: '⚠️ Sua configuração estava invertida, mas eu consertei para você!' });
    }

    await interaction.reply({ embeds: [embed] });
  },
};