const sharp = require("sharp");
const Promise = require('bluebird');
const {spawn} = require('child_process');
const robot = require("robotjs");

module.exports = class ScreensaverController {
    constructor(deckMgr, ssCfg) {
        this.deckMgr = deckMgr;
        this.ssCfg = ssCfg;

        this.pages = [];
    }

    init(){
        // Set the icons
        this.isReady = sharp(this.ssCfg.animation).metadata().then((metadata)=>{
            let delays = metadata.delay;
            if (!delays) delays = [0];
            return Promise.each(delays,(delay, i)=>{
                return sharp(this.ssCfg.animation, {page: i})
                    .flatten()
                    .resize(this.deckMgr.deck.ICON_SIZE * this.deckMgr.deck.KEY_COLUMNS, this.deckMgr.deck.ICON_SIZE * this.deckMgr.deck.KEY_ROWS)
                    .removeAlpha()
                    .raw()
                    .toBuffer()
                    .then((buffer)=>{
                        this.pages.push({buffer, delay});
                    });
            }).then(()=>{
                return this.pages;
            })
        }).catch((err)=>{
            console.error(err);
            console.error('Failed on icon', this.ssCfg.animation);
            throw err;
        });
        return this.isReady;
    }

    processGif(gifPages, i){
        this.deckMgr.deck.fillPanel(gifPages[i].buffer);
        this.timeout = setTimeout(()=>{
            i = (i+1) % gifPages.length;
            this.processGif(gifPages, i);
        }, gifPages[i].delay);
    }

    start(){
        if ( this.pages.length === 1 ) {
            this.deckMgr.deck.fillPanel(this.pages[0].buffer);
        } else {
            this.processGif(this.pages, 0);
        }
    }

    stop(){
        if ( this.timeout ) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
    }
}