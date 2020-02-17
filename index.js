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
    OnJoinMessageSend(guild);
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

        let serverWhitelist = require("./ServerWhitelists/"+newMember.guild.id+".json");
        let gameUserIsPlaying = newMember.presence.game.name;
        roleFromWhitelist = serverWhitelist[gameUserIsPlaying];
        let roleSearchByID = newMember.guild.roles.find(x => x.id == roleFromWhitelist);
        var roleToAddToMember;

        let serverSettings = require(`./ServerSettings/${newMember.guild.id}.json`)
        
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
                roleToAddToMember = await newMember.guild.createRole({name:roleFromWhitelist, mentionable:true});
                console.log(`Created ${roleToAddToMember.name} role.`);
            }else{
                roleToAddToMember = roleSearchByName;
            }
        }

        // If the member already has the role, return out. This is done inside a try so the code doesnt error in console.
        try{
            if(newMember.roles.has(roleToAddToMember)){return;}
        }catch{}
        
        // Give the member the role.
        await newMember.addRole(roleToAddToMember);

        console.log(`Added role: ${roleToAddToMember.name} to ${newMember.displayName}.`);

        // if admin has catgegory creation on then create the role category here, based on the game.

        if (!serverSettings.createcategory){console.log("Dont create categories"); return;}

        CreateRoleTextVoiceChannel(newMember, roleToAddToMember)
    }
});

// When a message is sent to the server.
bot.on('message', async(message) => {
    if (message.author.bot){return;}

    let args = message.content.split(" ");

    switch(args[0]){
        case '!gmtest':
            message.channel.send("Bot is running!");
            break;

        case '!gmadd':
            // User only entered 'add' as a command and nothing else.
            if (args.length == 1){
                message.reply("Incorrect use of the command. Please use the add command in the form !gmadd [Game Name] [Role Name]. Use @RoleName if the role already exists on the server, or no @ if it doesnt exist.");
                return;
            }
            // Use case: !gm ['Game Name'] ['RoleName' OR @roleName]

            // Does user have manage roles permission?
            if (message.member.hasPermission(['MANAGE_ROLES'])){
                var roleToAdd;
                var roleName;
                if (message.mentions.roles.first()){
                    roleToAdd = message.mentions.roles.first().id;
                    roleName = message.mentions.roles.first().name;
                    args.pop();
                }
                else{
                    roleToAdd = args.pop();
                    roleName = roleToAdd;
                }
                var gameName = args.slice(1,args.length).join(" ").toString();

                AddRoleToWhitelist(message,gameName,roleName,roleToAdd);

            }else{ message.reply("You do not have permission to use that command."); }

            break;

        case '!gmaddmygame':
            if (args.length == 1){
                message.reply("Incorrect use of the command. Please use the addmygame command in the form !addmygame [Desired Role].");
                return;
            }

            // If the author of the command is not playing a game.
            if (!message.author.presence.game){message.reply("You are not playing a game.");}

            if (message.member.hasPermission(['MANAGE_ROLES'])){
                var roleToAdd;
                var roleName;
                if (message.mentions.roles.first()){
                    roleToAdd = message.mentions.roles.first().id;
                    roleName = message.mentions.roles.first().name;
                    args.pop();
                }
                else{
                    roleToAdd = args.pop();
                    roleName = roleToAdd;
                }
                var gameName = args.slice(1,args.length).join(" ").toString();

                AddRoleToWhitelist(message, message.author.presence.game.name, roleName, roleToAdd);

            }else{ message.reply("You do not have permission to use that command."); }

            break;

        case '!gmdelete':
            //message.reply("Delete a game and role not implemented yet.")
            
            if (args.length == 1){
                message.reply("Incorrect use of the command. Please use the addmygame command in the form !gmdelete [Game] [Role].");
                return;
            }

            var roleToRemove;
            var roleName;
            if (message.mentions.roles.first()){
                roleToRemove = message.mentions.roles.first().id;
                roleName = message.mentions.roles.first().name;
                args.pop();
            }
            else{
                roleToRemove = args.pop();
                roleName = roleToRemove;
            }

            var gameToDelete = args.slice(1,args.length).join(" ").toString();
            var serverWhitelistPath = `./ServerWhitelists/${message.guild.id}.json`;
            var serverWhitelist = require(serverWhitelistPath);

            // Delete from the whitelist.
            delete serverWhitelist[gameToDelete];

            // Rewrite the updated whitelist to it's file.
            UpdateJsonFile(serverWhitelistPath, serverWhitelist);

            message.channel.send(`**${gameToDelete}** with role **${roleName}** deleted`)

            break;

        case '!gmgames':
            message.reply("Games list not implemented yet.")
            break;

        case '!gmsettings':
            if (args.length == 1){
                message.reply("Incorrect use of the command. Please use the add command in the form !gmsettings [Setting to change] [On/Off].");
                return;
            }
            // Use case: !gmsettings [Setting to change] [On/Off]

            var newSettingValue = args.pop().toLowerCase();
            var settingToChange = args.pop().toLowerCase();

            if (newSettingValue != "on" && newSettingValue != "off"){message.reply("Please use ON or OFF for a new setting value.")}

            if (settingToChange == "createcategory"){
                // Does the user have the manage channels permission?
                if (message.member.hasPermission(['MANAGE_CHANNELS'])){
                    ChangeSetting(settingToChange, newSettingValue, message);
                    message.channel.send("Setting changed.");
                }
            }else{
                message.reply(`Invalid use of the command. ${settingToChange} is not a setting that can be changed.`)
            }
            break;

        case '!gmhelp':
            message.reply("Help has not been implemented yet. Coming soon.")
            break;
    }
});

// ------ Functions below ------

async function AddRoleToWhitelist(message,gameName,roleName,roleToAdd){
    var guild = message.guild;
    var serverWhitelistFilePath = "./ServerWhitelists/"+guild.id+".json";
    var whiteListJson = await require(serverWhitelistFilePath);

    whiteListJson[gameName] = roleToAdd;

    UpdateJsonFile(serverWhitelistFilePath, whiteListJson);

    message.channel.send(`**${gameName}** added to whitelist with role: **${roleName}**`);
    console.log("Added game to whitelist.");
}

async function ChangeSetting(settingToChange, newSettingValue, message){
    var newValue;
    if (newSettingValue == "on"){newValue = true;}
    else if(newSettingValue == "off"){
        newValue = false;
    }

    var serverSettingsPath = `./ServerSettings/${message.member.guild.id}.json`
    var serverSettings = await require(serverSettingsPath);
    serverSettings[settingToChange] = newValue;

    UpdateJsonFile(serverSettingsPath, serverSettings);
}

async function OnJoinMessageSend(guild){
    let messageContent = `
    Hello! :smile:
    Salazhar (this bot's creator) thanks you for adding **${botName}** to ***${guild.name}***!
    Should you need help using the bot type !gmhelp in your server.
    Before the bot is fully working there are a few settings it needs to confirm with you first.

    1.  Would you like the bot to create categories and channels for each game it assigns roles for?
        As an example when a user begins playing Battlefield 5 for example, the bot will create a new Category in your server called "Battlefield 5" which will contain both a text and voice channel for Battlefield 5.
        This means that only users with the Battlefield 5 role (people who play Battlefield 5) will see this category.
        The category will be named after the game and not the role.
    
    If you would like this setting on for your server. Please type "!gmsettings CreateCategory On" in your server.
    This setting can be turned off at any time using "!gmsettings CreateCategory Off"
    By default this setting is OFF.`

    // Send the message to the server owner.
    guild.owner.send(messageContent);

    console.log(`Owner of ${guild.name} has been messaged.`)
}

// Create role and create voice and text channels for it. (May want to seperate this into two seperate functions. One for creating role and another for creating the text and voice stuff.)
async function CreateRoleTextVoiceChannel(newMember, roleToAddToMember){
    var gameUserIsPlaying = newMember.presence.game.name
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
}

async function InitialiseNewServer(ServerWhitelistFilePath, guild){
    var emptyObj = {}
    UpdateJsonFile(ServerWhitelistFilePath, emptyObj);

    var listOfServersJSON = "./ListOfServers.json";
    var newServerObj = require(listOfServersJSON);
    
    newServerObj[guild.name] = guild.id;

    UpdateJsonFile(listOfServersJSON, newServerObj);

    // Setup new server settings
    var newServerSettingsObj = {"OwnerID": guild.owner.id, "createcategory": false};

    var serverSettingsPath = "./ServerSettings/"+guild.id+".json";

    UpdateJsonFile(serverSettingsPath, newServerSettingsObj)

    console.log("Added server: "+ guild.name +" to records.");  
}

async function DeleteServerRecords(guild){
    var serverWhitelistFilePath = "./ServerWhitelists/"+guild.id+".json";
    var serverSettingsPath = `./ServerSettings/${guild.id}.json`;

    // Delete the whitelist used by the server.
    fs.unlink(serverWhitelistFilePath, function(err) {
        if (err) throw err;
    console.log(`${guild.name}whitelist removed.`);
    });

    // Delete the settings used by the server.
    fs.unlink(serverSettingsPath, function(err) {
        if (err) throw err;
    console.log(`${guild.name} settings removed.`);
    });

    var listOfServersJSON = "./ListOfServers.json";
    var newServerObj = require(listOfServersJSON);
    
    // Delete the server from the ListOfServers.json file.
    delete newServerObj[guild.name];

    UpdateJsonFile(listOfServersJSON, newServerObj);
}

// Update the presence to display total servers the bot is in.
async function UpdatePresence(){
    bot.user.setPresence({ game: { name: "!gmhelp - Adding Roles In "+bot.guilds.size+" Servers!", type: 0 } });
}

async function UpdateJsonFile(filePath, content){
    await jsonfile.writeFile(filePath, content, { spaces: 2, EOL: '\r\n' }, function(err){
        if(err) throw(err);
    });
}

bot.login(token);