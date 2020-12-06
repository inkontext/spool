const SpoolMath = {
    coordVelsFromVel: (vel, angle) => {
        return {
            x: Math.cos(angle) * vel,
            y: Math.sin(angle) * vel,
        };
    },

    globalAngle: (x1, y1, x2, y2) => {
        return Math.atan2(y2 - y1, x2 - x1);
    },

    objGlobalAngle: (a, b) => {
        return this.globalAngle(a.x, a.y, b.x, b.y);
    },

    angleDistance: (a, b) => {
        var dist = (b - a) % (2 * Math.PI);

        if (dist > 0) {
            return dist > Math.PI ? -(2 * Math.PI - dist) : dist;
        } else {
            return dist < -Math.PI ? -(-2 * Math.PI - dist) : dist;
        }
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
            y: y + distance * Math.sin(angle),
        };
    },

    rotatePoint: (x, y, cx, cy, angle) => {
        var s = Math.sin(angle);
        var c = Math.cos(angle);
        x -= cx;
        y -= cy;
        return {
            x: x * c - y * s + cx,
            y: x * s + y * c + cy,
        };
    },

    rotatePoints: (points, cx, cy, angle) => {
        var s = Math.sin(angle);
        var c = Math.cos(angle);

        var res = [];

        for (var i = 0; i < points.length; i++) {
            var x = points[i][0] - cx;
            var y = points[i][1] - cy;
            res.push([x * c - y * s + cx, x * s + y * c + cy]);
        }

        return res;
    },

    transformPoints: (points, tx, ty) => {
        var res = [];

        for (var i = 0; i < points.length; i++) {
            res.push([points[i][0] + tx, points[i][1] + ty]);
        }

        return res;
    },

    randRange: (min, max) => {
        return Math.random() * (max - min) + min;
    },

    randomColor: (min, max) => {
        return `rgb(${Math.floor(
            Math.random() * (max - min) + min
        )},${Math.floor(Math.random() * (max - min) + min)},${Math.floor(
            Math.random() * (max - min) + min
        )})`;
    },

    randomHsvColor: (sat, val) => {
        return SpoolMath.HSVtoColor(Math.random(), sat, val);
    },

    HSVtoColor: (h, s, v) => {
        let { r, g, b } = SpoolMath.HSVtoRGB(h, s, v);
        return `rgb(${r}, ${g}, ${b})`;
    },

    HSVtoRGB: (h, s = null, v = null) => {
        var r, g, b, i, f, p, q, t;
        if (h && !s && !v) {
            (s = h.s), (v = h.v), (h = h.h);
        }
        i = Math.floor(h * 6);
        f = h * 6 - i;
        p = v * (1 - s);
        q = v * (1 - f * s);
        t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0:
                (r = v), (g = t), (b = p);
                break;
            case 1:
                (r = q), (g = v), (b = p);
                break;
            case 2:
                (r = p), (g = v), (b = t);
                break;
            case 3:
                (r = p), (g = q), (b = v);
                break;
            case 4:
                (r = t), (g = p), (b = v);
                break;
            case 5:
                (r = v), (g = p), (b = q);
                break;
        }
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255),
        };
    },

    //// LERP ////

    lerp: (start, end, t) => {
        t = t > 1 ? 1 : t < 0 ? 0 : t;
        return start + (end - start) * t;
    },

    lerpRotation: (start, end, t) => {
        var shortest_angle =
            ((((end - start) % (Math.PI * 2)) + 540 * (Math.PI / 180)) %
                (Math.PI * 2)) -
            Math.PI;
        return start + ((shortest_angle * t) % (Math.PI * 2));
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

    toHex: (num) => {
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
        elements = color.substring(4).split(",");
        for (var i = 0; i < elements.length; i++) {
            elements[i] = parseInt(parseInt(elements[i]) / d);
        }
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

    inRange: (val, a, b) => {
        return a <= val && val < b;
    },

    numberDefined: (x) => {
        if (x !== undefined && x !== null) {
            return true;
        } else {
            return false;
        }
    },

    getYFromCircle: (inX, r) => {
        if (inX <= r && inX >= -r) {
            var y = Math.sqrt(Math.pow(r, 2) - Math.pow(inX, 2));
        }
        return -y;
    },

    getYFromMovedCircle: (x, y, inX, r) => {
        movY = SpoolMath.getYFromCircle(inX, r) + y;
        movX = inX + x;
        pos = [movX, movY];
        return pos;
    },

    getAngleFromCircle: (radius, inX) => {
        var angle = Math.acos(inX / radius) - Math.PI / 2;
        return angle;
    },

    rectangleMouseCollision: (Ax, Ay, width, height, mouseX, mouseY) => {
        if (
            mouseX >= Ax &&
            mouseX <= Ax + width &&
            mouseY <= Ay &&
            mouseY >= Ay - height
        ) {
            return true;
        } else {
            return false;
        }
    },

    rotatePoint: (Sx, Sy, Px, Py, angle) => {
        var radius = SpoolMath.distance(Sx, Sy, Px, Py);
        var newAngle = SpoolMath.globalAngle(Sx, -Sy, Px, -Py) - angle;
        var newX = Math.cos(newAngle) * radius + Sx;
        var newY = -Math.sin(newAngle) * radius + Sy;
        pos = [newX, newY];
        return pos;
    },

    // VECTOR MATH

    getUnitVector: (angle) => {
        return [Math.cos(angle), Math.sin(angle)];
    },

    scaleVector: (vector, scale) => {
        return vector.map((value) => value * scale);
    },

    addVectors: (a, b) => {
        res = [];

        for (var i = 0; i < a.length; i++) {
            res.push(a[i] + b[i]);
        }

        return res;
    },

    averageVectors: (list) => {
        if (list.length == 0) {
            return null;
        }

        temp = list[0];

        for (var i = 1; i < list.length; i++) {
            temp = SpoolMath.addVectors(temp, list[i]);
        }

        return SpoolMath.scaleVector(temp, 1 / list.length);
    },

    average: (list) => {
        if (list.length == 0) {
            return 0;
        }

        var total = 0;
        for (var i = 0; i < list.length; i++) {
            total += list[i];
        }
        return total / list.length;
    },

    weightedAverage: (list, weights) => {
        var total = 0;
        var totalWeights = 0;

        for (var i = 0; i < list.length; i++) {
            total += list[i] * weights[i];
            totalWeights += weights[i];
        }

        if (totalWeights == 0) {
            return 0;
        }

        return total / totalWeights;
    },

    sigmoid: (x) => {
        return 1 / (1 + Math.exp(-x));
    },
};

var SpoolRect = (x, y, width, height) => {
    var self = {
        x: x,
        y: y,
        xx: x + width,
        yy: y + height,
        width: width,
        height: height,
        cx: x + width / 2,
        cy: y + height / 2,
    };

    self.contains = (ax, ay) => {
        return self.x <= ax && ax <= self.xx && self.y <= ay && ay <= self.yy;
    };
    self.collision = (other) => {
        return (
            ((self.x <= other.x && other.x <= self.xx) ||
                (self.x <= other.xx && other.xx <= self.xx)) &&
            ((self.y <= other.y && other.y <= self.yy) ||
                (self.y <= other.yy && other.yy <= self.yy))
        );
    };

    return self;
};

var RadiusRect = (x, y, radx, rady) => {
    return SpoolRect(x - radx, y - rady, radx * 2, rady * 2);
};

try {
    module.exports = {
        SpoolMath,
        SpoolRect,
        RadiusRect,
    };
} catch (e) {
    if (typeof module === "undefined") {
        console.log(
            "Modules are not present, you are probably on client, make sure this script is included before the files that require it"
        );
    } else {
        console.error(e);
    }
}
