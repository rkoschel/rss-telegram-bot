/**
 * https://github.com/mullwar/telebot
 * https://www.npmjs.com/package/rss-parser
 */

const fs = require('fs');
const TeleBot = require('telebot');
const rssParser = require('rss-parser');

const rss = new rssParser();

const CONFIG_FILE = './app.config';
const CHATID_FILE = './chat.ids';
const MESSAGE_FILE = './message.latest'

var bot;
var appConfig;
var latestMessage;
var allChatIds = new Array();

function alreadyKnown(chatId) {
    let wasNew = false;
    for (let i = 0; i < allChatIds.length; i++) {
        console.log('check: ' + allChatIds[i] + '===' + chatId);
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

function initTelegram(){
    bot = new TeleBot(appConfig.telegramBotId);
    bot.on('/start', handleStart);
    bot.on('/stop', handleStop);
    console.log('Telegram bot initialized');
}

function handleStart(msg) {
    let curChatId = msg.from.id;
        if(!alreadyKnown(curChatId)) {
            allChatIds.push(msg.from.id);
            fs.writeFileSync(CHATID_FILE, allChatIds.join('\n'));
            console.log(curChatId + ' added');
        }
        bot.sendMessage(curChatId, appConfig.startMessage);
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
    console.log(curChatId + ' removed');
    bot.sendMessage(curChatId, appConfig.stopMessage);
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
        console.log(nowAsString() + ' # send new message to ' + allChatIds.length + ' chats');
        allChatIds.forEach(id => {
            bot.sendMessage(id, latestMessage);
        });
    }
    else {
        console.log(nowAsString() + ' # nothing new to send');
    }
}

function initChats() {
    try {
        if(fs.existsSync(CHATID_FILE)){
            let file_descriptor = fs.openSync(CHATID_FILE);
            allChatIds = fs.readFileSync(file_descriptor, 'utf8').split('\n');
            fs.close(file_descriptor, (err) => {(err!=null)?console.log(err):''});
        }
        console.log('read ' + allChatIds.length + ' subscribers');
        bot.sendMessage(appConfig.adminChatId, 'restarted with ' + allChatIds.length + ' subscribers', {notification:false});
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
    initTelegram();
    initChats();
    initRss();
    bot.start();
}
