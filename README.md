# 🐾 Kylteon

Bot de entretenimento e utilidades para Discord, feito com [discord.js](https://discord.js.org) v14.

![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A5%2018.17-339933?logo=node.js&logoColor=white)
![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord&logoColor=white)
![License](https://img.shields.io/badge/license-GPLv3-blue)

## ✨ Comandos

### 🛠️ Utilidades
| Comando | Descrição |
| --- | --- |
| `/ping` | Mostra a latência do bot e da API do Discord. |
| `/dado [minimo] [maximo]` | Rola um dado com valores personalizáveis (padrão: 1 a 6). |

### 💞 Interações
| Comando | Descrição |
| --- | --- |
| `/abraçar usuario` | Dá um abraço em alguém, com mensagem e GIF aleatórios. |
| `/beijar usuario [tipo]` | Dá um beijo em alguém (`Bochecha` ou `Lábios`). |
| `/cutucar usuario` | Cutuca alguém. |

O bot também tem respostas especiais quando o alvo é ele mesmo ou o dono.

### 🎮 Jogos
| Comando | Descrição |
| --- | --- |
| `/reactiontime jogadores` | Minigame de reflexo: equipe Vermelha vs Azul (1 a 5 jogadores por equipe). |
| `/codebreaker todos [dificuldade]` | Descubra o código secreto: qualquer pessoa do canal pode jogar. |
| `/codebreaker solo [dificuldade]` | Mesma coisa, mas só você joga. |
| `/codebreaker equipe membros [dificuldade]` | Duelo entre duas equipes (1 a 4 membros cada). |

Além disso, o bot responde quando é mencionado diretamente numa mensagem.

## 📋 Requisitos

- [Node.js](https://nodejs.org) **18.17 ou superior**
- Uma aplicação de bot criada no [Discord Developer Portal](https://discord.com/developers/applications)
- **Message Content Intent** ativada em *Bot → Privileged Gateway Intents* (necessária para as menções e para os palpites do `/codebreaker`)

## 🚀 Instalação

```bash
git clone https://github.com/Nexoreonn/kylteon.git
cd kylteon
npm install
```

Crie um arquivo `.env` na raiz do projeto:

```env
# Obrigatórias
BOT_TOKEN=token_do_seu_bot
CLIENT_ID=id_da_aplicacao
GUILD_ID=id_do_servidor_de_testes   # só para deploy em um servidor específico

# Opcionais
OWNER_ID=seu_id_de_usuario          # habilita as respostas especiais para o dono
ACTIVITY_TYPE=PLAYING               # PLAYING | STREAMING | LISTENING | WATCHING | COMPETING
ACTIVITY_NAME=com vocês!
STATUS=ONLINE                       # ONLINE | IDLE | DND | INVISIBLE | OFFLINE
```

> ⚠️ **Nunca** publique o `.env` nem o token do bot. O `.gitignore` já ignora o `.env`.

## ▶️ Uso

Registre os slash commands e depois inicie o bot:

```bash
npm run deploy:commands          # registra no servidor definido em GUILD_ID
npm run deploy:commands:global   # registra globalmente (pode levar um tempo para aparecer)
npm start                        # inicia o bot
```

O script `deploy-commands.js` também aceita:

```bash
node deploy-commands.js --check            # compara comandos locais e registrados
node deploy-commands.js --clear            # remove os comandos do servidor
node deploy-commands.js --clear --global   # remove os comandos globais
```

## 🗂️ Estrutura

```
kylteon/
├── commands/
│   ├── games/          # reactionTime.js, codebreaker.js
│   ├── interactions/   # abracar.js, beijar.js, cutucar.js
│   └── utility/        # ping.js, dado.js
├── events/
│   ├── affectionInteractions.js   # fábrica de comandos de interação
│   ├── interationCreate.js        # executa os slash commands
│   ├── mentionReply.js            # resposta a menções
│   └── ready.js                   # status e atividade do bot
├── deploy-commands.js
└── index.js
```

Todo arquivo `.js` dentro de `commands/` (inclusive em subpastas) é carregado automaticamente, e todo arquivo em `events/` vira um listener.

## ➕ Criando um novo comando de interação

Copie um arquivo de `commands/interactions/` e ajuste. Exemplo:

```js
const criarInteracao = require('../../events/affectionInteractions.js');
const CDN = 'https://cdn.jsdelivr.net/gh/SEU_USUARIO/SEU_REPOSITORIO@main/Pasta';

module.exports = criarInteracao({
  name: 'carinho',
  description: '[Interação] Faça um carinho em alguém!',
  optionDescription: 'Quem você quer acariciar?',
  messages: ['{autor} fez carinho em {alvo}! 🥰'],
  gifs: [`${CDN}/exemplo.gif`],
});
```

Use `{autor}` e `{alvo}` nos textos. Depois rode `npm run deploy:commands` para registrar o comando. Também é possível adicionar um `menu` com variações (como o tipo de beijo) e mensagens para o dono, para o próprio bot e para o próprio autor.

## 📄 Documentos legais

- [Termos de Serviço](/public/termos.html)
- [Política de Privacidade](/public/privacidade.html)

## 📜 Licença

Este projeto é distribuído sob a **GNU General Public License v3.0**. Veja o arquivo [LICENSE](LICENSE) para o texto completo.

```
Kylteon — bot para Discord
Copyright (C) 2026 Nexoreonn

Este programa é software livre: você pode redistribuí-lo e/ou modificá-lo
sob os termos da Licença Pública Geral GNU, conforme publicada pela
Free Software Foundation, na versão 3 da Licença ou (a seu critério)
qualquer versão posterior.

Este programa é distribuído na esperança de que seja útil, mas SEM
NENHUMA GARANTIA; sem mesmo a garantia implícita de COMERCIALIZAÇÃO ou
ADEQUAÇÃO A UM PROPÓSITO ESPECÍFICO. Veja a Licença Pública Geral GNU
para mais detalhes.
```

> Os GIFs usados pelos comandos de interação pertencem aos seus respectivos autores e **não** são cobertos pela licença do código.

## 🤝 Contribuindo

Sugestões e pull requests são bem-vindos. Ao contribuir, você concorda que seu código será licenciado sob a GPLv3.