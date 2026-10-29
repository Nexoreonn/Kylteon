const criarInteracao = require('../../events/affectionInteractions.js');
const CDN = 'https://cdn.jsdelivr.net/gh/Nexoreonn/GIFs@main/Abraçar';

module.exports = criarInteracao({
  name: 'abraçar',
  description: '[Interação] Dê um abraço em alguém!',
  optionDescription: 'Quem você quer abraçar?',
  color: 0x460FBF,

  // Use {autor} e {alvo}. Um desses textos é sorteado a cada uso.
  messages: [
    '{autor} deu um abraço apertado em {alvo}! 🤗',
    '{autor} abraçou {alvo} com muito carinho! 💞',
    '{alvo} recebeu um abraço de {autor}! 🫂',
  ],

  // Troque pelos seus links DIRETOS de gif (terminam em .gif ou apontam direto para o arquivo)
  gifs: [
    `${CDN}/anime-comfort-hug-anime-hug.gif`,
    `${CDN}/excited-hug.gif`,
    `${CDN}/fern-frieren.gif`,
    `${CDN}/hug%20(2).gif`,
    `${CDN}/hug%20(3).gif`,
    `${CDN}/hug-anime%20(2).gif`,
    `${CDN}/hug-anime.gif`,
    `${CDN}/hug-hugging.gif`,
    `${CDN}/hug-hugs.gif`,
    `${CDN}/hug.gif`,
    `${CDN}/hugtrip.gif`,
    `${CDN}/icon-goal-xd.gif`,
    `${CDN}/pjsk-airi.gif`,
  ],

  ownerMessage: [
    'Hmpf... Vou abrir uma exceção só porque você é meu dono! 💜',
    'Hihihi, vem cá de novo e me dá mais abraços!',
    'Pode me abraçar, mas não me aperta muito- Ei! Falei pra não me apertar!',
  ],
  botMessage: [
    'Acho que você não vai querer me abraçar, eu arranho... 👀',
    'Ei! Saí pra lá, {autor}! Eu não gosto de abraços... Não de estranhos!',
    'Faz isso que eu arranho seus braços, {autor}!'
  ],
  selfMessage: '{autor} tentou se abraçar... Chama alguém pra te dar um abraço de verdade! 🥲',
});