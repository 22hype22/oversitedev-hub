import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  VoiceChannel,
} from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
} from "@discordjs/voice";
import ytdl from "@distube/ytdl-core";
import ytSearch from "yt-search";
import type { Addon, AddonContext } from "./index.js";

interface QueueEntry {
  title: string;
  url: string;
  requestedBy: string;
}

const queues = new Map<string, QueueEntry[]>();
const players = new Map<string, ReturnType<typeof createAudioPlayer>>();
const autoRadioGenres = new Map<string, string>(); // guildId -> genre

const GENRE_QUERIES = [
  "greatest {genre} songs of all time",
  "best {genre} hits ever",
  "top {genre} songs all time",
  "most popular {genre} songs",
  "classic {genre} songs",
];

async function searchYouTube(query: string): Promise<{ title: string; url: string } | null> {
  try {
    const result = await ytSearch(query);
    const video = result.videos[0];
    if (!video) return null;
    return { title: video.title, url: video.url };
  } catch {
    return null;
  }
}

async function playNext(guildId: string, ctx: AddonContext) {
  const queue = queues.get(guildId) ?? [];
  const connection = getVoiceConnection(guildId);
  if (!connection) return;

  if (queue.length === 0) {
    // Check if auto radio is active
    const genre = autoRadioGenres.get(guildId);
    if (genre) {
      const query = GENRE_QUERIES[Math.floor(Math.random() * GENRE_QUERIES.length)].replace("{genre}", genre);
      const result = await searchYouTube(query);
      if (result) queue.push({ ...result, requestedBy: "Auto Radio" });
      else return;
    } else {
      return;
    }
  }

  const track = queue.shift()!;
  queues.set(guildId, queue);

  try {
    const stream = ytdl(track.url, { filter: "audioonly", quality: "lowestaudio" });
    const resource = createAudioResource(stream);
    const player = players.get(guildId) ?? createAudioPlayer();
    players.set(guildId, player);
    connection.subscribe(player);
    player.play(resource);
    player.once(AudioPlayerStatus.Idle, () => playNext(guildId, ctx));
    await ctx.log("info", `Now playing: ${track.title}`, { guild: guildId });
  } catch (err) {
    await ctx.log("error", `Failed to play ${track.title}: ${String(err)}`);
    await playNext(guildId, ctx);
  }
}

// ── Music Addon ──
export const musicAddon: Addon = {
  id: "music",
  name: "Music Add-On",

  commands: [
    new SlashCommandBuilder()
      .setName("play")
      .setDescription("Play a song")
      .addStringOption((o) => o.setName("query").setDescription("Song name or YouTube URL").setRequired(true)),

    new SlashCommandBuilder()
      .setName("skip")
      .setDescription("Skip the current song"),

    new SlashCommandBuilder()
      .setName("stop")
      .setDescription("Stop music (bot stays in voice)"),

    new SlashCommandBuilder()
      .setName("pause")
      .setDescription("Pause or resume the music"),

    new SlashCommandBuilder()
      .setName("queue")
      .setDescription("View the current queue"),

    new SlashCommandBuilder()
      .setName("volume")
      .setDescription("Set the volume")
      .addIntegerOption((o) => o.setName("level").setDescription("Volume 0-100").setRequired(true)),

    new SlashCommandBuilder()
      .setName("nowplaying")
      .setDescription("Show what's currently playing"),

    new SlashCommandBuilder()
      .setName("songname")
      .setDescription("Show the current song name"),
  ],

  async onCommand(interaction, ctx) {
    const guild = interaction.guild!;
    const member = guild.members.cache.get(interaction.user.id);
    const voiceChannel = member?.voice.channel as VoiceChannel | null;

    if (interaction.commandName === "play") {
      if (!voiceChannel) {
        await interaction.reply({ content: "❌ Join a voice channel first.", ephemeral: true });
        return;
      }
      await interaction.deferReply();
      const query = interaction.options.getString("query", true);
      const result = await searchYouTube(query);
      if (!result) {
        await interaction.editReply("❌ Couldn't find that song.");
        return;
      }

      let connection = getVoiceConnection(guild.id);
      if (!connection) {
        connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: guild.id,
          adapterCreator: guild.voiceAdapterCreator as any,
        });
      }

      const queue = queues.get(guild.id) ?? [];
      queue.push({ ...result, requestedBy: interaction.user.username });
      queues.set(guild.id, queue);

      const player = players.get(guild.id);
      if (!player || player.state.status === AudioPlayerStatus.Idle) {
        await playNext(guild.id, ctx);
      }

      await interaction.editReply({
        embeds: [new EmbedBuilder().setTitle("✅ Added to Queue").setDescription(`**${result.title}**`).setColor(0x5865f2)],
      });
    }

    if (interaction.commandName === "skip") {
      const player = players.get(guild.id);
      if (!player) { await interaction.reply({ content: "❌ Nothing playing.", ephemeral: true }); return; }
      player.stop();
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("⏭ Skipped").setColor(0x57f287)] });
    }

    if (interaction.commandName === "stop") {
      const player = players.get(guild.id);
      if (player) { player.stop(); queues.set(guild.id, []); }
      autoRadioGenres.delete(guild.id);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("⏹ Stopped").setDescription("Music stopped.").setColor(0xed4245)] });
    }

    if (interaction.commandName === "pause") {
      const player = players.get(guild.id);
      if (!player) { await interaction.reply({ content: "❌ Nothing playing.", ephemeral: true }); return; }
      if (player.state.status === AudioPlayerStatus.Paused) {
        player.unpause();
        await interaction.reply({ content: "▶️ Resumed." });
      } else {
        player.pause();
        await interaction.reply({ content: "⏸ Paused." });
      }
    }

    if (interaction.commandName === "queue") {
      const queue = queues.get(guild.id) ?? [];
      const embed = new EmbedBuilder().setTitle("🎵 Queue").setColor(0x5865f2);
      if (queue.length === 0) {
        embed.setDescription("Queue is empty.");
      } else {
        embed.setDescription(queue.slice(0, 10).map((t, i) => `\`${i + 1}.\` ${t.title}`).join("\n"));
      }
      await interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === "nowplaying" || interaction.commandName === "songname") {
      const player = players.get(guild.id);
      if (!player || player.state.status !== AudioPlayerStatus.Playing) {
        await interaction.reply({ content: "❌ Nothing is playing.", ephemeral: true });
        return;
      }
      await interaction.reply({ content: "🎵 Music is currently playing." });
    }

    if (interaction.commandName === "volume") {
      await interaction.reply({ content: "🔊 Volume control coming soon.", ephemeral: true });
    }
  },
};

// ── Auto Radio Addon ──
export const autoRadioAddon: Addon = {
  id: "auto-radio",
  name: "Auto Radio by Genre",

  commands: [
    new SlashCommandBuilder()
      .setName("setmusic")
      .setDescription("Start playing a genre non-stop")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((o) => o.setName("genre").setDescription("Music genre e.g. Country, Hip Hop, Rock").setRequired(true)),

    new SlashCommandBuilder()
      .setName("stopmusic")
      .setDescription("Stop the auto radio")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  ],

  async onCommand(interaction, ctx) {
    const guild = interaction.guild!;
    const member = guild.members.cache.get(interaction.user.id);
    const voiceChannel = member?.voice.channel as VoiceChannel | null;

    if (interaction.commandName === "setmusic") {
      if (!voiceChannel) {
        await interaction.reply({ content: "❌ Join a voice channel first.", ephemeral: true });
        return;
      }
      await interaction.deferReply();
      const genre = interaction.options.getString("genre", true);
      autoRadioGenres.set(guild.id, genre);
      queues.set(guild.id, []);

      let connection = getVoiceConnection(guild.id);
      if (!connection) {
        connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: guild.id,
          adapterCreator: guild.voiceAdapterCreator as any,
        });
      }

      await playNext(guild.id, ctx);

      const embed = new EmbedBuilder()
        .setTitle(`🎵 ${genre} Radio Started`)
        .setDescription(`Now playing the greatest **${genre}** songs of all time — forever!`)
        .setColor(0x5865f2);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("radio_skip").setLabel("⏭ Skip").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("radio_stop").setLabel("⏹ Stop").setStyle(ButtonStyle.Danger),
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
    }

    if (interaction.commandName === "stopmusic") {
      autoRadioGenres.delete(guild.id);
      queues.set(guild.id, []);
      const player = players.get(guild.id);
      if (player) player.stop();
      await interaction.reply({ content: "⏹ Auto radio stopped.", ephemeral: true });
    }
  },

  async register(ctx: AddonContext) {
    const { client } = ctx;

    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isButton()) return;
      const guild = interaction.guild;
      if (!guild) return;

      if (interaction.customId === "radio_skip") {
        const player = players.get(guild.id);
        if (player) player.stop();
        await interaction.reply({ content: "⏭ Skipped!", ephemeral: true });
      }

      if (interaction.customId === "radio_stop") {
        autoRadioGenres.delete(guild.id);
        queues.set(guild.id, []);
        const player = players.get(guild.id);
        if (player) player.stop();
        await interaction.reply({ content: "⏹ Radio stopped.", ephemeral: true });
      }
    });

    await ctx.log("info", "Auto Radio addon registered");
  },
};
