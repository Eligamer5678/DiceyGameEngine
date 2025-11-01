import Scene from './Scene.js';
import Vector from '../js/Vector.js';
import SoundManager from '../js/SoundManager.js'
import MusicManager from '../js/MusicManager.js'
import Color from '../js/Color.js';
import Geometry from '../js/Geometry.js';
import LoadingOverlay from '../js/UI/LoadingOverlay.js';
import createHButton from '../js/htmlElements/createHButton.js';
import createHDiv from '../js/htmlElements/createHDiv.js';

export class TitleScene extends Scene {
    constructor(...args) {
        super('title', ...args);
        this.loaded = 0;
        // Number of players expected in session (1 by default). Used by
        // multiplayer logic to decide whether to send/receive state.
        this.playerCount = 1;
        this.defaultSaveData = {
            'settings':{
                'volume': {

                },
                'colors':{

                },
                'particles':0.1
            },
            'game':{

            }
        }
        this.settings = this.defaultSaveData.settings;
        this.elements = new Map()
        
    }
    
    /**
     * Preload necesary resources. Called BEFORE onReady()
     */
    async onPreload(resources=null) {
        this.soundGuy = new SoundManager()
        this.musician = new SoundManager()
        this.conductor = new MusicManager(this.musician)
        // Ensure skipLoads flag exists (default false) and register a shortcut signal
        window.Debug.addFlag('skipLoads', false);
        window.Debug.createSignal('skip', ()=>{ window.Debug.addFlag('skipLoads', true); });

        // Create and show loading overlay
        try {
            this._loadingOverlay = document.querySelector('loading-overlay') || new LoadingOverlay();
            if (!document.body.contains(this._loadingOverlay)) document.body.appendChild(this._loadingOverlay);
            this._loadingOverlay.setTitle('Dragons Don\'t Like Tetris');
            this._loadingOverlay.setMessage('Starting...');
            this._loadingOverlay.setProgress(0);
            this._loadingOverlay.show();
        } catch (e) {
            console.warn('Could not create loading overlay:', e);
        }
        await this.loadImages()
        this._loadingOverlay && this._loadingOverlay.setProgress(0.25);
        this._loadingOverlay && this._loadingOverlay.setMessage('Loading sounds...');
        await this.loadSounds()
        this._loadingOverlay && this._loadingOverlay.setProgress(0.5);
        if(window.Debug.getFlag('skipLoads')===false){
            await this.loadMusic()
        }else{  
            this.loaded+=2;
        }
        if(this.loaded>=3){
            console.log('Finished loading')
        }
        try {
            // Only start the conductor if music was loaded or if the user hasn't skipped loads
            if (!window.Debug || !window.Debug.skipLoads) {
                this.conductor.start(0.5);
            } else {
                console.log('Skipping conductor.start because skipLoads is enabled');
            }
        } catch (e) {
            console.warn('Conductor start failed:', e);
        }
        this.EM.connect('2Player', (id) => {
            this.enableTwoPlayer(id);
        });
    }

    /** 
     * Advance local tick count to match remote player's tick count. 
     * */
    applyTick(remoteId, state){
        const tickKey = remoteId + 'tick'; 
        if (!(tickKey in state)) return; 
        while (state[tickKey] > this.tickCount) this.tick();
    }
    
    /** 
     * Create game timers
     */
    createTimers(){
        this.sessionTimer = new Timer('stopwatch');
        this.sessionTimer.start();
    }

    /** 
     * Called when the scene is ready. 
     * Declare variables here, NOT in the constructor.
     */
    onReady() {
        this.twoPlayer = false;
        this.isReady = true;
        this.createUI()
        // Hide loading overlay now

        try {
            this._loadingOverlay && this._loadingOverlay.hide();
        } catch (e) { /* ignore */ }
        this.saver.set('twoPlayer',false)
        this.playerId = null;
        // Store a bound handler so we can safely disconnect it later.
        this._rssHandler = (state) => { this.applyRemoteState(state); };
        if (this.RSS && typeof this.RSS.connect === 'function') this.RSS.connect(this._rssHandler);
    }

    

    /** 
     * Updates game timers 
     * */
    updateTimers(delta){
        if (this.paused) return;
        this.sessionTimer.update(delta);
    }

    /** Put input logic here**/
    tickInput(){

    }

    /**  
     * This engine uses ticks for multiplayer synchronization instead of frame by frame.
     * */
    tick() {
        this.tickCount++;
        const tickDelta = this.tickRate / 1000; // convert ms -> seconds
        this.updateTimers(tickDelta);

        // Put true update logic here


    }

    

    

    /** 
     * Creates the game's UI elements 
     */
    createUI(){
        // Simple test UI placed on the 'UI' layer container. Uses DOM helpers
        // so we can verify the new UI layer container behaviour.
        try {
            const panelSize = new Vector(300, 130);
            const margin = 20;
            const panelPos = new Vector(1920 - margin - panelSize.x, 1080 - margin - panelSize.y);
            const panel = createHDiv(
                null,
                panelPos,
                panelSize,
                '#00000033',
                {
                    borderRadius: '8px',
                    border: '1px solid #FFFFFF44',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-around',
                    alignItems: 'center',
                    color: '#fff',
                    padding: '8px',
                    fontFamily: 'sans-serif'
                },
                'UI' // attach to UI layer container
            );

            const createBtn = createHButton(null, new Vector(10, 60), new Vector(130, 40), '#333', { color: '#fff', borderRadius: '6px', fontSize: 14, border: '1px solid #777' }, panel);
            createBtn.textContent = 'Create';
            createBtn.addEventListener('click', () => {
                console.log('[Title] Create button clicked');
            });

            const joinBtn = createHButton(null, new Vector(170, 60), new Vector(130, 40), '#333', { color: '#fff', borderRadius: '6px', fontSize: 14, border: '1px solid #777' }, panel);
            joinBtn.textContent = 'Join';
            joinBtn.addEventListener('click', () => {
                console.log('[Title] Join button clicked');
            });

            this.uiPanel = { panel, createBtn, joinBtn };
        } catch (e) {
            console.warn('createUI failed:', e);
        }
    }

    /** 
     * Draws the game. Use the Draw class to draw elements. 
     * */
    draw() {
        if(!this.isReady) return;
        this.Draw.background('#FFFFFF')



        this.UIDraw.useCtx('overlays')
        this.UIDraw.clear()


        // Draw UI elements (legacy)
        let sortedElements = [...this.elements.values()].sort((a, b) => a.layer - b.layer);
        for (const elm of sortedElements) {
            elm.draw(this.UIDraw);
        }
        this.UIDraw.useCtx('UI')
    }
}
