const Discord = require('discord.js');
const jsonfile = require('jsonfile');
const fs = require('fs');

const {prefix, token} = require('./config.json');

const bot = new Discord.Client();


// DONT KNOW IF SAVING IS NEEDED AS WHITELISTS WILL BE PULLED AT RUNTIME
// Limits how often saves can happen to avoid abuse
function scheduleSave(){
    if(saved){
        setTimeout(save, minumumSaveInterval);
        saved = false;
    }
}

// Saves the whitelist
function save(){
    jsonfile.writeFile("./whitelist.json", whiteListedApps, { spaces: 2, EOL: '\r\n' }, function(err){
        if (err) throw(err);
    })
    console.log("Whitelist file saved.")
    saved = true;
}
// -------------------------------------------------------------------------------------------

// Ran when the bot is ready on the server.
bot.on('ready', () => {
    console.log("Bot online.")
});

// Called when bot is added to a new server.
bot.on('guildCreate', async(guild) => {
    console.log("Bot was added to a new server.")
    var ServerWhitelistFilePath = "./ServerWhitelists/"+guild.id+".json";
    await InitialiseNewServer(ServerWhitelistFilePath, guild);

    // Check to see if the server's whitelist exists. (This is basically a check to see if the bot has been added to this server before)
    var ServerWhitelistFilePath = "./ServerWhitelists/"+guild.id+".json";
    if (!fs.existsSync(ServerWhitelistFilePath)){
        await InitialiseNewServer(ServerWhitelistFilePath, guild);
    }
});

// Called when bot is removed from a server.
bot.on('guildDelete', async(guild) => {
    console.log("Bot was removed from a server.")
    // Delete the server from records.
    var ServerWhitelistFilePath = "./ServerWhitelists/"+guild.id+".json";
    fs.unlink(ServerWhitelistFilePath, function(err) {
        if (err) throw err;
    console.log(guild.name + " whitelist removed.")
    })
});

// When a user's presence updates.
bot.on('presenceUpdate', async(oldMember, newMember) => {
    if(oldMember.presence.game !== newMember.presence.game){
        // Return if presence is spotify or if member is a bot or if the presence is now nothing.
        //if(newMember.presence.game == "Spotify" || !newMember.bot || newMember.presence == null){ return; }
        console.log(newMember.displayName+"'s presence changed.");
        console.log(newMember.guild.name+" - "+newMember.guild.id);

        var serverWhitelist = require("./ServerWhitelists/"+newMember.guild.id+".json");

        /* // Check to see if the server's whitelist exists
        var ServerWhitelistFilePath = "./ServerWhitelists/"+newMember.guild.id+".json";
        if (!fs.existsSync(ServerWhitelistFilePath)){
            await InitialiseNewServer(ServerWhitelistFilePath, newMember);
        }else{
            // Server whitelist exists.
            var serverWhitelist = require(ServerWhitelistFilePath);
        } */
        
        // Check to see if the whitelist is empty.. if it is just return...


        //var serverWhitelist = require("./ServerWhitelists/"+newMember.guild.id+".json")



        // Is it in the whitelist?
        // Create the role
        // Create the categories if the admin says thats ok.

        
    }
});

// When a message is sent to the server.
bot.on('message', message=>{
    console.log("A message was sent in the server.")
})

// Functions below ---

// Create role and create voice and text channels for it. (May want to seperate this into two seperate functions. One for creating role and another for creating the text and voice stuff.)
function CreateRoleTextVoiceChannel(){

}

async function InitialiseNewServer(ServerWhitelistFilePath, guild){
    var emptyObj = {}
    jsonfile.writeFile(ServerWhitelistFilePath, emptyObj, function(err){
        if(err) throw(err);
    });
    var serverNameContent = guild.name + " - " + guild.id+"\n"
    fs.appendFile('ListOfServers.txt', serverNameContent, function (err) {
        if (err) throw err;

    console.log("Added server: "+ guild.name +" to records.");
    })
}

bot.login(token);