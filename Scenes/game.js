import Scene from './Scene.js';
import Vector from '../js/Vector.js';
import Color from '../js/Color.js';
import Timer from '../js/Timer.js';

export class GameScene extends Scene { 
    constructor(...args) {
        super('game', ...args);
        this.loaded = 0;
        this.elements = new Map();
        this.tickCount = 0;       
        this.tickRate = 42;       // this is 24 fps in milliseconds
        this.tickAccumulator = 0; 
        this.syncStep = 0;
    }
    
    /**
     * Runs before onReady.
     * Use to load necessary resources, such as images or sounds, before onReady is called.
     */
    async onPreload(resources=null) {

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
     * 
    */
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
     * */
    onSwitchFrom(resources) {
        if(!this.unpackResources(resources)) return false;
        this.RSS.connect((state) => {this.applyRemoteState(state)});

    }

    /** 
     * Create game timers 
     * */
    createTimers(){
        this.sessionTimer = new Timer('stopwatch');
        this.sessionTimer.start();
    }

    /** 
     * Called when the scene is ready. 
     * Declare variables here, NOT in the constructor.
     */
    onReady() {
        this.isReady = true;

        this.createUI();
        this.createTimers();
        this.frameCount = 0;
        this.connectDebug();
        this.setConditions();
        this.sendState();
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
     * */
    pause() {
        this.paused = true;
    }

    /** 
     * Unpauses the game 
     * 
    */
    unpause() {
        this.paused = false;
    }

    /** Creates the game's UI elements 
     * 
     * How to create a menu:
     1. Create a new Menu instance, add a base rect if needed for background
     3. Create a button (UIButton)
     5. Connect the button's onPressed signal to an action
     7. Add the button to the menu using menu.addElement('buttonName', button)
     8. Add the menu to the scene's elements map using this.elements.set('menuName', menu)
     *
     *  Example:
     1.  let menu = new Menu(mouse,keys,position,size,layer,backgroundColor)
     2.  let button = new UIButton(mouse,keys,position,size,layer,text,backgroundColor,hoverColor,pressedColor)
     3.  button.onPressed.left.connect(()=>{ /* action *\/ })
     4.  menu.addElement('button', button)
     5.  this.elements.set('pause', menu)
     */
    createUI(){
        
    }

    /** 
     * Draws the game. Use the Draw class to draw elements. 
     * */
    draw() {
        if(!this.isReady) return;




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