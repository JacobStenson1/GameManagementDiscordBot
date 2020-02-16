const Discord = require('discord.js');
const jsonfile = require('jsonfile');
const fs = require('fs');

const {prefix, token, botName} = require('./config.json');

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
bot.on('ready', async() => {
    console.log("Bot online.");
    UpdatePresence();
});

// Called when bot is added to a new server.
bot.on('guildCreate', async(guild) => {
    console.log("Bot was added to a new server.")

    // Check to see if the server's whitelist exists. (This is basically a check to see if the bot has been added to this server before)
    var ServerWhitelistFilePath = "./ServerWhitelists/"+guild.id+".json";
    if (!fs.existsSync(ServerWhitelistFilePath)){
        await InitialiseNewServer(ServerWhitelistFilePath, guild);
    }

    //Call OnJoinSettings() function.
    OnJoinSettings(guild);
    UpdatePresence();
});

// Called when bot is removed from a server.
bot.on('guildDelete', async(guild) => {
    console.log("Bot was removed from a server.")
    // Delete all records of the the server.
    DeleteServerRecords(guild);
    UpdatePresence();
});



// When a user's presence updates.
bot.on('presenceUpdate', async(oldMember, newMember) => {
    if(oldMember.presence.game !== newMember.presence.game){
        // Return out if presence is spotify or if member is a bot or if the presence is now nothing.
        if((newMember.presence.game == "Spotify") || (newMember.bot) || (newMember.presence.game == null)){ return; }

        console.log("\n")

        console.log(`${newMember.displayName}'s presence in ${newMember.guild.name} presence changed.`);

        var serverWhitelist = require("./ServerWhitelists/"+newMember.guild.id+".json");
        var gameUserIsPlaying = newMember.presence.game.name;
        roleFromWhitelist = serverWhitelist[gameUserIsPlaying];
        var roleSearchByID = newMember.guild.roles.find(x => x.id == roleFromWhitelist);
        var roleToAddToMember;
        
        console.log(`The game they are now playing is: ${gameUserIsPlaying}`);
        console.log(`Is their game in the server's whitelist? ${gameUserIsPlaying in serverWhitelist}`);

        // Is the game the user is playing in the whitelist?
        if (!(gameUserIsPlaying in serverWhitelist)){ return; }

        // If the search by ID netted results.
        if (roleSearchByID){
            roleToAddToMember = roleSearchByID;
        }else{
            var roleSearchByName = newMember.guild.roles.find(x => x.name == roleFromWhitelist);
            // If search for the role found nothing.
            if (!roleSearchByName){
                console.log(`Can't find ${roleFromWhitelist} role. Adding it to server: ${newMember.guild.name}`)
                // Create the role
                var roleToAddToMember = await newMember.guild.createRole({name:roleFromWhitelist, mentionable:true});
                console.log(`Created ${roleToAddToMember.name} role.`);
            }else{
                roleToAddToMember = roleSearchByName;
            }
        }

        // If the member already has the role, return out. This is done inside a try so the code doesnt error in console.
        try{
            if(newMember.roles.has(roleToAddToMember.id)){return;}
        }catch{}
        
        // Give the member the role.
        newMember.addRole(roleToAddToMember);

        console.log(`Added role: ${roleToAddToMember.name} to ${newMember.displayName}.`);

        // if admin has catgegory creation on then create the role category here, based on the game.

        // Only execute this code in the testing server.
        if(newMember.guild.id == 674598594464186388){
            // Does the category we are going to create already exist?
            if(newMember.guild.channels.find(x => x.name == gameUserIsPlaying)){ return; }

            // Create category.
            var newCategory = await newMember.guild.createChannel(gameUserIsPlaying, {type: "category"});
            // Disallow Everyone to see, join, invite, or speak. Only allow people with the game's role to join.
            newCategory.overwritePermissions(newMember.guild.defaultRole, {
                'CREATE_INSTANT_INVITE' : false,        'VIEW_CHANNEL': false,
                'CONNECT': false,                       'SPEAK': false
            });

            newCategory.overwritePermissions(roleToAddToMember, {
                'CREATE_INSTANT_INVITE' : false,        'VIEW_CHANNEL': true,
                'CONNECT': true,                       'SPEAK': true
            });
            

            // Create voice channel for game.
            var newVoiceChannel = await newMember.guild.createChannel(`${gameUserIsPlaying} Voice`, {type: "voice"});
            await newVoiceChannel.setParent(newCategory);
            await newVoiceChannel.lockPermissions();

            // Create text channel for game.
            var newtTextChannel = await newMember.guild.createChannel(`${gameUserIsPlaying} Text`, {type: "text"});
            await newtTextChannel.setParent(newCategory);
            await newtTextChannel.lockPermissions();

            console.log("Created category and channel.")
            
            console.log(newCategory.name);
        }       
    }
});

// When a message is sent to the server.
bot.on('message', async(message) => {
    if (message.author.bot){return;}

    console.log(message.content);

    let args = message.content.split(" ");
    //args.shift();
    
    /* console.log("here")
    console.log(args) */

    switch(args[0]){
        case '!gmtest':
            message.channel.send("Bot is running!");
            return;
        case '!gmadd':
            // User only entered 'add' as a command and nothing else.
            if (args.length == 1){
                message.reply("Incorrect use of the command. Please use the add command in the form !gm add [Game Name] [Role Name]. Use @RoleName if the role already exists on the server, or no @ if it doesnt exist.");
                return;
            }
            // Use case: !gm ['Game Name'] ['RoleName' OR @roleName]

            // Does user have manage roles permission?
            if (message.member.hasPermission(['MANAGE_ROLES'])){
                AddRoleToWhitelist(message,args);

            }else{ message.reply("You do not have permission to use that command."); }

            return;
        case '!gmhelp':
            message.reply("Help has not been implemented yet. Coming soon.")
    }
})

// Functions below ---

async function AddRoleToWhitelist(message,args){
    var roleToAdd;
    if (message.mentions.roles.first()){
        roleToAdd = message.mentions.roles.first().id;
        args.pop();
    }
    else{
        roleToAdd = args.pop();
    }
    
    
    //console.log(message.mentions.roles.first().name);
    var gameName = args.slice(1,args.length).join(" ").toString();

    var guild = message.guild;
    var serverWhitelistFile = "./ServerWhitelists/"+guild.id+".json";
    var whiteListJson = await require(serverWhitelistFile);

    whiteListJson[gameName] = roleToAdd;

    jsonfile.writeFile(serverWhitelistFile, whiteListJson, { spaces: 2, EOL: '\r\n' }, function(err){
        if(err) throw(err);
    });

    message.reply(gameName+" added to whitelist with role: "+roleToAdd);
    console.log("Added game to whitelist.");
}

function OnJoinSettings(guild){
    let messageContent = `Hello! :smile:
    Salazhar (the bot creator) thanks you for adding **${botName}** to your server!
    Use !gmhelp in your server should you need help with the bot.
    Before the bot is fully working there are a few settings it needs to confirm with you first.

    Would you like the bot to create categories and channels for each game it assigns roles for?
    As an example when a user begins playing Battlefield 5 for example, the bot will create a new Category in your server called "Battlefield 5" which will contain both a text and voice channel for Battlefield 5.
    This means that only users with the Battlefield 5 role (people who play Battlefield 5) will see this category.\n
    Would you like this feature in your server? Reply YES or NO.`

    // Send the message to the server owner.
    guild.owner.send(messageContent);

}

// Create role and create voice and text channels for it. (May want to seperate this into two seperate functions. One for creating role and another for creating the text and voice stuff.)
function CreateRoleTextVoiceChannel(){

}

async function InitialiseNewServer(ServerWhitelistFilePath, guild){
    var emptyObj = {}
    jsonfile.writeFile(ServerWhitelistFilePath, emptyObj, { spaces: 2, EOL: '\r\n' }, function(err){
        if(err) throw(err);
    });

    var listOfServersJSON = "./ListOfServers.json";
    var newServerObj = require(listOfServersJSON);
    
    newServerObj[guild.name] = guild.id;

    jsonfile.writeFile(listOfServersJSON, newServerObj, { spaces: 2, EOL: '\r\n' }, function(err){
        if(err) throw(err);
    });


    console.log("Added server: "+ guild.name +" to records.");  
}

function DeleteServerRecords(guild){
    var ServerWhitelistFilePath = "./ServerWhitelists/"+guild.id+".json";

    // Delete the whitelist used by the server.
    fs.unlink(ServerWhitelistFilePath, function(err) {
        if (err) throw err;
    console.log(guild.name + " whitelist removed.")
    });

    var listOfServersJSON = "./ListOfServers.json";
    var newServerObj = require(listOfServersJSON);
    
    // Delete the server from the ListOfServers.json file.
    delete newServerObj[guild.name];

    jsonfile.writeFile(listOfServersJSON, newServerObj, { spaces: 2, EOL: '\r\n' }, function(err){
        if(err) throw(err);
    });
}

// Update the presence to display total servers the bot is in.
async function UpdatePresence(){
    bot.user.setPresence({ game: { name: "!gmhelp - Adding Roles In "+bot.guilds.size+" Servers!", type: 0 } });
}

bot.login(token);