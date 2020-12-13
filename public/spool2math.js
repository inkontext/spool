const SpoolMath = {
    // GEOMETRY

    polarPoint: (center, radius, angle) => {
        return SpoolTensors.vector([
            center.x + radius * Math.cos(angle),
            center.y + radius * Math.sin(angle),
        ]);
    },

    rotatePoint: (point, center, angle) => {
        var s = Math.sin(angle);
        var c = Math.cos(angle);
        var n = SpoolTensors.sub(point, center);
        return SpoolTensors.vector([
            n.x * c - n.y * s + center.x,
            n.x * s - n.y * c + center.y,
        ]);
    },

    rotatePoints: (points, center, angle) => {
        return points.map((p) => rotatePoint(p, center, angle));
    },

    transformPoints: (points, transform) => {
        return points.map((p) => SpoolTensors.add(p, transform));
    },

    distance: function (a, b) {
        return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
    },

    angleDistance: function (a, b) {
        var dist = (b - a) % (2 * Math.PI);

        if (dist > 0) {
            return dist > Math.PI ? -(2 * Math.PI - dist) : dist;
        } else {
            return dist < -Math.PI ? -(-2 * Math.PI - dist) : dist;
        }
    },
};
