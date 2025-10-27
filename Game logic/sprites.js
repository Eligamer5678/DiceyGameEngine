import Signal from "../js/Signal.js";
import Vector from "../js/Vector.js";
import Geometry from "../js/Geometry.js";

export class Appicon {
    constructor(draw,pos,size,image){
        this.size = size;
        this.pos = pos.clone().sub(this.size.clone().multS(0.5));
        this.vlos = new Vector(Math.random()-0.5,Math.random()-0.5).normalize()
        this.speed = 300
        this.image = image
        this.health = 500
        this.rotation = Math.random()*2*Math.PI;
        this.rotVlos = Math.PI * (Math.random() > 0.5 ? -1:1)
        this.Draw = draw;
        this.destroy = new Signal()
    }
    update(delta){
        
    }
    adiós(){
        this.destroy.emit();
    }
    draw(){
        this.Draw.image(this.image,this.pos,this.size,1,0)
    }
}

export class Dragon {
    constructor(mouse, keys, draw, pos, images, saver, options = {}) {
        this.pos = pos;
        this.keys = keys;
        this.mouse = mouse;
        this.Draw = draw;
        this.size = new Vector(40, 40);
        this.images = images;
        this.image = images['dragon'];

        this.speed = 200;
        this.twoPlayer = options.twoPlayer || false;
        this.which = options.which || 0; // local player index
        this.id = options.id || 'p1'; // 'p1' or 'p2'
        this.saver = saver;

        this.health = 100;
        this.power = 0.2;
        this.anger = 0;
        this.big = false;
        this.heavy = false;

        this.fireballTimer = 0.1;
        this.prevKey = '';
        this.lockHp = true;
        this.spin = 0;
        this.spinHeal = false;
        this.updraft = 0;

        this.vlos = new Vector(0, 0);
        this.rot = 0;
        this.fireballs = [];
        this.fireTime = 0;
        this.died = false;

        // Multiplayer / ghost flags
        this.onlineGhost = options.onlineGhost || false; // disables gravity & input
        this.inputEnabled = options.inputEnabled !== undefined ? options.inputEnabled : true;

        this.megaability = new Signal();
        this.onDeath = new Signal();
    }

    update(delta) {
        if(this.onlineGhost){
            this.fireballs = []
        }
        if (this.died) return;

        // Ghost copy: disable input & gravity
        const applyGravity = !this.onlineGhost;
        const canMove = this.inputEnabled && !this.onlineGhost;

        if (this.health < 0) this.health = 0;

        this.size = new Vector(40 * Math.max(Math.min(this.power, 5), 1),
                               40 * Math.max(Math.min(this.power, 5), 1));

        // Update fireballs
        for (let i = this.fireballs.length - 1; i >= 0; i--) {
            this.fireballs[i].update(delta);
        }

        if (this.big) this.size = this.size.mult(2);

        // Gravity
        // original code used small per-frame constants; convert to per-second by scaling by ~60
        if (applyGravity && !this.keys.held('Shift')) {
            this.vlos.y += 1 * 24 * delta * Math.max(Math.min(this.power, 5), 1);
        }

        // Apply velocity (vlos is pixels per second)
        this.pos.addS(this.vlos.mult(delta).multS(24));

        // World bounds
        this.pos.x = Math.max(0, Math.min(this.pos.x, 1920 - this.size.x));
        this.pos.y = Math.max(0, Math.min(this.pos.y, 1080 - this.size.y));
        if (this.pos.y >= 1080 - this.size.y) this.vlos.y = 0;

        // Player input movement (only if allowed) - pass delta so input is time-correct
        if (canMove) this.handleInput(delta);

        
        if(canMove && this.keys.held(" ", true)){
            this.fireTime += delta;
            console.log(this.fireTime);
            if(this.fireTime>=this.fireballTimer){
                this.shootFireballs();
                this.fireTime = 0;
            }
        }


        this.useAbility(delta);

        // Health regen and limits
        if (this.power > 2) this.health += this.power * delta;
        if (this.lockHp) this.health = Math.min(this.health, 100);
        else this.health = Math.min(this.health, 320);

        // Damping: convert per-frame damping factor to time-correct exponential decay
        const perFrameDamping = this.heavy ? 0.64 : 0.8; // per-frame multiplier
        // Apply damping over delta seconds
        this.vlos.x *= Math.pow(perFrameDamping, 24 * delta);
        if (this.heavy) this.vlos.y += 3 * 24 * delta; // convert small per-frame bump to per-second

        if (this.health <= 0) {
            this.died = true;
            this.onDeath.emit();
        }

        // Prevent very small horizontal movement from freezing
        if (Math.abs(this.vlos.x) < 0.01) {
            this.vlos.x = this.prevKey === 'r' ? 0.001 : this.prevKey === 'l' ? -0.001 : this.vlos.x;
        }
    }

    handleInput(delta) {
        if (!this.inputEnabled) return; // ignore ghosts

        const speed = 2 * Math.max(Math.min(this.power, 5), 1);

        // Horizontal movement
        if (this.keys.held('ArrowRight') || this.keys.held('d') || this.keys.held('D')) {
                // original speed was per-frame; convert to per-second (approx *60)
                this.vlos.x += speed * 24 * delta;
            this.prevKey = 'r';
        }
        if (this.keys.held('ArrowLeft') || this.keys.held('a') || this.keys.held('A')) {
                this.vlos.x -= speed * 24 * delta;
            this.prevKey = 'l';
        }

        // Vertical movement - jump / fly
            // Convert jump magnitudes from per-frame to per-second by scaling by 60
            const jumpBase = 10 * Math.max(Math.min(this.power, 5), 1);
            if (this.keys.pressed('ArrowUp') || this.keys.pressed('w')) {
                // apply a strong impulse (set velocity)
                this.vlos.y = (-jumpBase - Math.abs(Math.min(Math.max(this.vlos.y, 10), 20)) / 10 * Math.max(Math.min(this.power, 5), 1) );
            } else if (this.keys.held('ArrowUp', true) > 0.2 || this.keys.held('w', true) > 0.2) {
                this.vlos.y = -jumpBase*24*delta;
            }

            if (this.keys.held('ArrowDown') || this.keys.held('s')) {
                // small per-frame addition converted to per-second
                this.vlos.y += 20 * 1.2 * (1/10) * 24 * delta; // tweak as needed
            }
    }


    shootFireballs() {
        const dir = Math.PI * Math.round(((Math.sign(-this.vlos.x) + 1) / 2));
        const fire = new FireBall(this, this.images['fireball'], this.Draw, this.pos.add(this.size.mult(0.5)), dir, 500, this.power);
        fire.destroy.connect(() => { this.fireballs = this.fireballs.filter(f => f !== fire); });
        this.fireballs.push(fire);

        if (this.power >= 1) {
            [-0.2, 0.2].forEach(offset => {
                const f = new FireBall(this, this.images['fireball'], this.Draw, this.pos.add(this.size.mult(0.5)), dir + offset, 500, this.power);
                f.destroy.connect(() => { this.fireballs = this.fireballs.filter(fb => fb !== f); });
                this.fireballs.push(f);
            });
        }
    }

    useAbility(delta) {
        if (this.twoPlayer) {
            if (this.anger >= 1 && this.keys.pressed(' ')) this.megaability.emit();
            return;
        }

        if (this.anger >= 1 && this.keys.pressed('f')) {
            this.megaability.emit();
            this.anger = 0;
            this.spin = 2 * Math.PI;
            this.spinHeal = 0;
            this.power += 0.15;
        }
        if (this.anger >= 1 && this.keys.pressed('h')) {
            this.megaability.emit();
            this.anger = 0;
            this.spin = 2 * Math.PI;
            this.spinHeal = 1;
        }
        if (this.anger >= 1 && this.keys.pressed('g')) {
            this.megaability.emit();
            this.anger = 0;
            this.spin = 2 * Math.PI;
            this.spinHeal = 2;
        }

        if (this.spin > 0) {
            this.spin -= Math.PI * 2 * delta;
            if (this.spin < 0) this.spin = 0;

            if (this.spinHeal === 1) this.health += delta * 50;
            if (this.spinHeal === 0) {
                this.spin -= Math.PI * 2 * delta * 2;
                const fire = new FireBall(this, this.images['mega-fireball'], this.Draw, this.pos.add(this.size.mult(0.5)), this.spin, 500, this.power * 10, true);
                fire.destroy.connect(() => { this.fireballs = this.fireballs.filter(f => f !== fire); });
                this.fireballs.push(fire);
            }
            if (this.spinHeal === 2) {
                this.health += delta * 100;
                this.spin -= Math.PI * 2 * delta * 4;
                const fire = new FireBall(this, this.images['fireball'], this.Draw, this.pos.add(this.size.mult(0.5)), this.spin, 500, this.power * 3, true);
                fire.destroy.connect(() => { this.fireballs = this.fireballs.filter(f => f !== fire); });
                this.fireballs.push(fire);
            }
        }
    }

    reset(pos = new Vector(1920 / 2, 1080 / 2)) {
        this.health = this.twoPlayer ? 50 : 100;
        this.power = 0.2;
        this.anger = 0;
        this.vlos = new Vector(0, 0);
        this.pos = pos;
    }

    draw() {
        let rot = Math.sign(this.vlos.x) * Math.PI / 4 * Math.pow(this.vlos.y, 0.3) / 2;
        if (!this.died) this.Draw.image(this.image, this.pos, this.size, new Vector(Math.sign(this.vlos.x * -1)), rot);
        this.fireballs.forEach(f => { if (f.time > 0) f.draw(); });
    }
}



export class FireBall {
    constructor(dragon,image,draw,pos,rot,speed,power,mega=false){
        this.pos = pos;
        this.dragon = dragon;
        this.vlos = new Vector(1,0).rotate(rot) 
        this.speed = speed;
        this.power = power;
        this.destroy = new Signal()
        this.Draw = draw
        this.time = 0;
        this.rot = rot
        this.size = new Vector(1,1).mult(Math.max(power,1)*50)
        this.image = image
    }
    adiós(reason = ''){
        this.destroy.emit(this)
    }
    update(delta){
        this.time+=delta;
        this.pos.addS(this.vlos.mult(this.speed * delta))
        this.size = new Vector(1,1).mult(Math.min(this.power,5)*50)
        if(!Geometry.rectCollide(Vector.zero(),new Vector(1920,1080),this.pos,this.size)){
            this.adiós()
        }
        this.power-=1*delta;
        if(this.power<=0){
            this.adiós()
        }
    }
    draw(){
        this.Draw.image(this.image,this.pos.sub(this.size.mult(0.5)),this.size,0,this.rot)
    }
}

export class Fragment {
    constructor(draw,pos,size){
        this.pos = pos;
        this.vlos = new Vector((Math.random()-0.5)*10,(Math.random()-0.5)*10)
        this.speed = 100;
        this.rotSpeed = (Math.random()-0.5)*20
        this.destroy = new Signal()
        this.Draw = draw
        this.rot = 0
        this.size = new Vector(1,1).mult(Math.min(2,1)*50).mult(size)
        this.image = new Image()
        this.image.src = 'Assets/fragment.png'
    }
    adiós(){
        this.destroy.emit(this)
    }
    update(delta){
        this.pos.addS(this.vlos.mult(this.speed * delta))
        if(!Geometry.rectCollide(Vector.zero(),new Vector(1920,1080),this.pos,this.size)){
            this.adiós()
        }
        this.rot+=this.rotSpeed
        this.vlos.y+=5*delta
    }
    draw(){
        this.Draw.image(this.image,this.pos.sub(this.size.min(100).mult(0.5)),this.size.min(100),0,this.rot)
    }
}
