// TitleScene: bootstrap and resource-loading scene for the game. Responsibilities:
// - Preload images, sounds and music required by the game
// - Present title UI and allow switching into gameplay scenes
// - Provide a lightweight multiplayer-ready contract (sendState / applyRemoteState)
//
// Contract (high-level):
// - Inputs: resources passed via onPreload/onSwitchFrom, input via mouse/keys
// - Outputs: calls to Draw/UIDraw and optional server diffs via sendState
// - Lifecycle: onPreload -> onReady -> onSwitchFrom/onSwitchTo
//
// Keep this scene lightweight: heavy simulation belongs in actual gameplay scenes.
import Scene from './Scene.js';
import Vector from '../js/Vector.js';
import SoundManager from '../js/SoundManager.js'
import MusicManager from '../js/MusicManager.js'
import Color from '../js/Color.js';
import UIButton from '../js/UI/Button.js';
import UISlider from '../js/UI/Slider.js';
import UIRect from '../js/UI/Rect.js';
import UIImage from '../js/UI/Image.js';
import Menu from '../js/UI/Menu.js';
import { Dragon } from '../Game logic/sprites.js';
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
     * Load images
     */
    async loadImages(){
        // Set up image paths, map them to Image objects after.
        // Examples:
        this.BackgroundImageLinks = {
            'background':'Assets/Backgrounds/Base Background.png',
            'title':'Assets/Backgrounds/Title screen.png',
        }

        this.BackgroundImages = {
            'background':new Image(),
            'title':new Image(),
        }

        this.SpriteImageLinks = {
            'fireball':'Assets/Sprites/fireball.png',
            'dragon':'Assets/Sprites/dragon.png',
        }

        this.SpriteImages = {
            'fireball':new Image(),
            'dragon':new Image(),
        }



        for(let file in this.BackgroundImages){
            this.BackgroundImages[file].src = this.BackgroundImageLinks[file];
            if (this._loadingOverlay) {
                // rough incremental progress while images load
                const idx = Object.keys(this.BackgroundImages).indexOf(file);
                const total = Object.keys(this.BackgroundImages).length + Object.keys(this.SpriteImages).length;
                const progress = Math.min(0.2, ((idx + 1) / total) * 0.2);
                this._loadingOverlay.setProgress(progress);
            }
        }
        for(let file in this.SpriteImages){
            this.SpriteImages[file].src = this.SpriteImageLinks[file];
            if (this._loadingOverlay) {
                const idx = Object.keys(this.SpriteImages).indexOf(file) + Object.keys(this.BackgroundImages).length;
                const total = Object.keys(this.BackgroundImages).length + Object.keys(this.SpriteImages).length;
                const progress = Math.min(0.25, ((idx + 1) / total) * 0.25);
                this._loadingOverlay.setProgress(progress);
            }
        }
        // Images loaded
        this.loaded += 1;
        this._loadingOverlay && this._loadingOverlay.setProgress(0.25);
    }

    /**
     * Load music
     */
    async loadMusic(){
        // Get music files
        const musicFiles = [
            //['intro', "Assets/sounds/music_intro.wav"],
            //['part1', "Assets/sounds/music_part1.wav"],
            //['part2', "Assets/sounds/music_part2.wav"],
            //['segue', "Assets/sounds/music_segue.wav"],
            //['part3', "Assets/sounds/music_part3.wav"]
        ];
        // Load music files
        let musicSkipped = false;
        for (const [key, path] of musicFiles) {
            // If the debug flag was toggled to skip during loading, stop further loads
            if (window.Debug && typeof window.Debug.getFlag === 'function' && window.Debug.getFlag('skipLoads')) {
                console.log('Skipping remaining music loads (user requested skip)');
                musicSkipped = true;
                break;
            }
            await this.musician.loadSound(key, path);
            if (this._loadingOverlay) {
                // progress between 50% and 90% during music load
                const idx = musicFiles.findIndex(m => m[0] === key);
                const progress = 0.5 + (idx + 1) / musicFiles.length * 0.4;
                this._loadingOverlay.setProgress(progress);
                this._loadingOverlay.setMessage(`Loading music: ${key}`);
            }
        }
        // Music loaded
        if (musicSkipped) {
            this.loaded += 1;
            this._loadingOverlay && this._loadingOverlay.setMessage('Music skipped');
            return;
        }

        // Set up conductor sections and conditions for music transitions
        this.conductor.setSections([
            { name: "intro", loop: false },
            { name: "part1", loop: true },
            { name: "part2", loop: true },
            { name: "part3", loop: true },
            { name: "part4", loop: true },
            { name: "segue", loop: false },
            { name: "part5", loop: false }
        ]);

        // conditions correspond to section indexes 1..4
        const conditions = [
            () => 1+1==11, //example condition
        ];
        conditions.forEach((cond, i) => this.conductor.setCondition(i + 1, cond));

        // Start playback
        this.loaded += 1;
        this._loadingOverlay && this._loadingOverlay.setProgress(0.9);
    }

    /**
     * Load sounds
     */
    async loadSounds(){
        // Loading sound effects

        // Just some example sound effects
        const sfx = [
            //['crash', 'Assets/sounds/crash.wav'],
            //['break', 'Assets/sounds/break.wav'],
            //['place', 'Assets/sounds/place.wav'],
            //['rotate', 'Assets/sounds/rotate.wav'],
        ];

        for (const [key, path] of sfx) {
            await this.soundGuy.loadSound(key, path);
            if (this._loadingOverlay) {
                const idx = sfx.findIndex(s => s[0] === key);
                const progress = 0.25 + (idx + 1) / sfx.length * 0.25;
                this._loadingOverlay.setProgress(progress);
                this._loadingOverlay.setMessage(`Loading SFX: ${key}`);
            }
        }
        // Sound effects loaded
        this.loaded += 1;
        this._loadingOverlay && this._loadingOverlay.setProgress(0.5);
    }

    /**
     * Sends the local player's state to the server for multiplayer synchronization.
     * 
     * To send data: diff[playerId + 'key'] = value;
     */
    sendState(){
        if (this.server) {
            if (!this.lastStateSend) this.lastStateSend = 0;
            const now = performance.now();
            if (now - this.lastStateSend >= this.tickRate) {
                const diff = {};
                // Put data to send into diff object here



                // Core data
                diff[this.playerId + 'paused'] = this.paused;
                diff[this.playerId + 'scene'] = {'scene':'game', 'time':now};

                // Send data
                if (Object.keys(diff).length > 0) {
                    this.server.sendDiff(diff);
                }

                this.lastStateSend = now;
            }
        }
    }

    /**
     * Get data from server and apply to local game state.
     * Data looks like: state[remoteId + 'key']
     * 
     * Use sendState to send data.
     * 
     * This is called automatically when new data is received from the server.
     * 
     * @param {*} state The data sent from the server
     * @returns 
     */
    applyRemoteState = (state) => {
        if (!state) return;
        const remoteId = this.playerId === 'p1' ? 'p2' : 'p1';
        // Receive data here



        this.applyTick(remoteId, state);

        // Make sure clients are in the same scene
        if (state[remoteId + 'scene']) {
            if (state[remoteId + 'scene'].scene !== 'game' && this.playerId !== 'p1') {
                this.switchScene(state[remoteId + 'scene'].scene);
            }
        }
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
     * Attach debug console commands to manipulate game state.
     * 
     * For example: window.Debug.createSignal('Hello',()=>{console.log(`Hello!`);});
     * Typing "Hello()" in the debug console will trigger the callback, in this case 'Hello!'.
     * 
     * Warning: commands do not persist across scene switches.
     * 
     * Ensure to disconnect signals that require local data (i.e. this.variable) with this.disconnectDebug(), and reconnect with this.connectDebug().
     */
    connectDebug(){
        // Add custom debug signals here



        // Clear server rooms
        window.Debug.createSignal('clearserver',()=>{this.server.clearAllRooms()})
        
        // Log memory usage over 50 frames
        window.Debug.createSignal('memory',()=>{
            let count = 0;
            function logMemory() {
                if (window.performance && window.performance.memory) {
                    const mem = window.performance.memory;
                    const usedMB = mem.usedJSHeapSize / 1048576;
                    const totalMB = mem.totalJSHeapSize / 1048576;
                    console.log(`Frame ${count+1}: Memory used: ${usedMB.toFixed(2)} MB / ${totalMB.toFixed(2)} MB`);
                } else {
                    console.log('performance.memory API not available in this browser.');
                }
                count++;
                if (count < 50) {
                    requestAnimationFrame(logMemory);
                }
            }
            logMemory();
        });
    }

    /** 
     * Disconnect debug console commands 
     * */
    disconnectDebug(){

    }

    /** 
     * Called when switching to this scene. 
     */
    onSwitchTo() {
        if (this.RSS && this._rssHandler && typeof this.RSS.disconnect === 'function') {
            try { this.RSS.disconnect(this._rssHandler); } catch (e) { /* ignore */ }
        }
        this.disconnectDebug();
        this.Draw.clear()
        this.UIDraw.clear()
        return this.packResources(); 
    }

    /** 
     * Packs local resources into a Map to be transferred between scenes 
     * */
    packResources(){
        let resources = new Map();
        resources.set('settings', this.settings)
        resources.set('backgrounds',this.BackgroundImages)
        resources.set('sprites',this.SpriteImages)
        resources.set('soundguy',this.soundGuy)
        resources.set('musician',this.musician)
        resources.set('conductor',this.conductor)
        resources.set('narrator',this.narrator)
        resources.set('id',this.playerId)
        return resources;
    }

    /** 
     * Unpacks resources from a Map transferred between scenes 
     * */
    unpackResources(resources){
        if (!resources) {
            console.log('No resources...');
            return false;
        }

        if (!(resources instanceof Map)) {
            console.error('Invalid resources type');
            return false;
        }
        for (const [key, value] of resources.entries()) {
            let log = true;
            switch (key) {
                case 'settings': this.settings = value; break;
                case 'backgrounds': this.BackgroundImages = value; break;
                case 'sprites': this.SpriteImages = value; break;
                case 'soundguy': this.soundGuy = value; break;
                case 'musician': this.musician = value; break;
                case 'conductor': this.conductor = value; break;
                case 'narrator': this.narrator = value; break;
                case 'id': this.playerId = value; break;
                default: console.warn(`Unknown resource key: ${key}`); log = false;
            }
        }
        return true;
    }

    /** 
     * Music conditions for switching tracks.
     * Use () => Boolean to add one.
    */
    setConditions(){
        const conditions = [

        ];
        conditions.forEach((cond, i) => this.conductor.setCondition(i + 1, cond));
    }

    /** 
     * Called when switching from this scene.
     * 
    */
    onSwitchFrom(resources) {
        if(!this.unpackResources(resources)) return false;
        this.RSS.connect((state) => {this.applyRemoteState(state)});

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
     * Set up player ID
     */
    enableTwoPlayer(id) {
        this.playerId = id;
        const isP1 = this.playerId === 'p1';
        this.twoPlayer = true;
    }

    /** 
     * Updates game timers 
     * */
    updateTimers(delta){
        if (this.paused) return;
        this.sessionTimer.update(delta);
    }

    /** 
     * Used to run ticks.
     * Don't put update logic here, use tick() instead.
     * (aside from UI updates)
     */
    update(delta) {
        if (!this.isReady) return;
        this.tickAccumulator += delta * 1000; // convert to ms
        // Mouse mask reset (corrects layered UI input issues)
        this.mouse.setMask(0);
        // Update UI elements
        let sortedElements = [...this.elements.values()].sort((a, b) => b.layer - a.layer);
        for (const elm of sortedElements) {
            elm.update(delta);
        }
        while (this.tickAccumulator >= this.tickRate) {
            if(!this.paused){
                this.tick();
            }
            this.tickAccumulator -= this.tickRate;
        }
        this.frameCount+=1;
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
     * Pauses the game
     *  */
    pause() {
        this.paused = true;
    }

    /** 
     * Unpauses the game 
     * */
    unpause() {
        this.paused = false;
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
        // Draw UI elements
        let sortedElements = [...this.elements.values()].sort((a, b) => a.layer - b.layer);
        for (const elm of sortedElements) {
            elm.draw(this.UIDraw);
        }
        this.UIDraw.useCtx('UI')
    }
}
