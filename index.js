const Discord = require('discord.js');
const jsonfile = require('jsonfile');
const fs = require('fs-extra');

const {prefix, token, botName} = require('./config.json');

const bot = new Discord.Client();


// ----------------------------------------

// Ran when the bot is ready on the server.
bot.on('ready', async() => {
    console.log("Bot online.");
    UpdatePresence();
});

// Called when bot is added to a new server.
bot.on('guildCreate', async(guild) => {
    console.log("Bot was added to a new server.")

    // Check to see if the server's folder exists. (This is basically a check to see if the bot has been added to this server before)
    var serverDir = `./Servers/${guild.id}`;
    if (!fs.existsSync(serverDir)){
        fs.mkdirSync(serverDir);
        fs.mkdirSync(`${serverDir}/statistics`);
        
        await InitialiseNewServer(guild);

        console.log("Created new server directory.");
    }

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


// --------------------------------------
//
//            PRESENCE UPDATE
//
// --------------------------------------

// When a user's presence updates.
bot.on('presenceUpdate', async(oldMember, newMember) => {
    // Ensure the members game has changed (some games auto update presence (game doesnt change))
    if(oldMember.presence.game != newMember.presence.game){
        // Return out if member is a bot..
        if(newMember.user.bot){ return; }

        // Record new game open (ignores whitelist).
        GameRecording(oldMember,newMember);

        // Recording done, if presence is nothing or spotify now, then just return out.
        if(newMember.presence.game == null || (newMember.presence.game == "Spotify")){return;}

        let gameNameUserIsPlaying = newMember.presence.game.name;
        var serverStatisticsFilePath = GetTotalStatsFilePath(newMember.guild);
        let temp = GetWhitelistFilePath(newMember.guild);
        let serverWhitelist = require(temp);

        // Is the game the user is playing in the whitelist? If it isn't do not continue.
        if (!(gameNameUserIsPlaying in serverWhitelist)){ return; }

        roleFromWhitelist = serverWhitelist[gameNameUserIsPlaying];
        let roleSearchByID = newMember.guild.roles.find(x => x.id == roleFromWhitelist);
        var roleToAddToMember;

        let serverSettings = require(GetSettingsFilePath(newMember.guild));

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
            if(newMember.roles.has(roleToAddToMember.id)){return;}
        }catch{}

        // Give the member the role.
        await newMember.addRole(roleToAddToMember);
        RecordRoleAdd(roleToAddToMember,serverStatisticsFilePath);
        //-- TRACK EVENT

        console.log(`Added ROLE: ${roleToAddToMember.name} | Member: ${newMember.displayName} | Server: ${newMember.guild.name}.`);

        // if admin has catgegory creation on then create the role category here, based on the game.

        if (!serverSettings.createcategory){console.log("Dont create categories"); return;}

        CreateRoleTextVoiceChannel(newMember, roleToAddToMember);
    }
});



// --------------------------------------
//
//              COMMANDS
//
// --------------------------------------


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
            var serverWhitelistPath = GetWhitelistFilePath(message.guild);
            var serverWhitelist = require(serverWhitelistPath);

            // Delete from the whitelist.
            delete serverWhitelist[gameToDelete];

            // Rewrite the updated whitelist to it's file.
            UpdateJsonFile(serverWhitelistPath, serverWhitelist);

            message.channel.send(`**${gameToDelete}** with role **${roleName}** deleted`);

            break;

        case '!gmgames':
            message.reply("Games list not implemented yet.");
            break;

        // STATISTICS RELATED COMMANDS...
        case '!gmstats':
            // Use case either !gmstats for page 1 || !gmstats [Desired Page]
            var returnedData;
            var page;
            if(args[1]){
                // user chose a page
                console.log(`Desired Page: ${args[1]}`);
                page = args[1];
                returnedData = GetServerStats(message.guild,page,"total");
            }else{
                page = 1;
                returnedData = GetServerStats(message.guild,1,"total");
            }
            
            var serverStats = returnedData[0];
            var totalStatsPages = returnedData[1];

            // Page number displayed in text on Discord cannot be more than the total pages.
            if (page > totalStatsPages){
                page = totalStatsPages;
            }

            SendStatsToServer(message,serverStats,totalStatsPages,page,"total");
            break;

        case '!gmstatsday':
            // Send the stats for the current day
            var returnedData;
            var page;

            if(args[1]){
                // user chose a page
                console.log(`Desired Page: ${args[1]}`);
                page = args[1];
                returnedData = GetServerStats(message.guild,page,"day");
            }else{
                page = 1;
                returnedData = GetServerStats(message.guild,1,"day");
            }
            
            var serverStats = returnedData[0];
            var totalStatsPages = returnedData[1];

            // Page number displayed in text on Discord cannot be more than the total pages.
            if (page > totalStatsPages){
                page = totalStatsPages;
            }

            SendStatsToServer(message,serverStats,totalStatsPages,page,"day");
            break;

        case '!gmstatsweek':
            // Send the stats for the current day
            var returnedData;
            var page;

            if(args[1]){
                // user chose a page
                console.log(`Desired Page: ${args[1]}`);
                page = args[1];
                returnedData = GetServerStats(message.guild,page,"week");
            }else{
                page = 1;
                returnedData = GetServerStats(message.guild,1,"week");
            }
            
            var serverStats = returnedData[0];
            var totalStatsPages = returnedData[1];

            // Page number displayed in text on Discord cannot be more than the total pages.
            if (page > totalStatsPages){
                page = totalStatsPages;
            }

            SendStatsToServer(message,serverStats,totalStatsPages,page,"week");
            break;

        case '!gmstatsmonth':
            // Send the stats for the current day
            var returnedData;
            var page;

            if(args[1]){
                // user chose a page
                console.log(`Desired Page: ${args[1]}`);
                page = args[1];
                returnedData = GetServerStats(message.guild,page,"month");
            }else{
                page = 1;
                returnedData = GetServerStats(message.guild,1,"month");
            }
            
            var serverStats = returnedData[0];
            var totalStatsPages = returnedData[1];

            // Page number displayed in text on Discord cannot be more than the total pages.
            if (page > totalStatsPages){
                page = totalStatsPages;
            }

            SendStatsToServer(message,serverStats,totalStatsPages,page,"month");
            break;

        // Commands for settings
        case '!gmsettings':
            if (args.length == 1){
                message.reply("Incorrect use of the command. Please use the add command in the form !gmsettings [Setting to change] [On/Off].");
                return;
            }
            // Use case: !gmsettings [Setting to change] [On/Off]

            var newSettingValue = args.pop();
            var settingToChange = args.pop();

            if (newSettingValue.toLowerCase() != "on" && newSettingValue.toLowerCase() != "off"){message.reply("Please use ON or OFF for a new setting value.")}

            if (settingToChange == "createcategory"){
                // Does the user have the manage channels permission?
                if (message.member.hasPermission(['MANAGE_CHANNELS'])){
                    UpdateSetting(settingToChange, newSettingValue, message);
                    message.channel.send(`**${settingToChange}** turned **${newSettingValue}**.`);
                }
            }else{
                message.reply(`Invalid use of the command. ${settingToChange} is not a setting that can be changed.`);
            }
            break;


        // Commands for help
        case '!gmhelp':
            message.reply("Help has not been implemented yet. Coming soon.");
            break;
    }
});

// --------------------------------------
//
//              FUNCTIONS
//
// --------------------------------------

async function AddRoleToWhitelist(message,gameName,roleName,roleToAdd){
    var guild = message.guild;
    var serverWhitelistFilePath = GetWhitelistFilePath(guild);
    var whiteListJson = await require(serverWhitelistFilePath);

    whiteListJson[gameName] = roleToAdd;
    //whiteListJson[message.author.id] = {"dateGameOpen": Date.now(), "gameName": message.author.presence.game.name};

    UpdateJsonFile(serverWhitelistFilePath, whiteListJson);

    message.channel.send(`**${gameName}** added to whitelist with role: **${roleName}**`);
    console.log("Added game to whitelist.");
}

async function UpdateSetting(settingToChange, newSettingValue, message){
    var newValue;
    if (newSettingValue == "on"){newValue = true;}
    else if(newSettingValue == "off"){
        newValue = false;
    }

    //var serverSettingsPath = `./ServerSettings/${message.member.guild.id}.json`;
    var serverSettingsPath = GetSettingsFilePath(message.guild);
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
    By default this setting is OFF.`;

    // Send the message to the server owner.
    guild.owner.send(messageContent);

    console.log(`Owner of ${guild.name} has been messaged.`);
}

// Create role and create voice and text channels for it. (May want to seperate this into two seperate functions. One for creating role and another for creating the text and voice stuff.)
async function CreateRoleTextVoiceChannel(newMember, roleToAddToMember){
    var gameNameUserIsPlaying = newMember.presence.game.name;
    // Does the category we are going to create already exist?
    if(newMember.guild.channels.find(x => x.name == gameNameUserIsPlaying)){ return; }

    // Create category.
    var newCategory = await newMember.guild.createChannel(gameNameUserIsPlaying, {type: "category"});
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
    var newVoiceChannel = await newMember.guild.createChannel(`${gameNameUserIsPlaying} Voice`, {type: "voice"});
    await newVoiceChannel.setParent(newCategory);
    await newVoiceChannel.lockPermissions();

    // Create text channel for game.
    var newtTextChannel = await newMember.guild.createChannel(`${gameNameUserIsPlaying} Text`, {type: "text"});
    await newtTextChannel.setParent(newCategory);
    await newtTextChannel.lockPermissions();

    console.log("Created category and channel.")
}

async function InitialiseNewServer(guild){

    // Setting up new server's whitelist.
    var emptyObj = {};
    var ServerWhitelistFilePath = GetWhitelistFilePath(guild);
    UpdateJsonFile(ServerWhitelistFilePath, emptyObj);

    // Setup new server's settings.
    var newServerSettingsObj = {"OwnerID": guild.owner.id, "createcategory": false};
    var serverSettingsPath = GetSettingsFilePath(guild);
    UpdateJsonFile(serverSettingsPath, newServerSettingsObj);

    // Setup new server's statistics.
    var obj = {"Total Minutes Played":{},
                "Number of times roles added to users":{}
                }
    var serverTotalStatisticsFilePath = GetTotalStatsFilePath(guild);
    UpdateJsonFile(serverTotalStatisticsFilePath, obj);

    // Setup Day Stats
    var serverDayStatsFilePath = GetDayStatsFilePath(guild);
    UpdateJsonFile(serverDayStatsFilePath, obj);

    // Setup Week Stats
    var serverWeekStatsFilePath = GetWeekStatsFilePath(guild);
    UpdateJsonFile(serverWeekStatsFilePath, obj);

    // Setup Month Stats
    var serverMonthStatsFilePath = GetMonthStatsFilePath(guild);
    UpdateJsonFile(serverMonthStatsFilePath, obj);

    // Setup new server's temp record file system.
    var obj = {};
    var serverTempRecordFilePath = GetTempRecordFilePath(guild);
    UpdateJsonFile(serverTempRecordFilePath, obj);

    // Add new server to list of servers.
    var listOfServersJSON = "./ListOfServers.json";
    var newServerObj = require(listOfServersJSON);
    newServerObj[guild.name] = guild.id;
    UpdateJsonFile(listOfServersJSON, newServerObj);

    console.log("Added server: "+ guild.name +" to records.");  
}

async function DeleteServerRecords(guild){
    // Delete the server's folder.
    var ServersFolder = `./Servers/${guild.id}`;
    fs.remove(ServersFolder, err => {
        if (err) return console.error(err);
        console.log("Deleted server's records.");
      });

    var listOfServersJSON = "./ListOfServers.json";
    var newServerObj = require(listOfServersJSON);
    
    // Delete the server from the ListOfServers.json file.
    delete newServerObj[guild.name];

    UpdateJsonFile(listOfServersJSON, newServerObj);
}

// --------------------------------------
//
//       STATISTIC TRACKING FUNCTIONS / SYSTEM
//
// --------------------------------------

async function RecordRoleAdd(role,serverStatisticsFilePath){
    console.log(`Record new role addition with role: ${role.name}`);
    var statsFile = require(serverStatisticsFilePath);

    let roleName = role.name;

    statsFile["Number of times roles added to users"][roleName] = 1;

    UpdateJsonFile(serverStatisticsFilePath, statsFile);
}

async function GameRecording(oldMember, newMember){
    let serverTempRecordFilePath = GetTempRecordFilePath(newMember.guild);
    tempGameRecord = await require(serverTempRecordFilePath);

    var isUsersGameBeingRecordedAlready;
    try{ isUsersGameBeingRecordedAlready = newMember.presence.game.name in tempGameRecord[newMember.id]["gameName"];
    }catch{ isUsersGameBeingRecordedAlready = false; }

    if (newMember.id in tempGameRecord && !isUsersGameBeingRecordedAlready){
        // Perma save the content in the temp file to user's server's stats.
        await PermaRecordUserStats(tempGameRecord, serverTempRecordFilePath, newMember);
    }
    // If the member's presence is now nothing, return out.
    if (newMember.presence.game == null){return;}
    // Start recording the new game
    await StartNewGameRecording(newMember);
}

async function PermaRecordUserStats(tempGameRecord, serverTempRecordFilePath, newMember){
    let whenGameOpened = tempGameRecord[newMember.id]["dateGameOpen"];
    let gameName = tempGameRecord[newMember.id]["gameName"];
    let totalTimeOpenFor = (Date.now() - whenGameOpened) / 60000;
    console.log(`SAVE RECORD: ${newMember.displayName} | Game: ${tempGameRecord[newMember.id]["gameName"]} | Server: ${newMember.guild.name} | Minutes open for: ${totalTimeOpenFor}`);

    delete tempGameRecord[newMember.id];
    UpdateJsonFile(serverTempRecordFilePath, tempGameRecord);

    // Update full stats
    UpdateFullRecord(newMember,gameName,totalTimeOpenFor);

    // Update day stats
    UpdateDayRecord(newMember,gameName,totalTimeOpenFor);

    // Update week stats
    UpdateWeekRecord(newMember,gameName,totalTimeOpenFor);

    // Update month stats
    UpdateMonthRecord(newMember,gameName,totalTimeOpenFor);
}

async function StartNewGameRecording(newMember){
    let serverTempRecordFilePath = GetTempRecordFilePath(newMember.guild);
    tempGameRecord = await require(serverTempRecordFilePath);

    tempGameRecord[newMember.id] = {"dateGameOpen": Date.now(), "gameName": newMember.presence.game.name};
    UpdateJsonFile(serverTempRecordFilePath, tempGameRecord);
}

function GetServerStats(guild,desiredPage,whichStat){

    var serverStatsFilePath;
    var stats;

    if (whichStat == "total"){
        serverStatsFilePath = GetTotalStatsFilePath(guild);
        stats = require(serverStatsFilePath);

    }else if(whichStat == "day"){
        serverStatsFilePath = GetDayStatsFilePath(guild);
        stats = require(serverStatsFilePath);

    }else if(whichStat == "week"){
        serverStatsFilePath = GetWeekStatsFilePath(guild);
        stats = require(serverStatsFilePath);

    }else if(whichStat == "month"){
        serverStatsFilePath = GetMonthStatsFilePath(guild);
        stats = require(serverStatsFilePath);

    }else{
        console.log("Error which whichStat.");
    }

    

    var itemsPerPage = 15;

    const minStats = stats['Total Minutes Played']

    var labelsArr = [];
    var dataArr = [];
    for (var key in minStats) {
        if (minStats.hasOwnProperty(key)) {
            // Replace spaces in the game name with %20 for spaces in URLs.
            var formattedKey = key.replace(/\s+/g, '%20')
            labelsArr.push(`"${formattedKey}"`);
            dataArr.push(parseInt(minStats[key]));
        }
    }
    // Sort the data and it's labels into accending order.
    ReverseBubbleSort(dataArr,labelsArr);

    let totalPages = Math.ceil(labelsArr.length / itemsPerPage);

    var getContentFrom = (desiredPage-1) * itemsPerPage;
    var getContentTo = desiredPage * itemsPerPage;

    // Remove all content in labelsArr outside of iterations between getContentFrom - getContentTo
    labelsArr.splice(0,getContentFrom);
    labelsArr.splice(getContentTo,(labelsArr.length-getContentTo));

    // Remove all content in dataArr outside of iterations between getContentFrom - getContentTo
    dataArr.splice(0,getContentFrom);
    dataArr.splice(getContentTo,(labelsArr.length-getContentTo));

    // Check to see the top game and if it's more than an hour? If so, is it more than a day? if yes convert all numbers to days
    var values = ConvertDataToBetterUnitOfTime(dataArr)
    dataArr = values[0];
    minHourDay = values[1];

    while (labelsArr.length > itemsPerPage) {
        labelsArr.pop();
        dataArr.pop();
    }

    var chartData = `{type:"bar",data:{labels:[${labelsArr}],datasets:[{label:'${minHourDay}%20Played',data:[${dataArr}]}]}}` 
    var url = `https://quickchart.io/chart?c=${chartData}&bkg=white`;

    const statsEmbeded = new Discord.RichEmbed()
             .setColor(0x00AE86)
             .setImage(url)

    // Return the rich embed containing the stats image.
    return [statsEmbeded,totalPages];
}

function ConvertDataToBetterUnitOfTime(dataArr){
    var minHourDay;

    // Has the most played game been played for more than one hour?
    if((dataArr[0] / 60) > 1){
        
        // Has the most played game been played for more than one day?
        if((dataArr[0] / 1440) > 1){

            // Has the most played game been played for more than a week?
            if((dataArr[0] / 10080) > 1){
                // Convert all times of games to be weeks.
                for (let index = 0; index < dataArr.length; index++) {
                    // Set current iteration to how many weeks the minutes are.
                    dataArr[index] = dataArr[index] / 10080;
                }
                // Set the value for the chart's key.
                minHourDay = 'Weeks';
            }else{
                // Most played game has been played for more than one day but not more than one week.
                
                // Convert all times of games to be days
                for (let index = 0; index < dataArr.length; index++) {
                    // Set current iteration to how many days the minutes are.
                    dataArr[index] = dataArr[index] / 1440;
                }
                // Set the value for the chart's key.
                minHourDay = 'Days'; 
            }  
        }else{
            // Largest time is not more than one day but more than one hour.
            for (let index = 0; index < dataArr.length; index++) {
                // Set current iteration to how many hours the minutes are.
                dataArr[index] = dataArr[index] / 60;
            }
            // Set the value for the chart's key.
            minHourDay = 'Hours'
        }
    }else{
        // Time is NOT more than one hour.
        // Set the value for the chart's key.
        minHourDay = 'Minutes'
        return [dataArr,minHourDay];
    }
    // Return the data for each game and the graph's key.
    return [dataArr,minHourDay];
}

function SendStatsToServer(message,serverStats,totalStatsPages,page,whichStat){
    const leftArrow = "⬅️";
    const rightArrow = "➡️";

    // Send the chart to the server in a richembed.
    message.channel.send(`**${message.guild.name}**'s Presence Stats - Page: ${page}/${totalStatsPages}`, serverStats).then(sentMessage => {
        
        // Show only certain arrows for certain pages.
        //  React with left arrow for page 1.
        //  React with right arrow if on last page.
        //  React with left and right for any other pages.
        
        // If the total pages are 1 or 0 then dont react.
        if (totalStatsPages == 1 || totalStatsPages == 0){
            // pass
        // First page
        }else if (page == 1){
            sentMessage.react(rightArrow);
        // Last page
        }else if (page == totalStatsPages){
            sentMessage.react(leftArrow);
        // Not first or last page.
        }else{
            sentMessage.react(leftArrow).then(() => sentMessage.react(rightArrow));
        }        

        //Define a filter for reactions.
        const filter = (reaction, user) => {
            return [leftArrow, rightArrow].includes(reaction.emoji.name) && user.id === message.author.id;
        };

        // Wait for reactions on the richembed message sent.
        sentMessage.awaitReactions(filter, { max: 1, time: 60000, errors: ['time'] })
        .then(collected => {
            const reaction = collected.first();
            var newPage;

            // If the user reacted with a left arrow (Wanting to move to the previous page)
            if (reaction.emoji.name === leftArrow){
                // Delete the graph rich embed message.
                sentMessage.delete();

                // Send new message containing graph for previous page
                newPage = page - 1;

                const returnedData = GetServerStats(message.guild,newPage,whichStat);
                let serverStats = returnedData[0];
                let totalStatsPages = returnedData[1];

                SendStatsToServer(message,serverStats,totalStatsPages,newPage,whichStat);
            }
            else{
                // Delete the graph rich embed message.
                sentMessage.delete();

                // Send new message containing graph for next page
                newPage = page + 1;

                const returnedData = GetServerStats(message.guild,newPage,whichStat);
                let serverStats = returnedData[0];
                let totalStatsPages = returnedData[1];

                SendStatsToServer(message,serverStats,totalStatsPages,page+1,whichStat);
            }
        });
    });

    return;
}

// Function for updating full record
function UpdateFullRecord(newMember,gameName,totalTimeOpenFor){
    var statsFilePath = GetTotalStatsFilePath(newMember.guild);
    var statsFile = require(statsFilePath);

    // Ternary, if game exists in server's stats then add total time played to what is stored, if it doesnt then assign time played.
    if(gameName in statsFile["Total Minutes Played"]){
        statsFile["Total Minutes Played"][gameName] += totalTimeOpenFor;
    }else{
        statsFile["Total Minutes Played"][gameName] = totalTimeOpenFor;
    }
    UpdateJsonFile(statsFilePath, statsFile);
}
// Function for updating the current day's records
function UpdateDayRecord(newMember,gameName,totalTimeOpenFor){
    var statsFilePath = GetDayStatsFilePath(newMember.guild);
    var statsFile = require(statsFilePath);

    // Ternary, if game exists in server's day stats then add total time played to what is stored, if it doesnt then assign time played.
    if(gameName in statsFile["Total Minutes Played"]){
        statsFile["Total Minutes Played"][gameName] += totalTimeOpenFor;
    }else{
        statsFile["Total Minutes Played"][gameName] = totalTimeOpenFor;
    }
    UpdateJsonFile(statsFilePath, statsFile);
}

// Function for updating the current week's records
function UpdateWeekRecord(newMember,gameName,totalTimeOpenFor){
    var statsFilePath = GetWeekStatsFilePath(newMember.guild);
    var statsFile = require(statsFilePath);

    // Ternary, if game exists in server's week stats then add total time played to what is stored, if it doesnt then assign time played.
    if(gameName in statsFile["Total Minutes Played"]){
        statsFile["Total Minutes Played"][gameName] += totalTimeOpenFor;
    }else{
        statsFile["Total Minutes Played"][gameName] = totalTimeOpenFor;
    }
    UpdateJsonFile(statsFilePath, statsFile);
}

// Function for updating the current months's records
function UpdateMonthRecord(newMember,gameName,totalTimeOpenFor){
    var statsFilePath = GetMonthStatsFilePath(newMember.guild);
    var statsFile = require(statsFilePath);

    // Ternary, if game exists in server's month stats then add total time played to what is stored, if it doesnt then assign time played.
    if(gameName in statsFile["Total Minutes Played"]){
        statsFile["Total Minutes Played"][gameName] += totalTimeOpenFor;
    }else{
        statsFile["Total Minutes Played"][gameName] = totalTimeOpenFor;
    }
    UpdateJsonFile(statsFilePath, statsFile);
}

// Smaller functions -------

// Function for getting a server's total statistics file path.
function GetTotalStatsFilePath(guild){
    return `./Servers/${guild.id}/statistics/TotalStats.json`;
}

// Function for getting a server's day statistics file path.
function GetDayStatsFilePath(guild){
    return `./Servers/${guild.id}/statistics/DayStats.json`;
}

// Function for getting a server's weeks statistics file path.
function GetWeekStatsFilePath(guild){
    return `./Servers/${guild.id}/statistics/WeekStats.json`;
}

// Function for getting a server's month statistics file path.
function GetMonthStatsFilePath(guild){
    return `./Servers/${guild.id}/statistics/MonthStats.json`;
}

// Function for getting a server's settings file path.
function GetSettingsFilePath(guild){
    return `./Servers/${guild.id}/settings.json`;
}

// Function for getting a server's whitelist file path.
function GetWhitelistFilePath(guild){
    return `./Servers/${guild.id}/whitelist.json`;
}

// Function for getting a server's temporary record file path.
function GetTempRecordFilePath(guild){
    return `./Servers/${guild.id}/tempRecord.json`;
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

function ReverseBubbleSort(inputArr,labels){
    let len = inputArr.length;
    for (let i = 0; i < len; i++) {
        for (let j = 0; j < len; j++) {
            if (inputArr[j] < inputArr[j + 1]) {
                let tmp = inputArr[j];
                let tmpLabel = labels[j];

                inputArr[j] = inputArr[j + 1];
                labels[j] = labels[j+1];

                inputArr[j + 1] = tmp;
                labels[j + 1] = tmpLabel;
            }
        }
    }
    return inputArr,labels;
}

/* process.on('unhandledRejection', function (err) {

}); */

bot.login(token);