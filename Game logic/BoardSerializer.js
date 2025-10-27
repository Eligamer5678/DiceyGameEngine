export default class BoardSerializer {
    // --- 4-bit Tile Encoding ---
    static tileValueToBits = {
        0: 0b0000, 0.2: 0b0001, 0.4: 0b0010, 0.6: 0b0011, 0.8: 0b0100, 1: 0b0101,
        10: 0b0110, 20: 0b0111, 30: 0b1000, 40: 0b1001, 50: 0b1010, 60: 0b1011,
        70: 0b1100, 80: 0b1101, 90: 0b1110, 100: 0b1111
    };
    static bitsToTileValue = [
        0, 0.2, 0.4, 0.6, 0.8, 1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100
    ];

    static encode(board) {
        if(!board) return null;
        const flat = board.flat();
        let bitString = "";
        flat.forEach(val => {
            // Find closest valid value
            let code = BoardSerializer.tileValueToBits.hasOwnProperty(val) ? BoardSerializer.tileValueToBits[val] : BoardSerializer.tileValueToBits[BoardSerializer.findClosestTile(val)];
            bitString += code.toString(2).padStart(4, "0");
        });
        // Pack into bytes
        const bytes = bitString.match(/.{1,8}/g).map(b => parseInt(b.padEnd(8, "0"), 2));
        return btoa(String.fromCharCode(...bytes));
    }

    static decode(encoded, width = 10, height = 20) {
        if(!encoded) return null;
        const binary = atob(encoded)
            .split("")
            .map(c => c.charCodeAt(0).toString(2).padStart(8, "0"))
            .join("");
        const values = [];
        for (let i = 0; i < width * height; i++) {
            const bitSeg = binary.slice(i * 4, (i + 1) * 4);
            const code = parseInt(bitSeg, 2);
            values.push(BoardSerializer.bitsToTileValue[code] ?? 0);
        }
        const board = [];
        for (let y = 0; y < height; y++) {
            board.push(values.slice(y * width, (y + 1) * width));
        }
        return board;
    }

    static findClosestTile(val) {
        // Find closest valid tile value
        const valid = Object.keys(BoardSerializer.tileValueToBits).map(Number);
        return valid.reduce((a, b) => Math.abs(b - val) < Math.abs(a - val) ? b : a);
    }
}
