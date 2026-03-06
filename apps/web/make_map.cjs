const Jimp = require('jimp');

async function run() {
    try {
        const image = await Jimp.read('https://upload.wikimedia.org/wikipedia/commons/c/cd/Land_ocean_ice_2048.jpg');
        image.resize(256, 128); // 2:1 aspect ratio
        image.normalize();

        let mapStr = '';
        for (let y = 0; y < image.bitmap.height; y++) {
            let row = '';
            for (let x = 0; x < image.bitmap.width; x++) {
                const hex = image.getPixelColor(x, y);
                const rgb = Jimp.intToRGBA(hex);
                // Usually ocean is dark blue (brightness < 60), land is brighter.
                const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                row += brightness > 40 ? '1' : '0';
            }
            mapStr += row;
        }

        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let compressed = '';
        for (let i = 0; i < mapStr.length; i += 6) {
            const chunk = mapStr.slice(i, i + 6).padEnd(6, '0');
            const val = parseInt(chunk, 2);
            compressed += chars[val];
        }

        console.log("MAP_DATA:|" + compressed + "|");
    } catch (e) {
        console.error(e);
    }
}
run();
