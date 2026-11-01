const fs = require('node:fs');
const dotenv = require('dotenv');
dotenv.config();
require('./web.js');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const BOT_TOKEN = process.env.BOT_TOKEN;

fetch('https://discord.com/api/v10/gateway', { signal: AbortSignal.timeout(15000) })
	.then((r) => console.log('[teste] discord.com respondeu com status', r.status))
	.catch((e) => console.error('[teste] falhou ou deu timeout:', e.name, e.message)
);

client.rest.on('restDebug', (info) => console.log('[rest]', info));

if (!BOT_TOKEN) {
	console.error('BOT_TOKEN não está definido no .env.');
	process.exit(1);
};

const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.commands = new Collection();
const foldersPath = path.join(__dirname, 'commands');
function loadCommandFiles(dir) {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const filePath = path.join(dir, entry.name);
		if (entry.isDirectory()) return loadCommandFiles(filePath);
		return entry.isFile() && entry.name.endsWith('.js') ? [filePath] : [];
	});
}

for (const filePath of loadCommandFiles(foldersPath)) {
	const command = require(filePath);
	if (!command?.data || typeof command.data.toJSON !== 'function' || typeof command.execute !== 'function') {
		throw new Error(`Comando inválido em ${filePath}: esperado data.toJSON() e execute().`);
	}

	const commandName = command.data.name;
	if (client.commands.has(commandName)) {
		throw new Error(`Nome de comando duplicado: /${commandName} (${filePath}).`);
	}
	client.commands.set(commandName, command);
}
console.log(`Comandos carregados: ${[...client.commands.keys()].map((name) => `/${name}`).join(', ') || '(nenhum)'}`);

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

client.on('debug', (info) => console.log('[debug]', info));
client.on('error', (error) => console.error('[client error]', error));
client.on('shardError', (error) => console.error('[shard error]', error));
client.rest.on('rateLimited', (info) => console.warn('[rate limit]', info));

console.log('Tentando logar...');
client.login(BOT_TOKEN)
	.then(() => console.log('login() resolveu'))
	.catch((error) => {
		console.error('Falha ao iniciar sessão no Discord:', error.message);
		process.exitCode = 1;
	});