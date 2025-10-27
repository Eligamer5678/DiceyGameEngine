import Vector from "../js/Vector.js"; 
import Color from "../js/Color.js"
import Signal from "../js/Signal.js";
import { Tetromino } from './tetrominos.js'
import Geometry from "../js/Geometry.js";


export default class Board {
    constructor(Draw, dragons, size=new Vector(1080/2*0.9,1080*0.9)){
        this.Draw = Draw;
        this.size = size;
        this.gridPos = new Vector(1920/2-this.size.x/2,1080/2-this.size.y/2);
        this.tileSize = 20;
        this.reset();
        this.colors = {
            'grid': new Color(1,0,1,0.5),
            'blocks': new Color(0.6,1,0.64,1),
            'danger': new Color(1,1,0,1)
        }
        // AI+tetromino logic
        this.cycle = 0;
        this.activeTetromino = new Tetromino('random',null,this.cycle);
        this.aiTarget = null;
        // Signals
        this.onPlace = new Signal();
        this.onRotate = new Signal();
        this.onLineclear = new Signal();
        this.onTopout = new Signal();
        this.damageDragon = new Signal();
        this.blockDamaged = new Signal();
        this.blockBroken = new Signal();
        this.canlock = false;
        this.dmgMult = 1;
        this.dragons = dragons;
        this.onSync = new Signal();
        this.glitchColor = new Color(0.9,1,1);
        this.paused = false;

        this.fast = false;

        this.playerCount = 1;
    }

    reset(){
        this.board = [];
        this.board = Array.from({ length: 20 }, () => Array(10).fill(0));
        this.PrevBoard = Array.from({ length: 20 }, () => Array(10).fill(0));
        this.activeTetromino = new Tetromino('random');
        this.aiTarget = null;  
    }

    setTile(pos, value){
        const x = Math.round(pos.x);
        const y = Math.round(pos.y);
        if (y >= 0 && y < this.board.length && x >= 0 && x < this.board[0].length) {
            // Parse booleans to numbers
            if (typeof value === 'boolean') value = value ? 1 : 0;
            this.board[y][x] = value;
        }
    }

    getTile(pos){
        const x = Math.round(pos.x);
        const y = Math.round(pos.y);
        if (y >= 0 && y < this.board.length && x >= 0 && x < this.board[0].length) {
            return this.board[y][x];
        }
        return undefined;
    }


    checkTile(pos){
        let tile = this.getTile(pos)
        if (!tile) return false;
        if(tile>0 && tile<=1) return true;
        return false;
    }

    scanLine(type){
        // Returns array of booleans: true if line is full (all filled), false otherwise
        if (type === 'row') {
            return this.board.map(row => row.every(cell => cell > 0 && cell < 2));
        } else if (type === 'column') {
            const cols = this.board[0].length;
            const rows = this.board.length;
            let result = [];
            for (let x = 0; x < cols; x++) {
                let full = true;
                for (let y = 0; y < rows; y++) {
                    if (!(this.board[y][x] > 0 && this.board[y][x] < 2)) {
                        full = false;
                        break;
                    }
                }
                result.push(full);
            }
            return result;
        }
        return [];
    }

    clearLines(){
        let cleared = 0;
        for (let y = this.board.length - 1; y >= 0; y--) {
            if (this.board[y].every(cell => cell > 0 && cell < 2)) {
                this.board.splice(y, 1);
                this.board.unshift(Array(this.board[0].length).fill(0));
                cleared++;
                y++; // recheck this row index after shifting
            }
        }
        if(cleared>0){
            this.onLineclear.emit(cleared)
        }
        return cleared;
    }

    draw(){
        // Draw ghost piece and faint area between ghost and active piece
        if (this.activeTetromino) {
            let ghostTet = new Tetromino(this.activeTetromino.type);
            ghostTet.pos = this.activeTetromino.pos.clone();
            ghostTet.rotation = this.activeTetromino.rotation;
            // Drop ghostTet until it collides
            while (!this.checkCollision(ghostTet, new Vector(0,1))) {
                ghostTet.pos.y += 1;
            }
            // Draw faint area between active and ghost
            let activePositions = this.activeTetromino.getPositions();
            let ghostPositions = ghostTet.getPositions();
            let drawnColumns = [];
            for (let i = 0; i < activePositions.length; i++) {
                if(drawnColumns.includes(activePositions[i].x)) continue; // avoid overdrawing columns  
                let a = activePositions[i];
                let g = ghostPositions[i];
                if (a.x === g.x && a.y === g.y) continue; // skip if same position
                let x = a.x * this.size.x/10 + this.gridPos.x;
                let y1 = a.y * this.size.y/20 + this.gridPos.y;
                let y2 = g.y * this.size.y/20 + this.gridPos.y;
                let rectY = Math.min(y1, y2);
                let rectH = Math.abs(y2 - y1);
                if (rectH > 0.1) {
                    this.Draw.rect(
                        new Vector(x, rectY),
                        new Vector(this.size.x/10, rectH),
                        'rgba(180,180,180,0.12)'
                    );
                    drawnColumns.push(a.x);
                }
            }
            // Draw ghost
            ghostTet.getPositions().forEach(
                (pos) => this.Draw.rect(
                    new Vector(pos.x*this.size.x/10 + this.gridPos.x, pos.y*this.size.y/20 + this.gridPos.y),
                    new Vector(this.size.x/10,this.size.y/20),
                    'rgba(200,200,200,0.3)'
                )
            );
        }
        // ...existing code...
        this.Draw.line(this.gridPos.add(new Vector(0,0)),this.gridPos.add(new Vector(this.size.x,0)),this.colors.grid,5)
        this.Draw.line(this.gridPos.add(new Vector(0,0)),this.gridPos.add(new Vector(0,this.size.y)),this.colors.grid,5)
        for (let y = 0; y < this.board.length; y++){
            this.Draw.line(this.gridPos.add(new Vector(0,(y+1)*this.size.x/10)),this.gridPos.add(new Vector(this.size.x,(y+1)*this.size.x/10)),this.colors.grid,5)
            for (let x = 0; x < this.board[y].length; x++){
                if(y===0){
                    this.Draw.line(this.gridPos.add(new Vector((x+1)*this.size.x/10,0)),this.gridPos.add(new Vector((x+1)*this.size.x/10,this.size.y)),this.colors.grid,5);
                }
                if(this.board[y][x]<=0) {this.board[y][x] = 0;continue;} // direct board edit (clamp to 0)
                if(this.board[y][x] < 2){
                    this.Draw.rect(new Vector(x*this.size.x/10 + this.gridPos.x, y*this.size.y/20 + this.gridPos.y),new Vector(this.size.x/10,this.size.y/20),this.colors.blocks.toHex(Math.max(this.board[y][x],0.2)))
                }else if(this.board[y][x] === 2){
                    this.Draw.rect(new Vector(x*this.size.x/10 + this.gridPos.x, y*this.size.y/20 + this.gridPos.y),new Vector(this.size.x/10,this.size.y/20),this.colors.danger)
                }else{
                    this.glitchColor.d = Math.min(this.board[y][x]/100,0.6);
                    this.Draw.rect(new Vector(x*this.size.x/10 + this.gridPos.x, y*this.size.y/20 + this.gridPos.y),new Vector(this.size.x/10,this.size.y/20),this.glitchColor)
                }   
            }
        }
        this.activeTetromino.getPositions().forEach(
            (pos)=>this.Draw.rect(new Vector(pos.x*this.size.x/10 + this.gridPos.x, pos.y*this.size.y/20 + this.gridPos.y),new Vector(this.size.x/10,this.size.y/20),new Color(1,1,1,1))
        )
    }

    moveTetromino(type='fall',data=new Vector(0,1),stop=false){
        if(this.fast && type === 'fall' && !stop){
            this.moveTetromino('fall',data,true);
            this.moveTetromino('fall',data,true);
            this.moveTetromino('fall',data,true);
        }
        this.canlock = false;
        if (this.activeTetromino === null) return false;
        let canMove = true;
        for (let part of this.activeTetromino.getPositions()){
            if (this.checkTile(part.add(data)) || !this.checkBounds(part.add(data))){
                canMove = false;
            }
        }
        if(canMove){
            this.justSpawned = false;
            for (let part of this.activeTetromino.getPositions()){
                this.setTile(part,0)
                this.setTile(part.add(data),2)
            }
            this.activeTetromino.pos.addS(data)
        }else if(type === 'fall'){
            for (let part of this.activeTetromino.getPositions()){
                this.setTile(part,0)
            } 
            this.canlock = true;
            if(this.playerCount === 1){
                
                this.lockTetromino();
            }
        }
    }

    lockTetromino(data=new Vector(0,1)) {
        let canMove = true;
        for (let part of this.activeTetromino.getPositions()){
            if (this.checkTile(part.add(data)) || !this.checkBounds(part.add(data))){
                canMove = false;
            }
        }
        if(!canMove){
            for (let part of this.activeTetromino.getPositions()){
                this.setTile(part,1)
            } 
            this.clearLines();
            if(this.justSpawned){
                this.reset();
                this.onTopout.emit()
            }

            this.activeTetromino = new Tetromino('random',null,this.cycle);
            this.justSpawned = true;
            this.onPlace.emit()
            this.cycle += 1;
            this.aiTarget = null;
            this.activeTetromino.getPositions().forEach(()=>{})
            for (let part of this.activeTetromino.getPositions()){
                this.setTile(part, 2);
            }
            this.canlock = false;
        }
    }

    rotateTetromino(dir=1){
        if (this.activeTetromino === null) return false;
        
        let canMove = true;
        for (let part of this.activeTetromino.getPositions(dir)){
            if (this.checkTile(part) || !this.checkBounds(part)){
                canMove = false;
            }
        }
        if(canMove){
            for (let part of this.activeTetromino.getPositions(0)){
                this.setTile(part,0)
            }
            for (let part of this.activeTetromino.getPositions(dir)){
                this.setTile(part,2)
            }
            this.onRotate.emit()
            this.activeTetromino.rotate(1)
        }

    }   

    checkBounds(pos){
        if(Math.round(pos.y)>this.board.length-1)return false;
        if(Math.round(pos.x)>this.board[Math.round(pos.y)].length-1) return false;
        if(Math.round(pos.y)<0) return false;
        if(Math.round(pos.x)<0) return false;
        return true;
    }

    getBestMove(tetromino) {
        let bestScore = -Infinity;
        let bestMove = {x: 0, rotation: 0};

        // Test all rotations
        for (let r = 0; r < 4; r++) {
            let testTet = new Tetromino(tetromino.type);
            testTet.rotation = tetromino.rotation + r * Math.PI/2;

            // Test all horizontal positions
            for (let x = -5; x < 10; x++) {
                testTet.pos = new Vector(4 + x, 0);
                
                // Drop tetromino to the bottom
                while (!this.checkCollision(testTet, new Vector(0,1))) {
                    testTet.pos.y += 1;
                }

                let score = this.evaluateBoard(testTet);
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = {x: testTet.pos.x - tetromino.pos.x, rotation: r};
                }
            }
        }

        return bestMove;
    }

    checkCollision(tetromino, delta) {
        for (let part of tetromino.getPositions()) {
            let nextPos = part.add(delta);
            if (!this.checkBounds(nextPos) || this.checkTile(nextPos)) return true;
        }
        return false;
    }

    evaluateBoard(tetromino) {
        // Simulate the tetromino on a temporary board
        let tempBoard = this.board.map(row => row.slice());
        let edgesTouching = 0;

        for (let pos of tetromino.getPositions()) {
            let x = Math.round(pos.x);
            let y = Math.round(pos.y);
            if (y >= 0 && y < tempBoard.length && x >= 0 && x < tempBoard[0].length) {
                tempBoard[y][x] = 1;

                // Check edges touching other blocks or walls
                let neighbors = [
                    [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]
                ];
                for (let [nx, ny] of neighbors) {
                    if (nx < 0 || nx >= 10 || (ny >= 0 && ny < 20 && tempBoard[ny][nx] === 1)) {
                        edgesTouching++;
                    }
                }
            }
        }

        let holes = 0;
        let overhangPenalty = 0;
        let fullLines = 0;
        let partialLineBonus = 0;
        let multiLineBonus = 0;
        let iColumnPenalty = 0;
        let heights = Array(10).fill(0);

        for (let x = 0; x < 10; x++) {
            let blockFound = false;
            let gapHeight = 0;
            for (let y = 0; y < 20; y++) {
                if (tempBoard[y][x] === 1) blockFound = true;
                else if (blockFound && tempBoard[y][x] === 0) {
                    holes++;
                    overhangPenalty += (20 - y) * 2; // double penalty for overhangs
                }

                if (tempBoard[y][x] === 0) gapHeight++;
                else {
                    if (gapHeight >= 1) iColumnPenalty += gapHeight * 3; // punish any overhang gaps heavily
                    gapHeight = 0;
                }

                if (x === 0) {
                    let row = tempBoard[y];
                    let filled = row.reduce((a, c) => a + (c ? 1 : 0), 0);

                    if (filled === 10) fullLines++;
                    else if (filled >= 7 && filled < 10) multiLineBonus += filled;

                    let maxRun = 0, currentRun = 0;
                    for (let i = 0; i < row.length; i++) {
                        if (row[i] === 1) currentRun++;
                        else currentRun = 0;
                        if (currentRun > maxRun) maxRun = currentRun;
                    }
                    partialLineBonus += maxRun;
                }

                if (tempBoard[y][x] === 1 && heights[x] === 0) {
                    heights[x] = 20 - y;
                }
            }
            if (gapHeight >= 1) iColumnPenalty += gapHeight * 3;
        }

        // Calculate bumpiness & aggregate height
        let aggregateHeight = heights.reduce((a, b) => a + b, 0);
        let bumpiness = heights.reduce((acc, h, i, arr) => i > 0 ? acc + Math.abs(h - arr[i - 1]) : acc, 0);

        // Well analysis
        let wellScore = 0;
        for (let x = 0; x < 10; x++) {
            let leftHeight = x === 0 ? 20 : heights[x - 1];
            let rightHeight = x === 9 ? 20 : heights[x + 1];
            if (heights[x] < leftHeight && heights[x] < rightHeight) {
                let wellDepth = Math.min(leftHeight, rightHeight) - heights[x];
                if ((leftHeight - heights[x] === 1) && (rightHeight - heights[x] === 1)) {
                    wellScore -= 10 * wellDepth; // punish 1-wide wells more
                } else if ((leftHeight - heights[x] >= 2 && rightHeight - heights[x] >= 2)) {
                    wellScore += 3 * wellDepth; // slightly favor 2+ wide wells
                }
            }
        }

        // Heuristic scoring
        let score = (fullLines ** 2) * 500
                + (multiLineBonus * 10)
                + (partialLineBonus * 5)
                + (edgesTouching * 20)
                - (holes * 800)               // stronger hole penalty
                - (overhangPenalty)      // heavy overhang penalty
                - (aggregateHeight * 5)
                - (bumpiness * 5)
                - (iColumnPenalty * 5)        // heavily punish small gaps under blocks
                + wellScore
                - Math.abs(4.5 - tetromino.pos.x) * 2;

        return score;
    }  

    spawnGlitch(){
        // Get dragon's grid position
        const dragonGridX = Math.floor((this.dragons[0].pos.x - this.gridPos.x) / (this.size.x / 10));
        const dragonGridY = Math.floor((this.dragons[0].pos.y - this.gridPos.y) / (this.size.y / 20));
        let tries = 0;
        let x, y;
        do {
            y = Math.floor(Math.random() * 19);
            x = Math.floor(Math.random() * 10);
            tries++;
        } while (Math.abs(x - dragonGridX) < 5 && Math.abs(y - dragonGridY) < 5 && tries < 100);
        this.board[y][x] = 100;
    }

    updateAI(stop=false){
        if(this.fast && !stop){
            this.applyBestMove();
            this.applyBestMove();
        }
        this.applyBestMove();
    }

    applyBestMove() {
        if (!this.activeTetromino) return;
        if (!this.aiTarget) {
            this.aiTarget = this.getBestMove(this.activeTetromino);
            this.aiStepX = this.aiTarget.x;
            this.aiStepR = this.aiTarget.rotation;
        }
        // Rotate first
        if (this.aiStepR > 0) {
            this.rotateTetromino();
            this.aiStepR--;
            return;
        }
        
        // Move horizontally
        if (this.aiStepX < 0) {
            this.moveTetromino('move', new Vector(-1,0));
            this.aiStepX++;
            return;
        } else if (this.aiStepX > 0) {
            this.moveTetromino('move', new Vector(1,0));
            this.aiStepX--;
            return;
        }
    }

    collideFire(dragon){
        for (let fireball of dragon.fireballs) {
            if (!fireball) continue;
            // Compute affected grid range
            let minX = Math.floor((fireball.pos.x - this.gridPos.x) / (this.size.x / 10));
            let maxX = Math.floor((fireball.pos.x + fireball.size.x - this.gridPos.x) / (this.size.x / 10));
            let minY = Math.floor((fireball.pos.y - this.gridPos.y) / (this.size.y / 20));
            let maxY = Math.floor((fireball.pos.y + fireball.size.y - this.gridPos.y) / (this.size.y / 20));
            // Clamp to board bounds
            minX = Math.max(0, minX); maxX = Math.min(9, maxX);
            minY = Math.max(0, minY); maxY = Math.min(19, maxY);

            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    if (this.board[y][x] <= 0) continue;
                    let tileX = x * this.size.x / 10 + this.gridPos.x;
                    let tileY = y * this.size.y / 20 + this.gridPos.y;
                    let tileW = this.size.x / 10;
                    let tileH = this.size.y / 20;
                    if (Geometry.rectCollide(fireball.pos, fireball.size, new Vector(tileX, tileY), new Vector(tileW, tileH))) {
                        this.board[y][x] -= Math.max(fireball.power, 0);
                        if (this.board[y][x] <= 0) {
                            this.board[y][x] = 0;
                            this.blockBroken.emit();
                            this.sessionBlocks += 1;
                            dragon.anger *= 1.0015;
                            if (dragon.anger > 1) dragon.anger = 1;
                        }
                        fireball.power -= 0.5;
                        this.blockDamaged.emit(new Vector(tileX + tileW / 2, tileY + tileH / 2));
                    }
                }
            }
            if (fireball.power <= 0) {
                fireball.adiós();
                dragon.power *= 1.002;
                dragon.anger += 0.005;
            }
        }
    }

    collideTile(dragon){
        for (let y = 0; y < this.board.length; y++) {
            for (let x = 0; x < this.board[y].length; x++) {
                if (this.board[y][x] <= 0 || !this.board[y][x]) { 
                    this.setTile(new Vector(x,y),0)
                    continue;
                }
                if(this.board[y][x]>2&&this.board[y][x]<=10){//Glitched blocks
                    this.board[y][x] = 0;
                    dragon.health +=5;
                    dragon.power += 0.05;
                }
                let tileX = x * this.size.x / 10 + this.gridPos.x;
                let tileY = y * this.size.y / 20 + this.gridPos.y;
                let tileW = this.size.x / 10;
                let tileH = this.size.y / 20;


                // --- Horizontal collisions ---
                // Right side
                let collided = false
                if(dragon.power < 3 || this.board[y][x] >=5){
                    if (dragon.pos.x + dragon.vlos.x + dragon.size.x >= tileX &&
                        dragon.pos.x <= tileX &&
                        dragon.pos.y + dragon.size.y - 2 > tileY &&
                        dragon.pos.y + 2 < tileY + tileH
                    ) {
                        dragon.pos.x = tileX - dragon.size.x;
                        dragon.vlos.x *= 0.0001;
                        collided = true;
                    }
                    // Left side
                    if (dragon.pos.x + dragon.vlos.x <= tileX + tileW &&
                        dragon.pos.x + dragon.size.x >= tileX + tileW &&
                        dragon.pos.y + dragon.size.y - 2 > tileY &&
                        dragon.pos.y + 2 < tileY + tileH
                    ) {
                        dragon.pos.x = tileX + tileW;
                        dragon.vlos.x *= 0.0001;
                        collided = true;
                    }

                    // --- Vertical collisions ---
                    // Bottom (floor)
                    if (dragon.pos.y + dragon.vlos.y + dragon.size.y >= tileY &&
                        dragon.pos.y <= tileY &&
                        dragon.pos.x + dragon.size.x - 2 > tileX &&
                        dragon.pos.x + 2 < tileX + tileW
                    ) {
                        dragon.pos.y = tileY - dragon.size.y;
                        dragon.vlos.y *= -0.2;
                        collided = true;
                    }
                    // Top (ceiling)
                    if (dragon.pos.y + dragon.vlos.y <= tileY + tileH &&
                        dragon.pos.y + dragon.size.y >= tileY + tileH &&
                        dragon.pos.x + dragon.size.x - 2 > tileX &&
                        dragon.pos.x + 2 < tileX + tileW
                    ) {
                        dragon.pos.y = tileY + tileH;
                        dragon.vlos.y *= -0.2;
                        collided = true;
                    }
                }
                if(collided && this.board[y][x] >= 5){
                    dragon.health -=0.5*this.dmgMult;
                }
            }
        }
    }

    collideActive(dragon){
        for (let part of this.activeTetromino.getPositions()){
            let collided = false
            let tileX = part.x * this.size.x / 10 + this.gridPos.x;
            let tileY = part.y * this.size.y / 20 + this.gridPos.y;
            let tileW = this.size.x / 10;
            let tileH = this.size.y / 20;
            if(dragon.power < 3){
                if (dragon.pos.x + dragon.vlos.x + dragon.size.x >= tileX &&
                    dragon.pos.x <= tileX &&
                    dragon.pos.y + dragon.size.y - 2 > tileY &&
                    dragon.pos.y + 2 < tileY + tileH
                ) {
                    dragon.pos.x = tileX - dragon.size.x;
                    dragon.vlos.x *= 0.0001;
                    collided = true;
                }
                // Left side
                if (dragon.pos.x + dragon.vlos.x <= tileX + tileW &&
                    dragon.pos.x + dragon.size.x >= tileX + tileW &&
                    dragon.pos.y + dragon.size.y - 2 > tileY &&
                    dragon.pos.y + 2 < tileY + tileH
                ) {
                    dragon.pos.x = tileX + tileW;
                    dragon.vlos.x *= 0.0001;
                    collided = true;
                }

                // --- Vertical collisions ---
                // Bottom (floor)
                if (dragon.pos.y + dragon.vlos.y + dragon.size.y >= tileY &&
                    dragon.pos.y <= tileY &&
                    dragon.pos.x + dragon.size.x - 2 > tileX &&
                    dragon.pos.x + 2 < tileX + tileW
                ) {
                    dragon.pos.y = tileY - dragon.size.y;
                    dragon.vlos.y *= -0.2;
                    collided = true;
                }
                // Top (ceiling)
                if (dragon.pos.y + dragon.vlos.y <= tileY + tileH &&
                    dragon.pos.y + dragon.size.y >= tileY + tileH &&
                    dragon.pos.x + dragon.size.x - 2 > tileX &&
                    dragon.pos.x + 2 < tileX + tileW
                ) {
                    dragon.pos.y = tileY + tileH;
                    dragon.vlos.y *= -0.2;
                    collided = true;
                }
            }
            if(collided){
                dragon.health -= 1*this.dmgMult;
                if(this.fast){
                    dragon.health -= 1*this.dmgMult*3;
                }
                this.damageDragon.emit()
            }
        }
    }

    collideWall(dragon){
        if(dragon.power<4){
            if(dragon.pos.y+dragon.size.y>this.gridPos.y+this.size.y){
                dragon.pos.y = this.gridPos.y+this.size.y - dragon.size.y;
                if(dragon.vlos.y > 0){
                    dragon.vlos.y =0
                }
            }
            if(dragon.pos.y<this.gridPos.y){
                dragon.pos.y = this.gridPos.y;
                if(dragon.vlos.y < 0){
                    dragon.vlos.y = 0
                }
            }
            if(dragon.pos.x+dragon.size.x>this.gridPos.x+this.size.x){
                dragon.pos.x = this.gridPos.x+this.size.x - dragon.size.x;
            }
            if(dragon.pos.x < this.gridPos.x){
                dragon.pos.x = this.gridPos.x;
            }
        }
    }

    update(delta) {
        this.dragons.forEach((dragon) => {
            if(dragon.onlineGhost) return;
            this.collideTile(dragon);
            this.collideWall(dragon);
            if(!this.paused){
                this.collideActive(dragon);
                this.collideFire(dragon);
            }  
        });
    }
}