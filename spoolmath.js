const SpoolMath = {
    coordVelsFromVel: (vel, angle) => {
        return {
            x: Math.cos(angle) * vel,
            y: Math.sin(angle) * vel
        };
    },

    globalAngle: (x1, y1, x2, y2) => {
        return Math.atan2((y2 - y1), (x2 - x1));
    },

    objGlobalAngle: (a, b) => {
        return this.globalAngle(a.x, a.y, b.x, b.y);
    },

    distance: (x1, y1, x2, y2) => {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    },

    objDistance: (a, b) => {
        return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
    },

    polarPoint: (x, y, distance, angle) => {
        return {
            x: x + distance * Math.cos(angle),
            y: y + distance * Math.sin(angle)
        }
    },

    randomColor: (min, max) => {
        return `rgb(${Math.floor(Math.random() * (max - min) + min)},${Math.floor(Math.random() * (max - min) + min)},${Math.floor(Math.random() * (max - min) + min)})`
    },

    randomHsvColor: (sat, val) => {
        return SpoolMath.HSVtoColor(Math.random(), sat, val);
    },

    HSVtoColor: (h, s, v) => {
        let {
            r,
            g,
            b
        } = SpoolMath.HSVtoRGB(h, s, v);
        return `rgb(${r}, ${g}, ${b})`
    },

    HSVtoRGB: (h, s, v) => {
        var r, g, b, i, f, p, q, t;
        if (arguments.length === 1) {
            s = h.s, v = h.v, h = h.h;
        }
        i = Math.floor(h * 6);
        f = h * 6 - i;
        p = v * (1 - s);
        q = v * (1 - f * s);
        t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0:
                r = v, g = t, b = p;
                break;
            case 1:
                r = q, g = v, b = p;
                break;
            case 2:
                r = p, g = v, b = t;
                break;
            case 3:
                r = p, g = q, b = v;
                break;
            case 4:
                r = t, g = p, b = v;
                break;
            case 5:
                r = v, g = p, b = q;
                break;
        }
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    },

    //// LERP ////

    lerp: (start, end, t) => {
        t = t > 1 ? 1 : t < 0 ? 0 : t;
        return start + ((end - start) * t);
    },

    lerpRotation: (start, end, t) => {
        var shortest_angle = ((((end - start) % (Math.PI * 2)) + 540 * (Math.PI / 180)) % (Math.PI * 2)) - Math.PI;
        return start + (shortest_angle * t) % (Math.PI * 2);
    },

    //// RANDOM ////

    randomInt: (min, max) => {
        return min + Math.round(Math.random() * (max - min));
    },

    randomChoice: (array) => {
        if (array.length == 0) {
            return null;
        }
        return array[SpoolMath.randomInt(0, array.length - 1)];
    },

    //// INTERVAL ////

    toHex: num => {
        var hex = Number(num).toString(16);
        if (hex.length < 2) {
            hex = "0" + hex;
        }
        return hex;
    },

    rgbToHex: (r, g, b) => {
        return SpoolMath.toHex(r) + SpoolMath.toHex(g) + SpoolMath.toHex(b);
    },

    divideColor: (color, d) => {
        elements = color.substring(4).split(',');
        console.log(elements);
        for (var i = 0; i < elements.length; i++) {
            console.log();
            elements[i] = parseInt(parseInt(elements[i]) / d);
        }
        console.log(elements);
        return SpoolMath.rgbToHex(elements[0], elements[1], elements[2]);
    },

    inInterval: (val, a, b, offset = 0) => {
        if (a < b) {
            var min = a;
            var max = b;
        } else {
            var min = b;
            var max = a;
        }
        return min - offset <= val && val <= max + offset;
    },

    numberDefined: (x) => {
        if (x !== undefined && x !== null) {
            return true
        } else {
            return false
        }
    }
}

var SpoolRect = (x, y, width, height) => {
    return {
        x: x,
        y: y,
        width: width,
        height: height,
        cx: x + width / 2,
        cy: y + height / 2
    }
}


module.exports = {
    SpoolMath,
    SpoolRect
}