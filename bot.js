const fs = require('fs');
const { Client, GatewayIntentBits, Partials } = require('discord.js');

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.ThreadMember],
});

// Use the BOT_TOKEN environment variable from Railway
const token = process.env.BOT_TOKEN;

// File to store grind data persistently
const DATA_FILE = './grindData.json';

// Load existing data if file exists
let grindData = {};
if (fs.existsSync(DATA_FILE)) {
  try {
    grindData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    console.error('⚠️ Failed to read grindData.json:', err);
    grindData = {};
  }
}

// Helper: Save grind data
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(grindData, null, 2));
}

// Helper: Update the pinned progress message
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
    `You are **${percent}%** of the way to completing your goal! (${data.total} / ${data.goal} collected)`
  );

  await newMsg.pin();
  data.lastMessageId = newMsg.id;
  saveData();
}

// Handle messages
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim();

  // --- Create new grind thread ---
  if (content.startsWith('?grind ')) {
    const goal = parseInt(content.split(' ')[1]);
    if (isNaN(goal) || goal <= 0)
      return message.reply('Please provide a valid goal number.');

    // Create a thread for this grind
    const thread = await message.startThread({
      name: `Grinding - ${goal}`,
      autoArchiveDuration: 1440, // 24 hours
    });

    grindData[thread.id] = {
      goal,
      total: 0,
      lastMessageId: null,
    };
    saveData();

    await updateProgressMessage(thread, grindData[thread.id]);
    message.reply(`Thread created for a grind goal of **${goal}**!`);
  }

  // --- Handle updates inside grind threads ---
  if (message.channel.isThread()) {
    const threadId = message.channel.id;
    const data = grindData[threadId];
    if (!data) return; // not a grind thread

    if (content.startsWith('?add ')) {
      const num = parseInt(content.split(' ')[1]);
      if (isNaN(num)) return message.reply('Please provide a valid number.');
      data.total += num;
      saveData();
      await updateProgressMessage(message.channel, data);
    }

    else if (content.startsWith('?subtract ')) {
      const num = parseInt(content.split(' ')[1]);
      if (isNaN(num)) return message.reply('Please provide a valid number.');
      data.total = Math.max(data.total - num, 0);
      saveData();
      await updateProgressMessage(message.channel, data);
    }

    else if (content === '?total') {
      const percent = ((data.total / data.goal) * 100).toFixed(1);
      message.reply(
        `Goal: **${data.goal}**\nTotal: **${data.total}**\nProgress: **${percent}%**`
      );
    }

    else if (content === '?reset') {
      data.total = 0;
      saveData();
      await updateProgressMessage(message.channel, data);
    }
  }
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Start the bot
client.login(token);
