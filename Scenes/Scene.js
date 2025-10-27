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
     * Called once when swapped to for the first time, to set up scene variables.
     */
    onReady() {

    }

    /**
     * Called every time this scene is switched to (after onReady).
     * Returns a Map of resources to keep cached (key: resource name, value: resource type).
     */
    onSwitchTo() {
        return null;
    }

    /**
     * Called every time this scene is switched away from.
     */
    onSwitchFrom(resources) {

    }

    draw() {

    }
    
    update(delta) {

    }
}