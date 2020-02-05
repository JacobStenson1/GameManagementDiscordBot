const Discord = require('discord.js');
const {prefix, token} = require('./config.json');

const bot = new Discord.Client();

bot.on('ready',()=>{
    console.log("Bot online.")
});

bot.login(token);