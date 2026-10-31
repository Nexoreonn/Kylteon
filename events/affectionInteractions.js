const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const has = (list) => Array.isArray(list) && list.length > 0;

// Troca {autor} e {alvo} nos textos pelas menções
const fill = (template, autor, alvo) => template.replaceAll('{autor}', autor).replaceAll('{alvo}', alvo);

/**
 * Cria um comando de interação entre usuários (abraçar, beijar, cutucar...).
 *
 * @param {object}   config
 * @param {string}   config.name                Nome do slash command (minúsculas, sem espaços)
 * @param {string}   config.description         Descrição do comando
 * @param {string[]} [config.messages]          Textos sorteados. Use {autor} e {alvo}
 * @param {string[]} [config.gifs]              Links DIRETOS de gif sorteados
 * @param {string}   [config.optionDescription] Descrição da opção de usuário
 * @param {number}   [config.color]             Cor do embed (hex)
 * @param {string}   [config.botMessage]        Texto quando o alvo é o próprio bot
 * @param {string}   [config.selfMessage]       Texto quando o alvo é o próprio autor
 * @param {string|string[]} [config.ownerMessage] Texto quando o DONO do bot usa o comando nele (aceita uma lista para sortear)
 * @param {string}   [config.ownerId]           ID do dono (se omitido, usa process.env.OWNER_ID)
 * @param {object}   [config.menu]              Menu opcional de escolhas (ex: tipo de beijo)
 * @param {string}   config.menu.name             Nome da opção (minúsculas, sem espaços). Ex: 'tipo'
 * @param {string}   config.menu.description      Descrição da opção
 * @param {string}   [config.menu.default]        "value" da escolha padrão (se omitido, usa a primeira)
 * @param {object[]} config.menu.choices          De 2 a 25 escolhas:
 *        { name, value, messages?, gifs?, color? }
 *        Se uma escolha não tiver messages/gifs/color próprios, usa os padrão do comando.
 *
 * Sem "menu", "messages" e "gifs" são obrigatórios.
 * Com "menu", cada escolha precisa ter os seus ou o comando precisa ter os padrão.
 */
function criarInteracao(config) {
  const {
    name,
    description,
    messages,
    gifs,
    menu,
    optionDescription = 'Quem?',
    color = 0x460FBF,
    botMessage = 'Eu? Melhor não... 👀',
    selfMessage = '{autor}, você não pode fazer isso consigo mesmo! 😅',
    ownerMessage,
    ownerId,
  } = config;

  // ID do dono: o do comando, ou o da variável de ambiente OWNER_ID
  const resolvedOwnerId = ownerId ?? process.env.OWNER_ID ?? null;

  // ───── Validação (erros aparecem ao iniciar o bot, não no meio de um comando) ─────
  if (!name || !description) {
    throw new Error('[criarInteracao] "name" e "description" são obrigatórios.');
  }

  if (menu) {
    if (!menu.name || !menu.description) {
      throw new Error(`[criarInteracao] O menu de "${name}" precisa de "name" e "description".`);
    }
    if (!Array.isArray(menu.choices) || menu.choices.length < 2 || menu.choices.length > 25) {
      throw new Error(`[criarInteracao] O menu de "${name}" precisa de 2 a 25 escolhas.`);
    }
    for (const c of menu.choices) {
      if (!c.name || !c.value) {
        throw new Error(`[criarInteracao] Toda escolha do menu de "${name}" precisa de "name" e "value".`);
      }
      if (!has(c.messages) && !has(messages)) {
        throw new Error(`[criarInteracao] A escolha "${c.value}" de "${name}" não tem "messages".`);
      }
      if (!has(c.gifs) && !has(gifs)) {
        throw new Error(`[criarInteracao] A escolha "${c.value}" de "${name}" não tem "gifs".`);
      }
    }
    if (menu.default && !menu.choices.some((c) => c.value === menu.default)) {
      throw new Error(`[criarInteracao] O "default" do menu de "${name}" não existe nas escolhas.`);
    }
  } else if (!has(messages) || !has(gifs)) {
    throw new Error(`[criarInteracao] "${name}" precisa de pelo menos 1 mensagem e 1 gif.`);
  }

  const defaultValue = menu ? (menu.default ?? menu.choices[0].value) : null;

  // ───── Definição do slash command ─────
  const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addUserOption((opt) => opt.setName('usuario').setDescription(optionDescription).setRequired(true));

  // Menu opcional (vem depois da opção obrigatória, como o Discord exige)
  if (menu) {
    data.addStringOption((opt) =>
      opt
        .setName(menu.name)
        .setDescription(menu.description)
        .setRequired(false)
        .addChoices(...menu.choices.map((c) => ({ name: c.name, value: c.value }))),
    );
  }

  return {
    data,

    async execute(interaction) {
      const target = interaction.options.getUser('usuario', true);
      const autor = `${interaction.user}`;
      const alvo = `${target}`;

      // Alvo é o próprio bot: só manda a mensagem, sem gif
      if (target.id === interaction.client.user.id) {
        // Se quem usou é o dono e existe uma resposta especial, usa ela
        const isOwner = resolvedOwnerId !== null && interaction.user.id === resolvedOwnerId;
        if (isOwner && ownerMessage) {
          const text = Array.isArray(ownerMessage) ? pick(ownerMessage) : ownerMessage;
          return interaction.reply({
            content: fill(text, autor, alvo),
            allowedMentions: { parse: [] },
          });
        }
        const botText = Array.isArray(botMessage) ? pick(botMessage) : botMessage;
return interaction.reply({
  content: fill(botText, autor, alvo),
  allowedMentions: { parse: [] },
});
      }

      // Alvo é o próprio autor
      if (target.id === interaction.user.id) {
        return interaction.reply({
          content: fill(selfMessage, autor, alvo),
          allowedMentions: { parse: [] },
        });
      }

      // Escolha do menu (ou a padrão, se a pessoa não escolheu nada)
      const picked = menu ? (interaction.options.getString(menu.name) ?? defaultValue) : null;
      const choice = menu ? menu.choices.find((c) => c.value === picked) : null;

      const pool = {
        messages: has(choice?.messages) ? choice.messages : messages,
        gifs: has(choice?.gifs) ? choice.gifs : gifs,
        color: choice?.color ?? color,
      };

      const embed = new EmbedBuilder()
        .setColor(pool.color)
        .setDescription(fill(pick(pool.messages), autor, alvo))
        .setImage(pick(pool.gifs));

      await interaction.reply({
        content: alvo, // marca o alvo para ele receber a notificação
        embeds: [embed],
        allowedMentions: { users: [target.id] },
      });
    },
  };
}

module.exports = criarInteracao;