import Vector from "../js/Vector.js";

export const Tetrominos = {
    'I':{
        'offset': new Vector(0.5,0.5),  // center the rotation like standard Tetris
        'tiles': [new Vector(-1.5,0.5), new Vector(-0.5,0.5), new Vector(0.5,0.5), new Vector(1.5,0.5)]
    },
    'O':{
        'offset': new Vector(0.5,0.5),
        'tiles': [new Vector(-0.5,-0.5),new Vector(0.5,0.5),new Vector(-0.5,0.5),new Vector(0.5,-0.5)]
    },
    'Z':{
        'offset': new Vector(0,0),
        'tiles': [new Vector(0,0),new Vector(0,1),new Vector(-1,1),new Vector(1,0)]
    },
    'S':{
        'offset': new Vector(0,0),
        'tiles': [new Vector(0,0),new Vector(0,1),new Vector(1,1),new Vector(-1,0)]
    },
    'T':{
        'offset': new Vector(0,0),
        'tiles': [new Vector(0,0),new Vector(-1,0),new Vector(1,0),new Vector(0,1)]
    },
    'L':{
        'offset': new Vector(0,0),
        'tiles': [new Vector(0,0),new Vector(-1,0),new Vector(1,0),new Vector(1,1)]
    },
    'J':{
        'offset': new Vector(0,0),
        'tiles': [new Vector(0,0),new Vector(-1,0),new Vector(1,0),new Vector(-1,1)]
    },
}

export class Tetromino {
    constructor(type = '', data, seed = null) {
        this.data = null;
        // Improved seeded random generator (xmur3 + mulberry32)
        function xmur3(str) {
            for(var i = 0, h = 1779033703 ^ str.length; i < str.length; i++)
                h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
            h = h << 13 | h >>> 19;
            return function() {
                h = Math.imul(h ^ (h >>> 16), 2246822507);
                h = Math.imul(h ^ (h >>> 13), 3266489909);
                h ^= h >>> 16;
                return h >>> 0;
            }
        }
        function mulberry32(a) {
            return function() {
                var t = a += 0x6D2B79F5;
                t = Math.imul(t ^ t >>> 15, t | 1);
                t ^= t + Math.imul(t ^ t >>> 7, t | 61);
                return ((t ^ t >>> 14) >>> 0) / 4294967296;
            }
        }
        if (type === 'random' || type === '') {
            if (seed !== null) {
                // Use improved seeded random
                let seedStr = String(seed);
                let seedFn = xmur3(seedStr);
                let rand = mulberry32(seedFn());
                const index = Math.floor(rand() * 7);
                type = ['I', 'O', 'T', 'J', 'L', 'S', 'Z'][index];
            } else {
                type = ['I', 'O', 'T', 'J', 'L', 'S', 'Z'][Math.floor(Math.random() * 7)];
            }
        }
        if (type === 'custom') {
            this.data = data;
        } else {
            this.data = structuredClone(Tetrominos[type]);
        }
        this.pos = new Vector(4, 1);
        this.rotation = 0;
        this.type = type;
        this.seed = seed;
    }
    getPositions(dir=0){
        return structuredClone(this.data['tiles']).map((e)=>{return new Vector(e.x,e.y).rotate(dir*Math.PI/2+this.rotation).add(this.data['offset']).add(this.pos)})
    }
    rotate(dir=1){
        this.rotation += dir * Math.PI/2;
    }
}