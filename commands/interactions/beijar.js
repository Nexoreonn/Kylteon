// Ajuste o caminho conforme a estrutura do seu projeto
const criarInteracao = require('../../events/affectionInteractions.js');
const CDN = 'https://cdn.jsdelivr.net/gh/Nexoreonn/GIFs@main/Beijar';

module.exports = criarInteracao({
  name: 'beijar',
  description: '[Interação] Dê um beijo em alguém!',
  optionDescription: 'Quem você quer beijar?',
  color: 0x460FBF, // cor padrão (cada escolha pode ter a sua)

  ownerMessage: [
    'YAYYY, meu dono me beijou! 😻',
    'Hihihi, me dá mais! 💜',
    'Hmpf- Você sabe que eu não aguento quando faz isso!'
  ],
  botMessage: [
    'Calma lá que você não vai querer me beijar, eu arranho... E meu dono vai ficar bravo! 👀',
    'Ei! Saí pra lá, {autor}! Eu não gosto de beijos... Não de estranhos!',
    'Ah é? Vou chamar meu dono pra te por na linha!'
  ],
  selfMessage: '{autor} mandou um beijo pro espelho... 💋',

  // Menu: /beijar usuario:@alguem tipo:(Bochecha | Lábios)
  menu: {
    name: 'tipo',
    description: 'Onde você quer beijar? (padrão: Bochecha)',
    default: 'bochecha', // usado quando a pessoa não escolhe nada

    // Para adicionar um tipo novo, é só incluir outro objeto aqui (até 25)
    choices: [
      {
        name: 'Bochecha',
        value: 'bochecha',
        messages: [
          '{autor} deu um beijinho na bochecha de {alvo}! 😘',
          '{alvo} ganhou um beijinho na bochecha de {autor}! 🥰',
          '{autor} beijou a bochecha de {alvo} com carinho! 😚',
        ],
        // Troque pelos seus links DIRETOS de gif
        gifs: [
          `${CDN}/anime-hug.gif`,
          `${CDN}/anime-kiss%(2).gif`,
          `${CDN}/anime-kiss-no-lick.gif`,
          `${CDN}/anime-kiss.gif`,
          `${CDN}/kiss-cheek.gif`,
          `${CDN}/love-cheek.gif`,
          `${CDN}/sugar-love.gif`,
          `${CDN}/yuri-kiss.gif`,
        ],
      },
      {
        name: 'Lábios',
        value: 'labios',
        color: 0x460FBF,
        messages: [
          '{autor} beijou {alvo} nos lábios! 💋',
          '{autor} deu um beijão em {alvo}! 😳💋',
          '{alvo} foi beijado(a) nos lábios por {autor}! 💞',
        ],
        gifs: [
          `${CDN}/lábios/anime-kiss-cute-kiss.gif`,
          `${CDN}/lábios/anime-kiss.gif`,
          `${CDN}/lábios/kiss-anime-anime-kiss.gif`,
          `${CDN}/lábios/kiss-gentle-kiss.gif`,
          `${CDN}/lábios/kiss.gif`,
        ],
      },
    ],
  },
});