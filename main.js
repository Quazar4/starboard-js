const Discord = require('discord.js');
const { Client } = require('pg');

const client = new Discord.Client();
const dbClient = new Client({
  connectionString: 'postgres://username:password@localhost:5432/database', // Replace with your PostgreSQL connection string
});

// Starboard configuration
const STAR_REACTION = '⭐'; // Emoji to trigger the starboard
const STAR_THRESHOLD = 5; // Minimum number of reactions required to post to the starboard

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await dbClient.connect(); // Connect to the PostgreSQL database

  // Create the starboard table if it doesn't exist
  await dbClient.query(`
    CREATE TABLE IF NOT EXISTS starboard (
      id SERIAL PRIMARY KEY,
      message_id VARCHAR(20) NOT NULL,
      starboard_message_id VARCHAR(20) NOT NULL
    );
  `);
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (reaction.emoji.name !== STAR_REACTION) return;

  const { message } = reaction;
  const { guild } = message;

  const starboardChannel = guild.channels.cache.find(channel => channel.name === 'starboard');
  if (!starboardChannel) return;

  const { rows } = await dbClient.query('SELECT * FROM starboard WHERE message_id = $1', [message.id]);
  if (rows.length === 0) {
    const starCount = reaction.count;
    if (starCount >= STAR_THRESHOLD) {
      const embed = new Discord.MessageEmbed()
        .setAuthor(message.author.tag, message.author.displayAvatarURL())
        .setDescription(message.content)
        .addField('Original', `[Jump to message](${message.url})`)
        .setTimestamp();

      if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        if (attachment) {
          embed.setImage(attachment.url);
        }
      }

      const starboardMessage = await starboardChannel.send({ embeds: [embed] });
      await dbClient.query('INSERT INTO starboard (message_id, starboard_message_id, star_count) VALUES ($1, $2, $3)', [
        message.id,
        starboardMessage.id,
        starCount,
      ]);
    }
  } else {
    const starCount = reaction.count;
    await dbClient.query('UPDATE starboard SET star_count = $1 WHERE message_id = $2', [starCount, message.id]);
  }
});

client.on('messageReactionRemove', async (reaction, user) => {
  if (reaction.emoji.name !== STAR_REACTION) return;

  const { message } = reaction;
  const { guild } = message;

  const starboardChannel = guild.channels.cache.find(channel => channel.name === 'starboard');
  if (!starboardChannel) return;

  const { rows } = await dbClient.query('SELECT * FROM starboard WHERE message_id = $1', [message.id]);
  if (rows.length > 0) {
    const starCount = reaction.count;
    if (starCount < STAR_THRESHOLD) {
      const starboardMessageId = rows[0].starboard_message_id;
      const starboardMessage = await starboardChannel.messages.fetch(starboardMessageId);
      if (starboardMessage) {
        await starboardMessage.delete();
      }

      await dbClient.query('DELETE FROM starboard WHERE message_id = $1', [message.id]);
    } 
    else {
      await dbClient.query('UPDATE starboard SET star_count = $1 WHERE message_id = $2', [starCount, message.id]);
    }
  }
});

client.login('YOUR_DISCORD_BOT_TOKEN');
