#!/usr/bin/env node

const {program} = require('commander');
const path = require('path');
const fs = require('fs');
const robot = require("robotjs");
const {openStreamDeck, listStreamDecks} = require('elgato-stream-deck');
const DeckManager = require('./lib/deckManager');
let config;
let devInfo;

program
	.version(require('./package.json').version)
	.option('-c, --config <file>', 'Configuration file to use.', path.join(process.env.HOME, '.deckxstream.json'))
	.option('-l, --list', 'Show all detected Stream Decks and exit')
	.option('-i, --init [device]', 'Output an initial JSON file for the specified device if supplied')
	.option('-k, --keys [device]', 'Outputs the keyIndex values to each button on the specified Stream Deck (or first found) and exits')

program.parse(process.argv);

const options = program.opts();

robot.setKeyboardDelay(1);

const devices = listStreamDecks();

if ( devices.length === 0 ) exitError('No Steam Decks found! Have you followed the instructions for elgato-stream-deck?');

if ( options.list ) {
	console.log(devices);
	process.exit(0);	
}

if ( options.init || options.keys ) {
	devInfo = getDevice(options.init || options.keys);
} else if ( options.config ) {
	if ( !fs.existsSync(options.config) ) exitError(`Specified config ${options.config} does not exist!`);
	config = require(options.config);
	devInfo = getDevice(config.device);
}

const streamDeck = openStreamDeck(devInfo.path);

if ( options.keys || options.init ) {
	config = {
		"deckxstream-version": 1,
		"brightness": 90,
		"device": devInfo.serialNumber,
		"pages": [
			{
				"page_name": "default",
				"buttons": new Array(streamDeck.NUM_KEYS).fill(undefined).map((v,i)=>{
					return {keyIndex: i, text: i.toString()};
				})
			}
		]
	}
} 

if ( options.init ) {
	console.log(JSON.stringify(config,null,2));
	process.exit(0);
}

if ( options.keys ) {
	setTimeout(process.exit, 2000);
}

const buttons = new Array(streamDeck.NUM_KEYS);
const deckMgr = new DeckManager(streamDeck, buttons, config);
let ssTimer;
let ssActive = false;

streamDeck.clearAllKeys();
streamDeck.setBrightness(config.brightness || 90);

if ( config.screensaver ) {
	ssTimer = checkScreensaver();
}

deckMgr.changePage("default");

streamDeck.on('down', (keyIndex)=>{
	if ( ssActive ) {
		deckMgr.stopScreensaver();
		ssActive = false;
	} else {
		if ( buttons[keyIndex] ) {
			buttons[keyIndex].activate();
		}
	}
	if ( ssTimer ) {
		clearTimeout(ssTimer);
	}
	// ssTimer will be null if it was started previously
	if ( config.screensaver ){
		ssTimer = checkScreensaver();
	}
});

function checkScreensaver(){
	return setTimeout(()=>{
		ssActive = true;
		ssTimer = null;
		deckMgr.startScreensaver();
	}, config.screensaver.timeoutMinutes * 60 * 1000);
}

function getDevice(str){
	let result = devices.find((dev)=>{
		return dev.serialNumber === str || dev.path === str || dev.model === str;
	});
	if ( result ) return result;
	return devices[0];
}

function exitError(err){
	console.error(err);
	process.exit(1);
}
