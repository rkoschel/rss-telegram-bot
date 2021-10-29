/**
 * https://github.com/mullwar/telebot
 * https://www.npmjs.com/package/rss-parser
 */

const fs = require('fs');
const TeleBot = require('telebot');
const rssParser = require('rss-parser');

const rss = new rssParser();

const CONFIG_FILE   = './app.config.gwfjt';
const CHATID_FILE   = './chat.ids';
const MESSAGE_FILE  = './message.latest';
const INFO_FILE     = './message.info';

var bot;
var appConfig;
var latestMessage;
var infoMessage;
var allChatIds = new Array();

function alreadyKnown(chatId) {
    let wasNew = false;
    for (let i = 0; i < allChatIds.length; i++) {
        if(allChatIds[i] === chatId)
            return true;
    }
    return false;
}

function cleanupRSSMessage(rssMsg) {
    return rssMsg.split('(')[0];
}

function initConfig() {
    try {
        if(fs.existsSync(CONFIG_FILE)){
            appConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        }
        console.log('config loaded');
    } catch (e) {
        console.log(e);
        console.log("couldn't read config file");
    }
}

function initInfo() {
    try {
        if(fs.existsSync(INFO_FILE)){
            infoMessage = fs.readFileSync(INFO_FILE, 'utf8');
        }
        console.log('info message loaded');
    } catch (e) {
        console.log(e);
        console.log("couldn't read info message file");
    }
}

function initTelegram(){
    bot = new TeleBot(appConfig.telegramBotId);
    bot.on('/start', handleStart);
    bot.on('/stop', handleStop);
    bot.on('/info', handleInfo);
    bot.on('/bible', handleBible);
    bot.on('/comments', handleComments);
    console.log('Telegram bot initialized');
}

function handleStart(msg) {
    let curChatId = msg.from.id;
        if(!alreadyKnown(curChatId)) {
            allChatIds.push(msg.from.id);
            fs.writeFileSync(CHATID_FILE, allChatIds.join('\n'));
        }
        bot.sendMessage(curChatId, appConfig.startMessage);
        bot.sendMessage(curChatId, latestMessage);
}

function handleStop(msg) {
    let curChatId = msg.from.id;
    let allChatIds_NEW = new Array();
    for (let i = 0; i < allChatIds.length; i++) {
        if(allChatIds[i] !== curChatId)
            allChatIds_NEW.push(allChatIds[i]);
    }
    allChatIds = allChatIds_NEW;
    let file_descriptor = fs.openSync(CHATID_FILE);
    fs.writeFileSync(CHATID_FILE, allChatIds.join('\n'));
    fs.close(file_descriptor, (err) => {(err!=null)?console.log(err):''});
    bot.sendMessage(curChatId, appConfig.stopMessage);
}

function handleInfo(msg) {
    let curChatId = msg.from.id;
    bot.sendMessage(curChatId, infoMessage);
}

function handleBible(msg) {
    let curChatId = msg.from.id;
    bot.sendMessage(curChatId, appConfig.bibleMessage);
}

function handleComments(msg) {
    let curChatId = msg.from.id;
    bot.sendMessage(curChatId, appConfig.commentsMessage);
}

function initRss(){
    readAndSendRssFeed();
    setInterval(readAndSendRssFeed, 1000*60*appConfig.rssIntervalMinutes);
    console.log('rss initialized');
}

async function readAndSendRssFeed() {
    try {
        latestMessage = fs.readFileSync(MESSAGE_FILE, 'utf8');
    } catch(e) {}
    
    let feed = await rss.parseURL(appConfig.rssURL);
    let currentItem = feed.items[0];
    let newMessage = currentItem.title + '\n' + cleanupRSSMessage(currentItem.content);
    if(latestMessage !== newMessage) {
        latestMessage = newMessage;
        fs.writeFileSync(MESSAGE_FILE, latestMessage);
        console.log(nowAsString() + ' # send new message to ' + (allChatIds.length - 1) + ' chats');
        allChatIds.forEach(id => {
            if(id !== '--dummy--do-not-remove--') {
                bot.sendMessage(id, latestMessage);
            }
        });
    }
    else {
        console.log(nowAsString() + ' # nothing new to send');
    }
}

function initChats() {
    try {
        if(fs.existsSync(CHATID_FILE)){
            allChatIds = fs.readFileSync(CHATID_FILE, 'utf8').split('\n');
        }
        console.log('read ' + (allChatIds.length - 1) + ' subscribers');
        bot.sendMessage(appConfig.adminChatId, 'restarted with ' + (allChatIds.length - 1) + ' subscribers', {notification:false});
    } catch (e) {
        console.log(e);
        console.log("couldn't read subscribers");
        bot.sendMessage(appConfig.adminChatId, "restart couldn't read subscribers", {notification:false});
    }
}

function nowAsString() {
    let date_ob = new Date();
    let date = ("0" + date_ob.getDate()).slice(-2);
    let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
    let year = date_ob.getFullYear();
    let hours = date_ob.getHours();
    let minutes = date_ob.getMinutes();
    let seconds = date_ob.getSeconds();
    return year + "-" + month + "-" + date + " " + hours + ":" + minutes + ":" + seconds;
}


/* main process */
if (require.main === module) {
    initConfig();
    initInfo();
    initTelegram();
    initChats();
    initRss();
    bot.start();
}
