import Vector from "../js/Vector.js";
import Color from "../js/Color.js";

export class Particle {
    constructor(draw, pos, vel, size = 8, color = null) {
        this.pos = pos.clone();
        this.vel = vel.clone();
        this.size = size;
        this.opacity = 0;
        this.color = color || new Color(Math.random(), Math.random(), Math.random(), this.opacity);
        this.life = 1 + Math.random() * 10;
        this.age = 0;
        this.Draw = draw;
    }
    update(delta) {
        this.pos.addS(this.vel.mult(delta));
        this.age += delta;
        // Fade in for first 20%, fade out for last 80%
        const maxOpacity = 0.6;
        const fadeInFrac = 0.2;
        if (this.age < this.life * fadeInFrac) {
            // Fade in
            this.opacity = maxOpacity * (this.age / (this.life * fadeInFrac));
        } else {
            // Fade out
            const fadeOutAge = this.age - this.life * fadeInFrac;
            const fadeOutLife = this.life * (1 - fadeInFrac);
            this.opacity = maxOpacity * Math.max(0.001, 1 - fadeOutAge / fadeOutLife);
        }
        this.color.d = this.opacity;
        if(this.color.d>0.6) this.d=0.6;
    }
    isAlive() {
        return this.age < this.life;
    }
    draw() {
        if(this.age<0.01) return;
        this.Draw.circle(this.pos, this.size, this.color, true);
    }
}
