const criarInteracao = require('../../events/affectionInteractions.js');
const CDN = 'https://cdn.jsdelivr.net/gh/Nexoreonn/GIFs@main/Cutucar';

module.exports = criarInteracao({
  name: 'cutucar',
  description: '[Interação] Cutuque alguém!',
  optionDescription: 'Quem você quer cutucar?',
  color: 0x460FBF,

  // Use {autor} e {alvo}. Um desses textos é sorteado a cada uso.
  messages: [
    '{autor} cutucou {alvo}! 🤗',
    '{autor} deu um cutuco em {alvo}! 💞',
    '{alvo} recebeu um cutuco de {autor}! 🫂',
  ],

  // Troque pelos seus links DIRETOS de gif (terminam em .gif ou apontam direto para o arquivo)
  gifs: [
    `${CDN}/boop-anime.gif`,
    `${CDN}/boop-poke.gif`,
    `${CDN}/marin-kitagawa-kitagawa.gif`,
    `${CDN}/nekone-utawarerumono.gif`,
    `${CDN}/watanare-anime.gif`
  ],

  ownerMessage: 'Hmpf! Até você, meu dono, me cutucando?! 😾',
  botMessage: 'Ei! Porque você está me cutucando? 😾',
  selfMessage: '{autor} se... cutucou? Que estranho. 👀',
});