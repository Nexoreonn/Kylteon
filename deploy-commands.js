// deploy-commands.js
// Registra os slash commands do bot na API do Discord (discord.js v14).
//
// Uso:
//   node deploy-commands.js                  -> registra na guild configurada em GUILD_ID
//   node deploy-commands.js --global         -> registra globalmente
//   node deploy-commands.js --check          -> compara comandos locais e registrados
//   node deploy-commands.js --clear          -> remove comandos da guild
//   node deploy-commands.js --clear --global -> remove comandos globais

require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

const { BOT_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

const supportedFlags = new Set(['--global', '--clear', '--check']);
const unknownFlags = process.argv.slice(2).filter((arg) => !supportedFlags.has(arg));
const isGlobal = process.argv.includes('--global');
const isClear = process.argv.includes('--clear');
const isCheck = process.argv.includes('--check');

if (unknownFlags.length) {
  console.error(`❌ Opção(ões) desconhecida(s): ${unknownFlags.join(', ')}`);
  process.exit(1);
}

if (isClear && isCheck) {
  console.error('❌ Use --clear ou --check, não ambos.');
  process.exit(1);
}

if (!BOT_TOKEN || !CLIENT_ID || (!isGlobal && !GUILD_ID)) {
  console.error('❌ Configure BOT_TOKEN, CLIENT_ID e, para escopo de servidor, GUILD_ID no .env.');
  process.exit(1);
}

// Sempre usa a pasta commands ao lado deste script, independentemente do diretório atual.
const commandsPath = path.join(__dirname, 'commands');

function loadCommands(dir) {
  const commands = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      commands.push(...loadCommands(fullPath));
      continue;
    }

    if (!entry.name.endsWith('.js')) continue;

    const command = require(fullPath);

    if (!command?.data || typeof command.data.toJSON !== 'function' || typeof command.execute !== 'function') {
      throw new Error(`Comando inválido em ${fullPath}: esperado data.toJSON() e execute().`);
    }

    commands.push(command.data.toJSON());
  }

  return commands;
}

function printCommands(label, commands) {
  console.log(`${label} (${commands.length}):`);
  if (!commands.length) console.log('  (nenhum)');
  for (const command of commands) console.log(`  /${command.name}`);
}

async function main() {
  if (!fs.existsSync(commandsPath)) {
    throw new Error(`Pasta de comandos não encontrada: ${commandsPath}`);
  }

  const localCommands = isClear ? [] : loadCommands(commandsPath);
  const names = localCommands.map((command) => command.name);
  const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicateNames.length) {
    throw new Error(`Nomes de comando duplicados: ${[...new Set(duplicateNames)].join(', ')}`);
  }

  const route = isGlobal
    ? Routes.applicationCommands(CLIENT_ID)
    : Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID);
  const scope = isGlobal ? 'global' : `servidor ${GUILD_ID}`;
  const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

  const application = await rest.get(Routes.oauth2CurrentApplication());
  if (application.id !== CLIENT_ID) {
    throw new Error(
      `CLIENT_ID (${CLIENT_ID}) não corresponde à aplicação do BOT_TOKEN (${application.id}). ` +
        'Corrija os valores no .env antes de continuar.',
    );
  }

  console.log(`✅ Aplicação verificada: ${application.id}`);
  console.log(`📍 Escopo selecionado: ${scope}`);
  if (!isClear) printCommands('Comandos locais', localCommands);

  if (isCheck) {
    const remoteCommands = await rest.get(route);
    printCommands('Comandos registrados no Discord', remoteCommands);

    const remoteNames = new Set(remoteCommands.map((command) => command.name));
    const localNames = new Set(names);
    const missing = names.filter((name) => !remoteNames.has(name));
    const stale = remoteCommands.map((command) => command.name).filter((name) => !localNames.has(name));

    if (missing.length || stale.length) {
      if (missing.length) console.error(`❌ Ausentes no Discord: ${missing.map((name) => `/${name}`).join(', ')}`);
      if (stale.length) console.error(`⚠️ Remotos sem arquivo local: ${stale.map((name) => `/${name}`).join(', ')}`);
      process.exitCode = 1;
    } else {
      console.log('✅ Os nomes locais e os registrados correspondem.');
    }
    return;
  }

  const action = isClear ? 'Removendo todos os comandos do escopo' : 'Publicando comandos no escopo';
  console.log(`\n🔄 ${action} ${scope}...`);
  const result = await rest.put(route, { body: localCommands });
  printCommands('Comandos confirmados pela API do Discord', result);
  console.log(`✅ ${isClear ? 'Escopo limpo' : 'Deploy concluído'} com sucesso.`);
}

main().catch((error) => {
  console.error('❌ Erro no deploy dos comandos:', error.message);
  if (error.status) console.error(`HTTP ${error.status}${error.code ? ` (código Discord ${error.code})` : ''}`);
  process.exitCode = 1;
});