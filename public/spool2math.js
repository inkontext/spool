const SPMath = {
    // Points

    polarPoint: (center, radius, angle) => {
        return SPTensors.vector([
            center.x + radius * Math.cos(angle),
            center.y + radius * Math.sin(angle),
        ]);
    },

    polarPoints: (count, center, radius = 1, startAngle = 0, angle = 0) => {
        var res = [];
        for (var i = 0; i < count; i++) {
            var point = SPMath.polarPoint(
                center,
                radius,
                (i - (count - 1) / 2) * angle + startAngle
            );
            res.push(point);
        }
        return res;
    },

    rotatePoint: (point, center, angle) => {
        var s = Math.sin(angle);
        var c = Math.cos(angle);
        var n = SPTensors.sub(point, center);
        return SPTensors.vector([
            n.x * c + n.y * s + center.x,
            n.x * s - n.y * c + center.y,
        ]);
    },

    rotatePoints: (points, center, angle) => {
        return points.map((p) => rotatePoint(p, center, angle));
    },

    rotatePolygon: (polygon, center, angle) => {
        let res = polygon.copy();

        let length = res.shape[0];
        for (let i = 0; i < length; i++) {
            var pa = res.subTensor([i]);
            var pb = SPMath.rotatePoint(pa, center, angle);
            res.set(2 * i, pb.x);
            res.set(2 * i + 1, pb.y);
        }
        return res;
    },

    transformPoints: (points, transform) => {
        return points.map((p) => SPTensors.add(p, transform));
    },

    /**
     * Returns the distance between two points
     * @param {TensorBase} a - first point
     * @param {TensorBase} b - second point
     */
    distance: function (a, b) {
        return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
    },

    // Angles

    angleDistance: function (a, b) {
        var dist = (b - a) % (2 * Math.PI);

        if (dist > 0) {
            return dist > Math.PI ? -(2 * Math.PI - dist) : dist;
        } else {
            return dist < -Math.PI ? -(-2 * Math.PI - dist) : dist;
        }
    },

    // Shapes

    point: function (x, y) {
        return SPTensors.vector([x, y]);
    },

    rect: function (x, y, width, height) {
        return SPTensors.vector([x, y, width, height]);
    },

    getRect: function (pointA, pointB) {
        var x = Math.min(pointA.x, pointB.x);
        var y = Math.min(pointA.y, pointB.y);
        var w = Math.abs(pointA.x - pointB.x);
        var h = Math.abs(pointA.y - pointB.y);
        return SPTensors.vector([x, y, w, h]);
    },

    rectToPolygon: function (rect) {
        return SPTensors.tensor(
            [4, 2],
            [
                rect.x,
                rect.y,
                rect.x + rect.width,
                rect.y,
                rect.x + rect.width,
                rect.y + rect.height,
                rect.x,
                rect.y + rect.height,
            ]
        );
    },

    // Collisions

    rectContains: (rect, point) => {
        return (
            rect.x < point.x &&
            point.x < rect.x + rect.width &&
            rect.y < point.y &&
            point.y < rect.y + rect.height
        );
    },

    rectCollision: (a, b) => {
        let c = SPTensors.vector([
            a.x - b.width / 2,
            a.y - b.height / 2,
            a.width + b.width,
            a.height + b.height,
        ]);

        let d = SPTensors.vector([b.x + b.width / 2, b.y + b.height / 2]);
        return SPMath.rectContains(c, d);
    },

    lineIntersection: (a, b) => {
        var x1 = a.x;
        var x2 = a.xx;
        var y1 = a.y;
        var y2 = a.yy;

        var x3 = b.x;
        var x4 = b.xx;
        var y3 = b.y;
        var y4 = b.yy;

        var denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (denominator == 0) return null;

        var xNominator =
            (x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4);
        var yNominator =
            (x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4);

        var px = xNominator / denominator;
        var py = yNominator / denominator;

        var offset = 0;

        if (
            SPMath.inRange(px, x1, x2, offset) &&
            SPMath.inRange(px, x3, x4, offset) &&
            SPMath.inRange(py, y1, y2, offset) &&
            SPMath.inRange(py, y3, y4, offset)
        ) {
            return SPTensors.vector([px, py]);
        } else {
            return null;
        }
    },

    polygonContains: (polygon, point) => {
        var minx = null;
        var miny = null;
        var maxx = null;
        var maxy = null;

        for (var i = 0; i < polygon.shape[0]; i++) {
            var pa = polygon.subTensor([i]);
            if (minx === null || pa.x < minx) {
                minx = pa.x;
            }
            if (miny === null || pa.y < miny) {
                miny = pa.y;
            }
            if (maxx === null || pa.x > maxx) {
                maxx = pa.x;
            }
            if (maxy === null || pa.y > maxy) {
                maxy = pa.y;
            }
        }
        if (
            !SPMath.rectContains(
                SPTensors.vector([minx, miny, maxx - minx, maxy - miny]),
                point
            )
        ) {
            return false;
        }

        var intersections = SPMath.polygonLineIntersection(
            SPTensors.vector([minx - 10, miny - 10, point.x, point.y]),
            polygon
        );

        return intersections.length % 2 == 1;
    },

    polygonLineIntersection: (a, polygon) => {
        var length = polygon.shape[0];
        var res = [];
        for (var i = 0; i < polygon.shape[0]; i++) {
            var pa = polygon.subTensor([i]);
            var pb = polygon.subTensor([(i + 1) % length]);
            var link = SPTensors.link([pa, pb], [2, 2]);
            var intersection = SPMath.lineIntersection(a, link);

            if (intersection) {
                res.push(intersection);
            }
        }
        return res;
    },

    //#endregion GEOMETRY

    /// VECTORS ///

    unitVector: (angle) => {
        return SPTensors.vector([Math.cos(angle), Math.sin(angle)]);
    },

    angleFromVec: (vector) => {
        return Math.atan2(vector.y, vector.x);
    },

    /// GENERATORS ///

    range: function* (start = 0, end = 100, step = 1) {
        let iterationCount = 0;
        for (let i = start; i < end; i += step) {
            iterationCount++;
            yield i;
        }
        return iterationCount;
    },

    /// RANGE ///

    inRange: (val, a, b, offset = 0) => {
        if (a < b) {
            var min = a;
            var max = b;
        } else {
            var min = b;
            var max = a;
        }
        return min - offset <= val && val <= max + offset;
    },

    clamp: (val, minV, maxV) => {
        return Math.max(Math.min(val, maxV), minV);
    },

    /// RANDOM ///

    randRange: (min, max) => {
        return Math.random() * (max - min) + min;
    },

    randPointInRect: (rect) => {
        return SPTensors.vector([
            rect.x + SPMath.randRange(0, rect.width),
            rect.y + SPMath.randRange(0, rect.height),
        ]);
    },

    randPointInRadius: (center, radius) => {
        var angle = SPMath.randRange(0, Math.PI * 2);
        var distance = SPMath.randRange(0, radius);
        console.log(angle, distance);
        return SPMath.polarPoint(center, distance, angle);
    },

    /// FUNCTIONS ///

    sigmoid: (x) => {
        return 1 / (1 + Math.exp(-x));
    },

    posmod: (x, y) => {
        return ((x % y) + y) % y;
    },

    posmodRange: (x, vMin, vMax) => {
        return vMin + SPMath.posmod(x - vMin, vMax - vMin);
    },
};

const basicAliases = {
    x: 0,
    y: 1,
    z: 2,
    w: 3,

    xx: 2,
    yy: 3,

    a: 0,
    b: 1,
    c: 2,
    d: 3,

    width: 2,
    height: 3,
};

//#region TensorBase

function TensorBase(shape) {
    this.shape = shape;
    this.size = SPTensors.getSize(shape);
    this.dimension = SPTensors.getDimensions(shape);
}

TensorBase.prototype.getIndex = function (coords) {
    return this.getIndexAndShape(coords).index;
};

/**
 *
 * @param {list} coords - coords in a shape of an array
 */
TensorBase.prototype.getValue = function (coords) {
    if (typeof coords == "number") {
        coords = [coords];
    }
    const index = this.getIndex(coords);
    return this.get(index);
};

TensorBase.prototype.getValues = function () {
    res = [];
    for (var i = 0; i < this.size; i++) {
        res.push(this.get(i));
    }
    return res;
};

TensorBase.prototype.T = function () {
    if (this.dimension != 2) {
        throw `You can only transpose 2-d tensor, not ${this.dimension}-d`;
    }

    var shape = [this.shape[1], this.shape[0]];

    var res = new SubTensor(self, shape);

    res.get = (i) => {
        var y = Math.floor(i / this.shape[0]);
        var x = i % this.shape[0];

        return this.get(x * this.shape[1] + y);
    };

    return res;
};

TensorBase.prototype.copy = function (f = (x, i) => x) {
    return SPTensors.copy(this, f);
};

TensorBase.prototype.apply = function (f = (x, i) => x) {
    return SPTensors.apply(this, f);
};

TensorBase.prototype.add = function (b) {
    if (typeof b === "number") {
        return this.apply((x) => x + b);
    } else {
        return this.apply((x, i) => x + b.get(i));
    }
};

TensorBase.prototype.sub = function (b) {
    if (typeof b === "number") {
        return this.apply((x) => x - b);
    } else {
        return this.apply((x, i) => x - b.get(i));
    }
};

TensorBase.prototype.mult = function (b) {
    if (typeof b === "number") {
        return this.apply((x) => x * b);
    } else {
        return this.apply((x, i) => x * b.get(i));
    }
};

TensorBase.prototype.div = function (b) {
    if (typeof b === "number") {
        return this.apply((x) => x / b);
    } else {
        return this.apply((x, i) => x / b.get(i));
    }
};

TensorBase.prototype.toString = function () {
    return SPTensors.toString(this);
};

TensorBase.prototype.reshape = function (shape) {
    if (SPTensors.getSize(shape) != this.size) {
        throw new Error(
            `You can't reshape ${this.size} values into ${shape.toString()}`
        );
    }

    this.shape = shape;
    this.dimension = SPTensors.getDimensions(shape);
    return this;
};

TensorBase.prototype.subTensor = function (coords) {
    var newD = this.shape.length - coords.length;
    if (newD < 0) {
        throw `${coords.length} coords for ${shape.length} array`;
    }

    let { index, shape } = this.getIndexAndShape(coords);
    var subSize = SPTensors.getSize(this.shape);

    return new SubTensor(this, shape, index, index + subSize);
};

Object.keys(basicAliases).forEach(function (item) {
    Object.defineProperty(TensorBase.prototype, item, {
        get: function () {
            return this.get(basicAliases[item]);
        },
        set: function (value) {
            return this.set(basicAliases[item], value);
        },
    });
});

//#endregion

//#region Tensor

function Tensor(shape, values = null, fun = () => 0) {
    //// CONSTRUCTOR ////

    TensorBase.call(this, shape);

    this.type = "fixed";
    this.levelSizes = SPTensors.getLevelSizes(shape);

    if (values) {
        if (values.length == this.size) {
            this.values = values;
        } else {
            throw new Error(
                `The size of values (${values.length}) doesn't match the shape of the tensor (${shape})`
            );
        }
    } else {
        this.values = Array.from({ length: this.size }, fun);
    }
}

Tensor.prototype = Object.create(TensorBase.prototype);

Tensor.prototype.get = function (i) {
    return this.values[i];
};

Tensor.prototype.getValues = function () {
    return this.values;
};

Tensor.prototype.set = function (i, value) {
    this.values[i] = value;
    return this.values[i];
};

Tensor.prototype.getIndexAndShape = function (coords) {
    return SPTensors.getIndexAndShape(this.shape, coords, this.levelSizes);
};

//#endregion

//#region VariableTensor

function VariableTensor(shape, values, fun = () => 0) {
    //// CONSTRUCTOR ////

    TensorBase.call(this, shape);

    this.type = "variable";
    this.indexes = SPTensors.getIndexesMap(shape)[0];

    if (values) {
        if (values.length == this.size) {
            this.values = values;
        } else {
            throw new Error(
                `The size of values (${values.length}) doesn't match the shape of the tensor (${shape})`
            );
        }
    } else {
        this.values = Array.from({ length: this.size }, fun);
    }
}

VariableTensor.prototype = Object.create(TensorBase.prototype);

VariableTensor.prototype.get = function (i) {
    return this.values[i];
};

VariableTensor.prototype.set = function (i, value) {
    return (this.values[i] = value);
};

VariableTensor.prototype.getIndexAndShape = function (coords) {
    return SPTensors.getVariableIndexAndShape(this.shape, coords, this.indexes);
};

VariableTensor.prototype.subTensor = function (coords) {
    let { index, shape } = this.getIndexAndShape(coords);
    var size = SPTensors.getSize(this.shape);
    return new SubTensor(this, shape, index, index + size);
};

VariableTensor.prototype.toString = function () {
    var res = "";

    for (var i = 0; i < this.shape.length; i++) {
        res += this.subTensor([i]).toString() + "\n";
    }

    return res;
};

//#endregion

const isVariable = (shape) => {
    if (shape.length > 0) {
        if (shape[0].constructor === Array) {
            return true;
        }
    }
    return false;
};

//#region SubTensors

function SubTensor(parent, shape, start = null, end = null) {
    //// CONSTRUCTOR ////

    TensorBase.call(this, shape);

    this.parent = parent;
    this.start = start;
    this.end = end;
    this.type = "sub";

    if (this.start === null) {
        this.start = 0;
    }

    if (this.end === null) {
        this.end = SPTensors.getSize(shape);
    }

    //// FUNCTIONS ////

    if (isVariable(shape)) {
        this.indexes = SPTensors.getIndexesMap(this.shape)[0];
        this.getIndexAndShape =
            VariableTensor.prototype.getVariableIndexAndShape;
    } else {
        this.levelSizes = SPTensors.getLevelSizes(this.shape);
        this.getIndexAndShape = Tensor.prototype.getVariableIndexAndShape;
    }
}

SubTensor.prototype = Object.create(TensorBase.prototype);

SubTensor.prototype.get = function (i) {
    return this.parent.get(i + this.start);
};

SubTensor.prototype.set = function (i, value) {
    return this.parent.set(i + this.start, value);
};

SubTensor.prototype.subTensor = function (coords) {
    var newD = this.shape.length - coords.length;
    if (newD < 0) {
        throw `${coords.length} coords for ${shape.length} array`;
    }

    let { index, shape } = this.getIndex(coords);
    var subSize = SPTensors.getSize(shape);

    return new SubTensor(
        this.parent,
        shape,
        index + start,
        index + start + subSize
    );
};

SubTensor.prototype.toString = function () {
    return new Tensor(this.shape, null, (v, i) => this.get(i)).toString();
};

//#endregion

//#region LinkTensors

function LinkTensor(tensors, shape) {
    TensorBase.call(this, shape);

    this.sizes = tensors.map((ten) => ten.size);
    this.tensors = tensors;
    this.tensorsNumber = tensors.length;
    this.levelSizes = SPTensors.getLevelSizes(shape);
    this.type = "link";
}

LinkTensor.prototype = Object.create(TensorBase.prototype);

LinkTensor.prototype.getRelevantTensor = function (i) {
    var tenI = 0;
    var tenAcc = 0;

    while (tenAcc + this.sizes[tenI] <= i) {
        tenI += 1;
        tenAcc += this.sizes[tenI];
        if (assert(tenI < this.tensorsNumber, "Index out of range")) {
            return;
        }
    }

    return { ten: this.tensors[tenI], off: i - tenAcc };
};

LinkTensor.prototype.get = function (i) {
    let { ten, off } = this.getRelevantTensor(i);
    return ten.get(off);
};

LinkTensor.prototype.set = function (i, value) {
    let { ten, off } = this.getRelevantTensor(i);
    return ten.set(off);
};

LinkTensor.prototype.getIndexAndShape = function (coords) {
    return SPTensors.getIndexAndShape(this.shape, coords, this.levelSizes);
};

//#endregion

var operations = ["apply", ""];

const SPTensors = {
    //// INITIALIZERS ////

    // COPY //

    apply: (tensor, f = (x, i) => x) => {
        assert(tensor.set && tensor.get, "Not a valid tensor");
        for (var i = 0; i < tensor.size; i++) {
            tensor.set(i, f(tensor.get(i), i));
        }
        return tensor;
    },

    copy: (tensor, f = (x) => x) => {
        assert(tensor.shape && tensor.get, "Not a valid tensor");

        var values = tensor.getValues();
        var newValues = [];

        for (var i = 0; i < values.length; i++) {
            newValues.push(f(values[i], i));
        }
        return new (SPTensors.constructorForShape(tensor.shape))(
            tensor.shape,
            newValues
        );
    },

    tensor: (shape, values, fun) => {
        assert(shape);
        return new (SPTensors.constructorForShape(shape))(shape, values, fun);
    },

    vector: (values) => {
        return new Tensor([values.length], values);
    },

    // CONST //

    const: (shape, value) => {
        return SPTensors.tensor(shape, null, () => {
            value;
        });
    },

    zeros: (shape) => {
        return SPTensors.const(shape);
    },

    ones: (shape) => {
        return SPTensors.const(shape, 1);
    },

    constLike: (tensor, value = 0) => {
        return SPTensors.copy(tensor, () => value);
    },

    zerosLike: (tensor) => {
        return SPTensors.constLike(a);
    },

    onesLike: (tensor) => {
        return SPTensors.constLike(a, 1);
    },

    // RANDOM //

    random: (shape, min = 0, max = 1) => {
        return new (SPTensors.constructorForShape(shape))(shape, null, () =>
            SPMath.randRange(min, max)
        );
    },

    randomIn: (tensors) => {
        var values = [];
        var tValues = tensors.getValues();
        for (var i = 0; i < size; i++) {
            values.push(SPMath.randRange(0, tValues[i]));
        }

        return SPTensors.tensor(tensors.shape, values);
    },

    randomLike: (tensor, min = 0, max = 1) => {
        return SPTensors.copy(tensor, () => SPMath.randRange(min, max));
    },

    // RANGE //

    range: (shape, coef = 1) => {
        return new (SPTensors.constructorForShape(shape))(
            shape,
            null,
            (_, i) => i * coef
        );
    },

    //// OPERATIONS ////

    elementWiseOperation: (tenA, tenB, f, repeat = false) => {
        var values = tenA.getValues();
        if (repeat) {
            return SPTensors.tensor(
                tenA.shape,
                values.map((v, i) => f(v, tenB.get(i % tenB.size)))
            );
        } else {
            assert(
                arraysEqual(tenA.shape, tenB.shape),
                `The shapes of the tensors don't match: ${tenA.shape} != ${tenB.shape}`
            );

            var valuesB = tenB.getValues();
            var valuesC = [];
            for (var i = 0; i < values.length; i++) {
                valuesC.push(f(values[i], valuesB[i]));
            }

            return SPTensors.tensor(tenA.shape, valuesC);
        }
    },

    add: (a, b, repeat = false) => {
        if (typeof b === "number") {
            return SPTensors.copy(a, (a) => a + b);
        } else {
            return SPTensors.elementWiseOperation(
                a,
                b,
                (a, b) => a + b,
                repeat
            );
        }
    },

    sub: (a, b, repeat = false) => {
        if (typeof b === "number") {
            return SPTensors.copy(a, (a) => a - b);
        } else {
            return SPTensors.elementWiseOperation(
                a,
                b,
                (a, b) => a - b,
                repeat
            );
        }
    },

    mult: (a, b, repeat = false) => {
        if (typeof b === "number") {
            return SPTensors.copy(a, (a) => a * b);
        } else {
            return SPTensors.elementWiseOperation(
                a,
                b,
                (a, b) => a * b,
                repeat
            );
        }
    },

    div: (a, b, repeat = false) => {
        if (typeof b === "number") {
            return SPTensors.copy(a, (a) => a * b);
        } else {
            return SPTensors.elementWiseOperation(
                a,
                b,
                (a, b) => a / b,
                repeat
            );
        }
    },

    dot: (a, b, coordsA = [], coordsB = []) => {
        if (a.dimension != 2 && b.dimension != 2) {
            throw new Error(
                `Dot product supports only 2-d tensor dot your (${a.dimension}-d . ${b.dimension}-d)`
            );
        }

        aValues = a.values;
        bValues = b.values;

        let aRes = a.getIndexAndShape(coordsA);
        let aIndex = aRes.index;
        let aShape = aRes.shape;
        var aHeight = aShape[0];
        var aWidth = aShape[1];

        let bRes = b.getIndexAndShape(coordsB);
        let bIndex = bRes.index;
        let bShape = bRes.shape;
        var bHeight = bShape[0];
        var bWidth = bShape[1];

        if (aWidth != bHeight) {
            throw `Shapes of the tensors are not compatible for dot ${aShape} ${bShape}`;
        }

        var resShape = [aHeight, bWidth];

        var values = [];

        for (var y = 0; y < aHeight; y++) {
            for (var x = 0; x < bWidth; x++) {
                var acc = 0;
                for (var i = 0; i < aWidth; i++) {
                    acc +=
                        aValues[aIndex + y * aWidth + i] *
                        bValues[bIndex + i * bWidth + x];
                }
                values.push(acc);
            }
        }

        var res = new Tensor(resShape, values);

        return res;
    },

    /**
     * @param {TensorBase} tensor
     */
    abs: (tensor) => {
        if (tensor.size == 0) {
            return 0;
        }
        var res = 0;
        for (var i = 0; i < tensor.size; i++) {
            res += Math.pow(tensor.getValue(i), 2);
        }

        return Math.sqrt(res);
    },

    //// CONCAT AND LINKING ////

    concat: (tensors, shape) => {
        let values = tensors.map((tensor) => tensor.getValues());
        values = values.flat(1);
        if (shape === undefined) {
            return new VariableTensor(
                tensors.map((tensor) => tensor.shape),
                [].concat(...tensors.map((tensor) => tensor.values))
            );
        } else {
            return new Tensor(shape, values);
        }
    },

    link: (tensors, shape) => {
        return new LinkTensor(tensors, shape);
    },

    //// MISC ////

    constructorForShape: (shape) => {
        var constructor = Tensor;

        if (shape.length > 0) {
            if (shape[0].constructor === Array) {
                constructor = VariableTensor;
            }
        }

        return constructor;
    },

    getIndexAndShape: (shape, coords, levelSizes = null) => {
        var res = 0;

        if (!levelSizes) {
            levelSizes = SPTensors.getLevelSizes(shape);
        }
        coords.forEach((coord, index) => {
            if (SPMath.inRange(coord, 0, shape[index])) {
                res += coord * levelSizes[1 + index];
            } else {
                throw new Error(
                    `${coord} at in depth ${index} is out of range shape - [${shape}]`
                );
            }
        });

        var currentShape = shape.slice(coords.length);

        return { index: res, shape: currentShape };
    },

    getVariableIndexAndShape: (shape, coords, indexes = null) => {
        if (indexes === null) {
            indexes = SPTensors.getIndexesMap(s)[0];
        }

        var currentIndexesContainer = indexes;
        var currentShape = shape;

        var res = { index: currentIndexesContainer[0], shape: currentShape };

        for (var i = 0; i < coords.length; i++) {
            var coord = coords[i];

            currentIndexesContainer = currentIndexesContainer[coord];
            currentShape = currentShape[coord];

            if (currentIndexesContainer.constructor !== Array) {
                var res = SPTensors.getIndexAndShape(
                    currentShape,
                    coords.slice(i + 1)
                );
                res.index += currentIndexesContainer;
                return res;
            } else {
                res = {
                    index: currentIndexesContainer[0],
                    shape: currentShape,
                };
            }
        }

        return res;
    },

    getLevelSizes: (shape) => {
        var levelSizes = [1];
        var size = 1;
        var d = shape.length;

        for (var i = 0; i < d; i++) {
            size *= shape[d - i - 1];
            levelSizes.push(size);
        }

        levelSizes.reverse();

        return levelSizes;
    },

    getSize: (shape) => {
        if (shape.length == 0) {
            return 1;
        }

        if (shape[0].constructor === Array) {
            return shape
                .map((s) => SPTensors.getSize(s))
                .reduce((a, b) => a + b);
        }

        return shape.reduce((a, b) => a * b);
    },

    getIndexesMap: (shape, offset = 0) => {
        return [
            shape.map((value) => {
                if (value[0].constructor === Array) {
                    var map = SPTensors.getIndexesMap(value, offset);
                    offset += map[1];
                    return map[0];
                } else {
                    index = offset;
                    offset += value.reduce((a, b) => a * b);
                    return index;
                }
            }),
            offset,
        ];
    },

    getDimensions: (shape) => {
        return shape.length;
    },

    toFixedSize: (str, size = 6) => {
        var res = str.toString();
        while ((res.length + 1) % size != 0) {
            res += " ";
        }
        return res;
    },

    toString: (tensor, index = 0, depth = 0, start = "") => {
        var res = "";

        var size = tensor.shape.length - depth;
        if (size == 1) {
            res += start;
            for (var i = 0; i < tensor.shape[tensor.shape.length - 1]; i++) {
                var len = 6;
                var sep = ", ";
                if (tensor.dimension < 2) {
                    len = 1;
                }
                if (i == tensor.shape[tensor.shape.length - 1] - 1) {
                    len = 1;
                    sep = "";
                }
                res += SPTensors.toFixedSize(tensor.get(i + index) + sep, len);
            }
        } else {
            if (size != 2) {
                res += start + "[\n";
            }
            for (var i = 0; i < tensor.shape[depth]; i++) {
                var nxt_index =
                    index +
                    i * tensor.shape.slice(depth + 1).reduce((a, b) => a * b);

                var ths_start =
                    size == 2 && i == 0 ? start + "[ " : start + "  ";
                var ths_end =
                    size == 2 && i == tensor.shape[depth] - 1 ? "" : "\n";
                res +=
                    SPTensors.toString(
                        tensor,
                        nxt_index,
                        depth + 1,
                        ths_start
                    ) + ths_end;
            }
            if (size != 2) {
                res += start + "]";
            } else {
                res += " ]";
            }
        }

        return tensor.dimension == 1 ? `[${res}]` : res;
    },
};

try {
    modules.export = {
        SPTensors,
        SPMath,
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
