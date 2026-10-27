const { Events } = require('discord.js');

// ─────────────────────────── Textos ───────────────────────────
// Edite à vontade: o bot sorteia um deles a cada menção.
const RESPONSES = [
  'Fala aí! 👋',
  'Tá me chamando por quê? 👀',
  'Presente!',
  'Eu ouvi meu nome? :3',
  'Calma, tô trabalhando aqui...',
  'Diga, meu caro.',
  'Pode falar, sou todo ouvidos!',
  'Chamou o gato? Chamou o gato!',
];

// Evita sortear o mesmo texto duas vezes seguidas
let lastIndex = -1;

function pickResponse() {
  if (RESPONSES.length === 1) return RESPONSES[0];

  let index;
  do {
    index = Math.floor(Math.random() * RESPONSES.length);
  } while (index === lastIndex);

  lastIndex = index;
  return RESPONSES[index];
}

module.exports = {
  name: Events.MessageCreate,
  once: false,

  async execute(message) {
    if (message.author.bot) return;

    // Verifica se a menção está REALMENTE escrita na mensagem (<@id> ou <@!id>).
    // Quando alguém responde a uma mensagem do bot com a "menção ligada" (@ ON),
    // o Discord adiciona o bot em message.mentions mesmo sem a menção no texto,
    // então checar o conteúdo é o que filtra esse caso.
    const botId = message.client.user.id;
    const mentionedDirectly = new RegExp(`<@!?${botId}>`).test(message.content);
    if (!mentionedDirectly) return;

    try {
      await message.reply({
        content: pickResponse(),
        allowedMentions: { repliedUser: false }, // responde sem pingar o autor (mude para true se quiser)
      });
    } catch (err) {
      console.error('[mentionReply] Não foi possível responder:', err);
    }
  },
};