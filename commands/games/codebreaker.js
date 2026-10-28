/**
 * /codebreaker — Descubra o código secreto criado pelo bot.
 *
 * Requisitos:
 *  - discord.js >= 14.14
 *  - Intents: Guilds, GuildMessages e MessageContent (privilegiada, ative no Developer Portal)
 *
 * Subcomandos:
 *  - /codebreaker solo [dificuldade]                 -> o host joga sozinho
 *  - /codebreaker equipe <membros> [dificuldade]     -> duelo entre 2 equipes (1 a 4 membros por equipe)
 */

const { randomInt } = require('node:crypto');
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require('discord.js');

// ───────────────────────────── Configurações ─────────────────────────────
const DIGITOS_PADRAO = 4;
const DIGITOS_MIN = 2;
const DIGITOS_MAX = 10;
const MEMBROS_MAX = 4;
const MAX_HISTORICO = 8; // tentativas exibidas no Embed
const TEMPO_LOBBY = 5 * 60 * 1000; // 5 min para montar as equipes
const TEMPO_INATIVIDADE = 10 * 60 * 1000; // 10 min sem palpites válidos encerra a partida

const COR_INICIO = 0x460fbf; // antes do primeiro palpite (e no lobby)
const COR_ACERTO = 0x2ecc71; // último palpite acertou dígito e/ou posição
const COR_ERRO = 0xe74c3c; // último palpite não acertou nada
const COR_NEUTRA = 0x95a5a6;
const COR_VITORIA = 0x2ecc71;

const EQUIPES = {
  azul: { nome: 'Equipe Azul', emoji: '🔵', cor: 0x3498db },
  vermelha: { nome: 'Equipe Vermelha', emoji: '🔴', cor: 0xe74c3c },
};

/** Partidas em andamento (uma por canal). */
const partidasAtivas = new Map();

// ───────────────────────────── Utilidades ─────────────────────────────
const efemero = (content) => ({ content, flags: MessageFlags.Ephemeral });
const plural = (n, singular, plur) => `${n} ${n === 1 ? singular : plur}`;

function gerarCodigo(tamanho) {
  return Array.from({ length: tamanho }, () => randomInt(10)).join('');
}

/**
 * Compara o palpite com o código.
 * digitos  = quantos dígitos do palpite existem no código (contando repetições corretamente)
 * posicoes = quantos estão exatamente na posição certa
 * Ex.: código 85934 / palpite 00900 -> 1 dígito certo | 1 posição correta
 */
function avaliar(codigo, palpite) {
  const contCodigo = Array(10).fill(0);
  const contPalpite = Array(10).fill(0);
  let posicoes = 0;

  for (let i = 0; i < codigo.length; i++) {
    if (codigo[i] === palpite[i]) posicoes++;
    contCodigo[Number(codigo[i])]++;
    contPalpite[Number(palpite[i])]++;
  }

  let digitos = 0;
  for (let d = 0; d < 10; d++) digitos += Math.min(contCodigo[d], contPalpite[d]);

  return { digitos, posicoes };
}

// Em português, 0 e 1 ficam no singular (0 Posição Correta, 1 Dígito certo)
const pluralPt = (n, singular, plur) => `${n} ${n > 1 ? plur : singular}`;

const textoResultado = ({ digitos, posicoes }) =>
  `${pluralPt(digitos, 'Dígito certo', 'Dígitos certos')} | ${pluralPt(posicoes, 'Posição Correta', 'Posições Corretas')}`;

function formatarTempo(ms) {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}min ${s}s`;
}

function novoJogador(equipe) {
  return { equipe, tentativas: 0, acertos: 0 };
}

// ───────────────────────────── Embeds: partida ─────────────────────────────
function linhaHistorico(h) {
  const marca = h.equipe ? EQUIPES[h.equipe].emoji : '👤';
  return `**#${h.n}** ${marca} <@${h.userId}> \`${h.palpite}\` → ${textoResultado(h)}`;
}

function totalTentativasEquipe(p, idsEquipe) {
  return idsEquipe.reduce((soma, id) => soma + p.jogadores.get(id).tentativas, 0);
}

function embedJogo(p) {
  const solo = p.modo === 'solo';

  // Resultado do último palpite em destaque (o histórico continua abaixo)
  const ultimo = p.historico[p.historico.length - 1];
  const destaque = ultimo
    ? `\n\n## 🎯 ${textoResultado(ultimo)}\nPalpite de <@${ultimo.userId}>: \`${ultimo.palpite}\``
    : '';

  const embed = new EmbedBuilder()
    .setColor(!ultimo ? COR_INICIO : ultimo.digitos > 0 || ultimo.posicoes > 0 ? COR_ACERTO : COR_ERRO)
    .setTitle(solo ? '🔐 Codebreaker — Solo' : '⚔️ Codebreaker — Duelo de Equipes')
    .setDescription(
      `Descubra o código secreto de **${p.digitos} dígitos**!\n` +
        `Use **Responder** nesta mensagem com o seu palpite.` +
        destaque,
    );

  if (solo) {
    embed.addFields(
      { name: '👤 Jogador', value: `<@${p.hostId}>`, inline: true },
      { name: '🎯 Tentativas', value: String(p.totalTentativas), inline: true },
    );
  } else {
    for (const [chave, ids] of Object.entries(p.equipes)) {
      const eq = EQUIPES[chave];
      embed.addFields({
        name: `${eq.emoji} ${eq.nome}`,
        value: `${ids.map((id) => `<@${id}>`).join(', ')}\nTentativas: **${totalTentativasEquipe(p, ids)}**`,
        inline: true,
      });
    }
  }

  embed.addFields({
    name: '📜 Últimas tentativas',
    value: p.historico.length
      ? p.historico.map(linhaHistorico).join('\n')
      : '*Nenhuma tentativa ainda. Mande o primeiro palpite!*',
  });

  return embed.setFooter({
    text: `💡 Responda apenas com números, todos juntos. Prefira este formato: ${'X'.repeat(p.digitos)} (Onde X são números).`,
  });
}

function payloadJogo(p) {
  return {
    embeds: [embedJogo(p)],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`cb_encerrar_${p.canalId}`)
          .setLabel('Encerrar partida')
          .setEmoji('🏳️')
          .setStyle(ButtonStyle.Danger),
      ),
    ],
  };
}

// ───────────────────────────── Embeds: resultado final ─────────────────────────────
function blocoEstatisticas(p, ids) {
  const lista = ids
    .map((id) => ({ id, ...p.jogadores.get(id) }))
    .sort((a, b) => b.tentativas - a.tentativas || b.acertos - a.acertos);

  const linhas = lista.map(
    (j, i) =>
      `**${i + 1}.** <@${j.id}> — ${plural(j.tentativas, 'tentativa', 'tentativas')} • ${plural(j.acertos, 'acerto', 'acertos')}`,
  );

  if (lista.length > 1) {
    const maisAcertou = [...lista].sort((a, b) => b.acertos - a.acertos || b.tentativas - a.tentativas)[0];
    if (lista[0].tentativas > 0) linhas.push('', `⭐ Mais tentou: <@${lista[0].id}> (${lista[0].tentativas})`);
    if (maisAcertou.acertos > 0) linhas.push(`🎯 Mais acertou: <@${maisAcertou.id}> (${maisAcertou.acertos})`);
  }

  return linhas.join('\n');
}

function embedFinal(p, motivo, vencedorId) {
  const solo = p.modo === 'solo';
  const tempo = formatarTempo(Date.now() - p.iniciadoEm);
  const embed = new EmbedBuilder();

  if (motivo === 'vitoria') {
    const equipeVencedora = p.jogadores.get(vencedorId).equipe;
    if (solo) {
      embed
        .setColor(COR_VITORIA)
        .setTitle('🏆 Código decifrado!')
        .setDescription(
          `<@${vencedorId}> descobriu o código \`${p.codigo}\` em **${plural(p.totalTentativas, 'tentativa', 'tentativas')}** (${tempo})!`,
        );
    } else {
      const eq = EQUIPES[equipeVencedora];
      embed
        .setColor(eq.cor)
        .setTitle(`🏆 ${eq.emoji} ${eq.nome} venceu!`)
        .setDescription(
          `<@${vencedorId}> decifrou o código \`${p.codigo}\`!\n` +
            `Total de **${plural(p.totalTentativas, 'tentativa', 'tentativas')}** em ${tempo}.`,
        );
    }
  } else {
    const aviso = motivo === 'inatividade' ? 'Partida encerrada por inatividade.' : 'Partida encerrada pelo host.';
    embed.setColor(COR_NEUTRA).setTitle('⏹️ Partida encerrada').setDescription(`${aviso}\nO código era \`${p.codigo}\`.`);
  }

  if (solo) {
    embed.addFields({ name: '📊 Estatísticas', value: blocoEstatisticas(p, [p.hostId]) });
  } else {
    for (const [chave, ids] of Object.entries(p.equipes)) {
      const eq = EQUIPES[chave];
      const venceu = motivo === 'vitoria' && p.jogadores.get(vencedorId).equipe === chave;
      embed.addFields({
        name: `${eq.emoji} ${eq.nome}${venceu ? ' 🏆' : ''} — ${plural(totalTentativasEquipe(p, ids), 'tentativa', 'tentativas')}`,
        value: blocoEstatisticas(p, ids),
        inline: true,
      });
    }
  }

  return embed.setFooter({ text: 'Acerto = tentativa com pelo menos 1 dígito certo.' });
}

// ───────────────────────────── Embeds: lobby ─────────────────────────────
function payloadLobby(p) {
  const pronto = p.equipes.azul.length > 0 && p.equipes.vermelha.length > 0;

  const embed = new EmbedBuilder()
    .setColor(COR_INICIO)
    .setTitle('⚔️ Codebreaker — Duelo de Equipes')
    .setDescription(
      `Host: <@${p.hostId}>\n` +
        `Código de **${p.digitos} dígitos** • até **${p.maxMembros}** por equipe.\n\n` +
        `Escolha uma equipe nos botões abaixo. O host inicia quando as duas equipes tiverem ao menos 1 jogador.`,
    );

  for (const [chave, ids] of Object.entries(p.equipes)) {
    const eq = EQUIPES[chave];
    embed.addFields({
      name: `${eq.emoji} ${eq.nome} (${ids.length}/${p.maxMembros})`,
      value: ids.length ? ids.map((id) => `<@${id}>`).join('\n') : '*Ninguém ainda*',
      inline: true,
    });
  }

  const linha1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cb_azul').setLabel('Equipe Azul').setEmoji('🔵').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('cb_vermelha').setLabel('Equipe Vermelha').setEmoji('🔴').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('cb_sair').setLabel('Sair').setStyle(ButtonStyle.Secondary),
  );
  const linha2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cb_iniciar').setLabel('Iniciar').setEmoji('▶️').setStyle(ButtonStyle.Success).setDisabled(!pronto),
    new ButtonBuilder().setCustomId('cb_cancelar').setLabel('Cancelar').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [linha1, linha2] };
}

// ───────────────────────────── Lógica da partida ─────────────────────────────
function criarPartida({ canal, hostId, modo, digitos, maxMembros = 1 }) {
  return {
    canal,
    canalId: canal.id,
    hostId,
    modo, // 'solo' | 'duelo'
    digitos,
    maxMembros,
    fase: 'lobby', // 'lobby' | 'jogo'
    equipes: { azul: [], vermelha: [] },
    jogadores: new Map(), // userId -> { equipe, tentativas, acertos }
    historico: [],
    totalTentativas: 0,
    codigo: null,
    mensagem: null, // Embed atual da partida
    iniciadoEm: null,
    encerrada: false,
    fila: Promise.resolve(), // processa palpites um de cada vez
    coletorMsg: null,
    coletorBtn: null,
  };
}

/** Responde a uma mensagem; se ela tiver sido apagada, envia no canal. */
async function responder(msg, payload, mencionar) {
  try {
    return await msg.reply({ ...payload, allowedMentions: { repliedUser: mencionar } });
  } catch {
    return msg.channel.send(payload);
  }
}

/** Edita o Embed atual; se ele foi apagado, envia um novo. */
async function atualizarEmbed(p) {
  try {
    await p.mensagem.edit(payloadJogo(p));
  } catch {
    p.mensagem = await p.canal.send(payloadJogo(p));
  }
}

function iniciarColetores(p) {
  // Só vale palpite que: responde ao Embed atual, vem de um jogador da partida
  // e é composto apenas por dígitos, com o tamanho exato do código.
  const filtro = (m) => {
    if (m.author.bot) return false;
    if (m.reference?.messageId !== p.mensagem.id) return false;
    if (!p.jogadores.has(m.author.id)) return false;
    const texto = m.content.trim();
    return texto.length === p.digitos && /^\d+$/.test(texto);
  };

  p.coletorMsg = p.canal.createMessageCollector({ filter: filtro, idle: TEMPO_INATIVIDADE });

  p.coletorMsg.on('collect', (msg) => {
    p.fila = p.fila.then(() => tratarPalpite(p, msg)).catch((e) => console.error('[Codebreaker] palpite:', e));
  });

  p.coletorMsg.on('end', (_, motivo) => {
    if (motivo === 'idle') {
      p.fila = p.fila.then(() => finalizar(p, 'inatividade')).catch((e) => console.error('[Codebreaker] fim:', e));
    }
  });

  p.coletorBtn = p.canal.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (i) => i.customId === `cb_encerrar_${p.canalId}`,
  });

  p.coletorBtn.on('collect', async (i) => {
    try {
      if (p.encerrada) return await i.deferUpdate();
      if (i.user.id !== p.hostId) return await i.reply(efemero('Só o host pode encerrar a partida.'));
      await finalizar(p, 'encerrada', { interacao: i });
    } catch (e) {
      console.error('[Codebreaker] encerrar:', e);
    }
  });
}

async function tratarPalpite(p, msg) {
  if (p.encerrada) return;

  const palpite = msg.content.trim();
  const resultado = avaliar(p.codigo, palpite);
  const jogador = p.jogadores.get(msg.author.id);

  jogador.tentativas++;
  if (resultado.digitos > 0) jogador.acertos++;
  p.totalTentativas++;

  p.historico.push({
    n: p.totalTentativas,
    userId: msg.author.id,
    equipe: jogador.equipe,
    palpite,
    ...resultado,
  });
  if (p.historico.length > MAX_HISTORICO) p.historico.shift();

  // Código descoberto!
  if (palpite === p.codigo) return finalizar(p, 'vitoria', { msg });

  // Acertou algum dígito e/ou posição: apaga o Embed anterior e responde o jogador com um novo
  if (resultado.digitos > 0 || resultado.posicoes > 0) {
    const antigo = p.mensagem;
    p.mensagem = await responder(msg, payloadJogo(p), false);
    antigo.delete().catch(() => {});
    return;
  }

  // Errou tudo: só edita o Embed existente
  await atualizarEmbed(p);
}

async function finalizar(p, motivo, { msg, interacao } = {}) {
  if (p.encerrada) return;
  p.encerrada = true;
  p.coletorMsg?.stop('fim');
  p.coletorBtn?.stop('fim');
  partidasAtivas.delete(p.canalId);

  const embed = embedFinal(p, motivo, msg?.author.id);

  if (motivo === 'vitoria') {
    const antigo = p.mensagem;
    await responder(msg, { embeds: [embed], components: [] }, true);
    antigo.delete().catch(() => {});
  } else if (interacao) {
    await interacao.update({ embeds: [embed], components: [] });
  } else {
    await p.mensagem.edit({ embeds: [embed], components: [] }).catch(() => p.canal.send({ embeds: [embed] }));
  }
}

// ───────────────────────────── Modo solo ─────────────────────────────
async function iniciarSolo(interaction, p) {
  p.fase = 'jogo';
  p.codigo = gerarCodigo(p.digitos);
  p.iniciadoEm = Date.now();
  p.jogadores.set(p.hostId, novoJogador(null));

  await interaction.reply(payloadJogo(p));
  p.mensagem = await interaction.fetchReply();
  iniciarColetores(p);
}

// ───────────────────────────── Modo duelo (lobby) ─────────────────────────────
async function abrirLobby(interaction, p) {
  await interaction.reply(payloadLobby(p));
  const msgLobby = await interaction.fetchReply();

  const coletor = msgLobby.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: TEMPO_LOBBY,
  });

  coletor.on('collect', async (i) => {
    try {
      const id = i.user.id;

      switch (i.customId) {
        case 'cb_azul':
        case 'cb_vermelha': {
          const alvo = i.customId === 'cb_azul' ? 'azul' : 'vermelha';
          if (p.equipes[alvo].includes(id)) return await i.reply(efemero('Você já está nessa equipe.'));
          if (p.equipes[alvo].length >= p.maxMembros) return await i.reply(efemero('Essa equipe já está cheia.'));
          for (const chave of Object.keys(p.equipes)) p.equipes[chave] = p.equipes[chave].filter((x) => x !== id);
          p.equipes[alvo].push(id);
          return await i.update(payloadLobby(p));
        }

        case 'cb_sair': {
          const estava = Object.values(p.equipes).some((ids) => ids.includes(id));
          if (!estava) return await i.reply(efemero('Você não está em nenhuma equipe.'));
          for (const chave of Object.keys(p.equipes)) p.equipes[chave] = p.equipes[chave].filter((x) => x !== id);
          return await i.update(payloadLobby(p));
        }

        case 'cb_iniciar': {
          if (id !== p.hostId) return await i.reply(efemero('Só o host pode iniciar a partida.'));
          if (!p.equipes.azul.length || !p.equipes.vermelha.length) {
            return await i.reply(efemero('As duas equipes precisam ter pelo menos 1 jogador.'));
          }

          coletor.stop('iniciada');
          p.fase = 'jogo';
          p.codigo = gerarCodigo(p.digitos);
          p.iniciadoEm = Date.now();
          for (const [chave, ids] of Object.entries(p.equipes)) {
            for (const uid of ids) p.jogadores.set(uid, novoJogador(chave));
          }

          // O próprio Embed do lobby vira o Embed da partida
          await i.update(payloadJogo(p));
          p.mensagem = i.message;
          iniciarColetores(p);
          return;
        }

        case 'cb_cancelar': {
          if (id !== p.hostId) return await i.reply(efemero('Só o host pode cancelar.'));
          coletor.stop('cancelada');
          partidasAtivas.delete(p.canalId);
          return await i.update({
            embeds: [new EmbedBuilder().setColor(COR_NEUTRA).setTitle('❌ Partida cancelada').setDescription('O host cancelou o duelo.')],
            components: [],
          });
        }
      }
    } catch (e) {
      console.error('[Codebreaker] lobby:', e);
    }
  });

  coletor.on('end', async (_, motivo) => {
    if (motivo !== 'time') return;
    partidasAtivas.delete(p.canalId);
    await msgLobby
      .edit({
        embeds: [new EmbedBuilder().setColor(COR_NEUTRA).setTitle('⌛ Lobby expirado').setDescription('O duelo não foi iniciado a tempo.')],
        components: [],
      })
      .catch(() => {});
  });
}

// ───────────────────────────── Definição do comando ─────────────────────────────
const opcaoDificuldade = (o) =>
  o
    .setName('dificuldade')
    .setDescription(`Quantidade de dígitos do código (${DIGITOS_MIN} a ${DIGITOS_MAX}). Padrão: ${DIGITOS_PADRAO}`)
    .setMinValue(DIGITOS_MIN)
    .setMaxValue(DIGITOS_MAX)
    .setRequired(false);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('codebreaker')
    .setDescription('🔐 Descubra o código secreto criado pelo bot!')
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('solo')
        .setDescription('Jogue sozinho contra o código secreto')
        .addIntegerOption(opcaoDificuldade),
    )
    .addSubcommand((sub) =>
      sub
        .setName('equipe')
        .setDescription('Duelo: duas equipes disputam quem descobre o código primeiro')
        .addIntegerOption((o) =>
          o
            .setName('membros')
            .setDescription(`Quantos membros por equipe (1 a ${MEMBROS_MAX})`)
            .setMinValue(1)
            .setMaxValue(MEMBROS_MAX)
            .setRequired(true),
        )
        .addIntegerOption(opcaoDificuldade),
    ),

  async execute(interaction) {
    const canal = interaction.channel ?? (await interaction.client.channels.fetch(interaction.channelId));

    if (partidasAtivas.has(canal.id)) {
      return interaction.reply(efemero('⚠️ Já existe uma partida de Codebreaker em andamento neste canal.'));
    }

    const sub = interaction.options.getSubcommand();
    const digitos = interaction.options.getInteger('dificuldade') ?? DIGITOS_PADRAO;

    const p = criarPartida({
      canal,
      hostId: interaction.user.id,
      modo: sub === 'solo' ? 'solo' : 'duelo',
      digitos,
      maxMembros: sub === 'equipe' ? interaction.options.getInteger('membros') : 1,
    });

    partidasAtivas.set(canal.id, p);

    try {
      if (sub === 'solo') await iniciarSolo(interaction, p);
      else await abrirLobby(interaction, p);
    } catch (erro) {
      partidasAtivas.delete(canal.id);
      throw erro;
    }
  },
};