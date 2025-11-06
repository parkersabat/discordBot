// ============================
// Discord Bot + Express Web Server
// ============================

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');

// ----------------------------
// Express server for uptime
// ----------------------------
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot is awake!'));
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// ----------------------------
// Discord Bot setup
// ----------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.ThreadMember],
});

const token = process.env.BOT_TOKEN;

// ----------------------------
// In-memory grind data
// ----------------------------
let grindData = {}; // { threadId: { goal, item, total, lastMessageId } }

// ----------------------------
// Helper: Update progress message
// ----------------------------
async function updateProgressMessage(thread, data) {
  if (data.lastMessageId) {
    try {
      const oldMsg = await thread.messages.fetch(data.lastMessageId);
      await oldMsg.unpin().catch(() => {});
      await oldMsg.delete().catch(() => {});
    } catch (_) {}
  }

  const percent = ((data.total / data.goal) * 100).toFixed(1);
  const newMsg = await thread.send(
    `You are **${percent}%** of the way to completing your goal of **${data.item}**! (${data.total} / ${data.goal} collected)`
  );
  await newMsg.pin();
  data.lastMessageId = newMsg.id;
}

// ----------------------------
// Handle messages
// ----------------------------
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const content = message.content.trim();

  // Create new grind thread
  if (content.startsWith('?grind ')) {
    const parts = content.split(' ');
    if (parts.length < 3) return message.reply('Usage: ?grind <item> <goal>');

    const item = parts[1];
    const goal = parseInt(parts[2]);
    if (isNaN(goal) || goal <= 0)
      return message.reply('Please provide a valid numeric goal.');

    // Thread name: <item> x<goal>
    const threadName = `${item} x${goal}`;
    const thread = await message.startThread({
      name: threadName,
      autoArchiveDuration: 1440
    });

    grindData[thread.id] = { goal, item, total: 0, lastMessageId: null };
    await updateProgressMessage(thread, grindData[thread.id]);
    message.reply(`Thread created for **${item} x${goal}**!`);
  }

  // Handle thread commands
  if (message.channel.isThread()) {
    const threadId = message.channel.id;
    const data = grindData[threadId];
    if (!data) return;

    if (content.startsWith('?add ')) {
      const num = parseInt(content.split(' ')[1]);
      if (isNaN(num)) return message.reply('Please provide a valid number.');
      data.total += num;
      await updateProgressMessage(message.channel, data);
    } else if (content.startsWith('?subtract ')) {
      const num = parseInt(content.split(' ')[1]);
      if (isNaN(num)) return message.reply('Please provide a valid number.');
      data.total = Math.max(data.total - num, 0);
      await updateProgressMessage(message.channel, data);
    } else if (content === '?total') {
      const percent = ((data.total / data.goal) * 100).toFixed(1);
      message.reply(`Goal: **${data.goal}**\nItem: **${data.item}**\nTotal: **${data.total}**\nProgress: **${percent}%**`);
    } else if (content === '?reset') {
      data.total = 0;
      await updateProgressMessage(message.channel, data);
    }
  }
});

// ----------------------------
// Ready event
// ----------------------------
client.once('ready', () => console.log(`✅ Logged in as ${client.user.tag}`));
client.login(token);
