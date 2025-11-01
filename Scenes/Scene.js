export default class Scene {
    constructor(name, Draw, UIDraw, mouse, keys, saver, switchScene, loadScene, preloadScene, removeScene, RSS, EM, server, playerCount=1) { // RSS: remoteStateSignal, EM: enableMultiplayer (signal)
        this.name = name;
        this.isReady = false;
        this.isPreloaded = false;
        this.Draw = Draw;
        this.UIDraw = UIDraw;
        this.saver = saver;
        this.mouse = mouse;
        this.playerCount = playerCount;
        this.keys = keys;
        this.switchScene = switchScene;
        this.loadScene = loadScene;
        this.preloadScene = preloadScene;
        this.removeScene = removeScene;
        this.RSS = RSS; // remote state signal
        this.EM = EM; // enable multiplayer signal
        this.server = server; // ServerManager instance
        this.elements = new Map()
    }

    /**
     * Called once, asynchronously, to preload assets (images, music, etc). 
     * Return a Promise.
     */
    async onPreload(resources=null) {

    }

    /**
     * Load images
     */
    async loadImages(){
        // Set up image paths, map them to Image objects after.
        // Examples:
        this.BackgroundImageLinks = {

        }

        this.BackgroundImages = {

        }
        // type like 'bg': 'filepath'
        this.SpriteImageLinks = {
            
        }
        
        // type like 'bg': new Image
        this.SpriteImages = {

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
                case 'id': this.playerId = value; break;
                default: console.warn(`Unknown resource key: ${key}`); log = false;
            }
        }
        return true;
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

    /** Put input logic here**/
    tickInput(){

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
     * Disconnect debug console commands 
     * */
    disconnectDebug(){

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
     * Called when switching from this scene.
     * 
    */
    onSwitchFrom(resources) {
        if(!this.unpackResources(resources)) return false;
        this.RSS.connect((state) => {this.applyRemoteState(state)});

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
     * Called once when swapped to for the first time, to set up scene variables.
     */
    onReady() {

    }


    draw() {

    }
}