const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require('discord.js');
const { performance } = require('node:perf_hooks');

// ─────────────────────────── Configurações ───────────────────────────
const LOBBY_TIMEOUT = 120_000; // tempo máximo para as equipes encherem
const COUNTDOWN_MS = 5_000; // contagem antes do "Olha o botão!"
const MIN_DELAY_MS = 1_000; // espera mínima até o botão ativar
const MAX_DELAY_MS = 6_000; // espera máxima até o botão ativar
const PRESS_TIMEOUT_MS = 10_000; // tempo limite para apertar depois que o botão ativa
const TENSION_MS = 2_000; // momento de tensão antes do resultado
const REMATCH_DELAY_MS = 4_000; // pausa entre o empate e a nova rodada

const TEAMS = {
  red: { name: 'Vermelha', emoji: '🔴', color: 0xed4245 },
  blue: { name: 'Azul', emoji: '🔵', color: 0x3b82f6 },
};
const NEUTRAL_COLOR = 0x5865f2;
const DISCLAIMER =
  '⚠️ O tempo é medido entre o sinal e o recebimento da interação pelo bot. A latência da rede e do Discord pode influenciar o resultado.';

// Evita duas partidas ao mesmo tempo no mesmo canal
const activeChannels = new Set();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ephemeral = (content) => ({ content, flags: MessageFlags.Ephemeral });

// ─────────────────────────── Builders de UI ───────────────────────────
function teamList(ids, team) {
  return ids.length ? ids.map((id) => `${team.emoji} <@${id}>`).join('\n') : '*Ninguém ainda*';
}

function lobbyPayload(hostId, size, teams, locked = false) {
  const embed = new EmbedBuilder()
    .setColor(NEUTRAL_COLOR)
    .setTitle('⚡ Reaction Time')
    .setDescription(
      `<@${hostId}> iniciou uma partida **${size}v${size}**!\n` +
        'Entre em uma equipe. A partida começa automaticamente quando as duas estiverem completas.',
    )
    .addFields(
      {
        name: `${TEAMS.red.emoji} ${TEAMS.red.name} (${teams.red.length}/${size})`,
        value: teamList(teams.red, TEAMS.red),
        inline: true,
      },
      {
        name: `${TEAMS.blue.emoji} ${TEAMS.blue.name} (${teams.blue.length}/${size})`,
        value: teamList(teams.blue, TEAMS.blue),
        inline: true,
      },
    )
    .setFooter({ text: `O lobby fecha em ${LOBBY_TIMEOUT / 60_000} minutos.` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('reaction_join_red')
      .setLabel('Vermelha')
      .setEmoji(TEAMS.red.emoji)
      .setStyle(ButtonStyle.Danger)
      .setDisabled(locked),
    new ButtonBuilder()
      .setCustomId('reaction_join_blue')
      .setLabel('Azul')
      .setEmoji(TEAMS.blue.emoji)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(locked),
    new ButtonBuilder()
      .setCustomId('reaction_leave')
      .setLabel('Sair')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(locked),
    new ButtonBuilder()
      .setCustomId('reaction_cancel')
      .setLabel('Cancelar')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(locked),
  );

  return { embeds: [embed], components: [row] };
}

function pressRow(state) {
  const button = new ButtonBuilder().setCustomId('reaction_press');
  if (state === 'active') {
    button.setLabel('APERTE AGORA!').setEmoji('⚡').setStyle(ButtonStyle.Success).setDisabled(false);
  } else {
    button.setLabel('Aguarde...').setStyle(ButtonStyle.Secondary).setDisabled(true);
  }
  return new ActionRowBuilder().addComponents(button);
}

function teamsOverview(teams) {
  return [
    {
      name: `${TEAMS.red.emoji} ${TEAMS.red.name}`,
      value: teamList(teams.red, TEAMS.red),
      inline: true,
    },
    {
      name: `${TEAMS.blue.emoji} ${TEAMS.blue.name}`,
      value: teamList(teams.blue, TEAMS.blue),
      inline: true,
    },
  ];
}

// ─────────────────────────── Lobby ───────────────────────────
function runLobby(interaction, message, size) {
  const teams = { red: [], blue: [] };
  const hostId = interaction.user.id;

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: LOBBY_TIMEOUT,
    filter: (i) => i.customId.startsWith('reaction_') && i.customId !== 'reaction_press',
  });

  return new Promise((resolve) => {
    collector.on('collect', async (i) => {
      try {
        if (i.customId === 'reaction_cancel') {
          if (i.user.id !== hostId) {
            return await i.reply(ephemeral('Só quem iniciou a partida pode cancelar.'));
          }
          await i.deferUpdate();
          return collector.stop('cancelled');
        }

        if (i.customId === 'reaction_leave') {
          const wasIn = teams.red.includes(i.user.id) || teams.blue.includes(i.user.id);
          if (!wasIn) return await i.reply(ephemeral('Você não está em nenhuma equipe.'));
          teams.red = teams.red.filter((id) => id !== i.user.id);
          teams.blue = teams.blue.filter((id) => id !== i.user.id);
          return await i.update(lobbyPayload(hostId, size, teams));
        }

        // Entrar em uma equipe (ou trocar de equipe)
        const team = i.customId === 'reaction_join_red' ? 'red' : 'blue';
        const other = team === 'red' ? 'blue' : 'red';

        if (teams[team].includes(i.user.id)) {
          return await i.reply(ephemeral(`Você já está na equipe ${TEAMS[team].name}!`));
        }
        if (teams[team].length >= size) {
          return await i.reply(ephemeral(`A equipe ${TEAMS[team].name} já está cheia.`));
        }

        teams[other] = teams[other].filter((id) => id !== i.user.id);
        teams[team].push(i.user.id);

        const ready = teams.red.length === size && teams.blue.length === size;
        await i.update(lobbyPayload(hostId, size, teams, ready));
        if (ready) collector.stop('ready');
      } catch (err) {
        console.error('[reaction] Erro no lobby:', err);
      }
    });

    collector.on('end', (_, reason) => resolve({ reason, teams }));
  });
}

// ─────────────────────────── Avaliação ───────────────────────────
function evaluate(teams, presses, t0) {
  const stats = {};

  for (const key of ['red', 'blue']) {
    const members = teams[key].map((id) => ({
      id,
      ms: presses.has(id) ? Math.max(0, Math.round(presses.get(id) - t0)) : null,
    }));
    const pressed = members.filter((m) => m.ms !== null);
    const total = pressed.reduce((sum, m) => sum + m.ms, 0);

    stats[key] = {
      members,
      pressedCount: pressed.length,
      total,
      avg: pressed.length ? total / pressed.length : null,
      complete: pressed.length === members.length,
    };
  }

  const { red, blue } = stats;
  let winner; // 'red' | 'blue' | 'tie' | 'none'
  let reason; // 'average' | 'presses'

  if (red.complete && blue.complete) {
    // Mesmo tamanho de equipe: comparar a soma equivale a comparar a média (sem erro de float)
    reason = 'average';
    if (red.total === blue.total) winner = 'tie';
    else winner = red.total < blue.total ? 'red' : 'blue';
  } else if (red.pressedCount !== blue.pressedCount) {
    reason = 'presses';
    winner = red.pressedCount > blue.pressedCount ? 'red' : 'blue';
  } else if (red.pressedCount === 0) {
    winner = 'none';
  } else {
    winner = 'tie';
  }

  return { stats, winner, reason };
}

const fmt = (ms) => `${ms.toFixed(1)} ms`;

function resultEmbed({ stats, winner, reason }, round, size) {
  const embed = new EmbedBuilder().setFooter({ text: DISCLAIMER });
  const roundTag = round > 1 ? ` (Rodada ${round})` : '';

  if (winner === 'red' || winner === 'blue') {
    const team = TEAMS[winner];
    const loser = winner === 'red' ? 'blue' : 'red';
    embed.setColor(team.color).setTitle(`🏆 Equipe ${team.name} venceu!${roundTag}`);

    if (reason === 'average') {
      embed.setDescription(
        `Menor média de reação: **${fmt(stats[winner].avg)}** contra **${fmt(stats[loser].avg)}**.`,
      );
    } else {
      embed.setDescription(
        `Nem todos apertaram o botão, então a equipe com mais apertos vence instantaneamente: ` +
          `**${stats[winner].pressedCount}** x **${stats[loser].pressedCount}**.`,
      );
    }
  } else if (winner === 'tie') {
    embed
      .setColor(NEUTRAL_COLOR)
      .setTitle(`🤝 Empate!${roundTag}`)
      .setDescription(`Nova rodada em ${REMATCH_DELAY_MS / 1000} segundos entre as mesmas equipes...`);
  } else {
    embed
      .setColor(NEUTRAL_COLOR)
      .setTitle(`😴 Ninguém apertou o botão${roundTag}`)
      .setDescription('A partida foi encerrada por inatividade.');
  }

  for (const key of ['red', 'blue']) {
    const team = TEAMS[key];
    const s = stats[key];

    const sorted = [...s.members].sort((a, b) => {
      if (a.ms === null) return 1;
      if (b.ms === null) return -1;
      return a.ms - b.ms;
    });

    const lines = sorted.map((m) =>
      m.ms === null ? `❌ <@${m.id}> — *não apertou*` : `${team.emoji} <@${m.id}> — **${m.ms} ms**`,
    );

    const avgLine =
      s.avg === null
        ? '**Média:** —'
        : `**Média:** ${fmt(s.avg)}${s.complete ? '' : ` (${s.pressedCount}/${size} apertaram)`}`;

    embed.addFields({
      name: `${team.emoji} ${team.name}`,
      value: `${lines.join('\n')}\n\n${avgLine}`,
      inline: true,
    });
  }

  return embed;
}

// ─────────────────────────── Rodada ───────────────────────────
async function playRound(interaction, message, teams, size, round) {
  const roundTag = round > 1 ? ` — Rodada ${round}` : '';

  // 1) Contagem de 5s com instruções
  const startsAt = Math.ceil((Date.now() + COUNTDOWN_MS) / 1000);
  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(NEUTRAL_COLOR)
        .setTitle(`⚡ Reaction Time${roundTag}`)
        .setDescription(
          '**Aperte o botão o mais rápido possível quando ele aparecer!**\n' +
            'Todos os jogadores precisam apertar. Se alguém não apertar, a equipe com mais apertos vence instantaneamente.\n\n' +
            `Começando <t:${startsAt}:R>...`,
        )
        .addFields(teamsOverview(teams))
        .setFooter({ text: DISCLAIMER }),
    ],
    components: [pressRow('waiting')],
  });
  await sleep(COUNTDOWN_MS);

  // 2) "Olha o botão!" (botão ainda desativado)
  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle('👀 Olha o botão!')
        .setDescription('Prepare-se... ele vai ativar a qualquer momento!')
        .addFields(teamsOverview(teams)),
    ],
    components: [pressRow('waiting')],
  });

  // 3) Espera aleatória entre 1 e 6 segundos
  await sleep(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));

  // 4) Ativa o botão e começa a cronometrar
  const playerIds = new Set([...teams.red, ...teams.blue]);
  const presses = new Map(); // userId -> performance.now() no recebimento da interação
  let t0 = null;

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: PRESS_TIMEOUT_MS,
    filter: (i) => i.customId === 'reaction_press',
  });

  collector.on('collect', async (i) => {
    const receivedAt = performance.now(); // marca o tempo ANTES de qualquer await

    if (!playerIds.has(i.user.id)) {
      return i.reply(ephemeral('Você não está participando desta partida!')).catch((error) => {
        console.error('[reaction] Falha ao responder a um clique não participante:', error);
      });
    }

    i.deferUpdate().catch((error) => {
      console.error('[reaction] Falha ao confirmar o clique:', error);
    });
    if (presses.has(i.user.id)) return; // só o primeiro clique conta

    presses.set(i.user.id, receivedAt);
    if (presses.size === playerIds.size) collector.stop('all_pressed');
  });

  const ended = new Promise((resolve) => collector.on('end', resolve));

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('🟢 AGORA!')
        .setDescription('**APERTE O BOTÃO!**')
        .addFields(teamsOverview(teams)),
    ],
    components: [pressRow('active')],
  });
  t0 = performance.now(); // sinal enviado (resposta da API recebida)

  await ended;

  // 5) Momento de tensão
  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(NEUTRAL_COLOR)
        .setTitle('😰 Calculando os resultados...')
        .setDescription('Quem será mais rápido?'),
    ],
    components: [pressRow('waiting')],
  });
  await sleep(TENSION_MS);

  // 6) Resultado
  const outcome = evaluate(teams, presses, t0);
  await interaction.editReply({
    embeds: [resultEmbed(outcome, round, size)],
    components: [],
  });

  return outcome.winner;
}

// ─────────────────────────── Comando ───────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactiontime')
    .setDescription('Minigame de reflexo: equipe Vermelha vs Azul')
    .addIntegerOption((opt) =>
      opt
        .setName('jogadores')
        .setDescription('Quantidade de jogadores por equipe (1 a 5)')
        .setMinValue(1)
        .setMaxValue(5)
        .setRequired(true),
    ),

  async execute(interaction) {
    if (activeChannels.has(interaction.channelId)) {
      return interaction.reply(ephemeral('Já existe uma partida de Reaction Time acontecendo neste canal!'));
    }
    activeChannels.add(interaction.channelId);

    try {
      const size = interaction.options.getInteger('jogadores', true);

      await interaction.reply(lobbyPayload(interaction.user.id, size, { red: [], blue: [] }));
      const message = await interaction.fetchReply();

      const { reason, teams } = await runLobby(interaction, message, size);

      if (reason !== 'ready') {
        const text =
          reason === 'cancelled'
            ? '❌ Partida cancelada pelo organizador.'
            : '⏰ Tempo esgotado! As equipes não ficaram completas a tempo.';
        return await interaction.editReply({
          embeds: [new EmbedBuilder().setColor(NEUTRAL_COLOR).setTitle('Reaction Time').setDescription(text)],
          components: [],
        });
      }

      // Em caso de empate, uma nova rodada começa entre as mesmas equipes
      let round = 1;
      while (true) {
        const winner = await playRound(interaction, message, teams, size, round);
        if (winner !== 'tie') break;
        await sleep(REMATCH_DELAY_MS);
        round++;
      }
    } catch (err) {
      console.error('[reaction] Erro inesperado:', err);
      try {
        await interaction.editReply({
          content: '❌ Ocorreu um erro durante a partida.',
          embeds: [],
          components: [],
        });
      } catch (replyError) {
        console.error('[reaction] Falha ao informar o erro da partida:', replyError);
      }
    } finally {
      activeChannels.delete(interaction.channelId);
    }
  },
};