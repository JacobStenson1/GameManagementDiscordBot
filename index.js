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

// When a user's presence updates.
bot.on('presenceUpdate', async(oldMember, newMember) => {
    if(oldMember.presence.game !== newMember.presence.game){
        // Return if presence is spotify or if member is a bot or if the presence is now nothing.
        //if(newMember.presence.game == "Spotify" || !newMember.bot || newMember.presence == null){ return; }
        console.log(newMember.displayName+"'s presence changed.");
        console.log(newMember.guild.name+" - "+newMember.guild.id);

        // Check to see if the server's whitelist exists
        var ServerWhitelistFilePath = "./ServerWhitelists/"+newMember.guild.id+".json";
        if (!fs.existsSync(ServerWhitelistFilePath)){
            await InitialiseNewServer(ServerWhitelistFilePath);
        }else{
            // Server whitelist exists.
            var serverWhitelist = require(ServerWhitelistFilePath);
        }
        
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

// Create role and create voice and text channels for it. (May want to seperate this into two seperate functions. One for creating role and another for creating the text and voice stuff.)
function CreateRoleTextVoiceChannel(){

}

async function InitialiseNewServer(ServerWhitelistFilePath){
    console.log("A new server was added.`")
    var emptyObj = {}
    jsonfile.writeFile(ServerWhitelistFilePath, emptyObj, function(err){
        if(err) throw(err);
    });
}

bot.login(token);