const Discord = require('discord.js');
const {prefix, token} = require('./config.json');

const bot = new Discord.Client();

bot.on('ready', () => {
    console.log("Bot online.")
});

// When a message is sent to the server.
bot.on('message', () => {
    console.log("Message was sent.");
});

// When a user's presence updates.
bot.on('presenceUpdate', async(oldMember, newMember) => {
    if(oldMember.presence.game !== newMember.presence.game){
        console.log(newMember.displayName+"'s presence changed.")
    }
});

// Create role and create voice and text channels for it. (May want to seperate this into two seperate functions. One for creating role and another for creating the text and voice stuff.)
function CreateRoleTextVoiceChannel(){

}


bot.login(token);