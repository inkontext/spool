const basicAliases = {
    x: 0,
    y: 1,
    z: 2,
    w: 3,

    a: 0,
    b: 1,
    c: 2,
    d: 3,

    width: 2,
    height: 3,
};

const getIndexAndShape = (shape, coords, levelSizes = null) => {
    var res = 0;

    if (!levelSizes) {
        levelSizes = getLevelSizes(shape);
    }

    coords.forEach((coord, index) => {
        if (SpoolMath.inRange(coord, 0, shape[index])) {
            res += coord * levelSizes[1 + index];
        } else {
            throw `${coord} at ${index}-d is out of range(${shape[index]})`;
            console.trace();
        }
    });

    var currentShape = shape.slice(coords.length);

    return { index: res, shape: currentShape };
};

const getVariableIndexAndShape = (s, coords, indexes = null) => {
    if (indexes === null) {
        indexes = getIndexesMap(s)[0];
    }

    var currentIndexesContainer = indexes;
    var currentShape = s;

    var res = { index: currentIndexesContainer[0], shape: currentShape };

    for (var i = 0; i < coords.length; i++) {
        var coord = coords[i];

        currentIndexesContainer = currentIndexesContainer[coord];
        currentShape = currentShape[coord];

        if (currentIndexesContainer.constructor !== Array) {
            var res = getIndexAndShape(currentShape, coords.slice(i + 1));
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
};

const getLevelSizes = (shape) => {
    var levelSizes = [1];
    var size = 1;
    var d = shape.length;

    for (var i = 0; i < d; i++) {
        size *= shape[d - i - 1];
        levelSizes.push(size);
    }

    levelSizes.reverse();

    return levelSizes;
};

const getSize = (shape) => {
    if (shape.length == 0) {
        return 1;
    }

    if (shape[0].constructor === Array) {
        return shape.map((s) => getSize(s)).reduce((a, b) => a + b);
    }

    return shape.reduce((a, b) => a * b);
};

const getIndexesMap = (shape, offset = 0) => {
    return [
        shape.map((value) => {
            if (value[0].constructor === Array) {
                var map = getIndexesMap(value, offset);
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
};

const getDimensions = (shape) => {
    return shape.length;
};

const toFixedSize = (str, size = 6) => {
    var res = str.toString();
    while ((res.length + 1) % size != 0) {
        res += " ";
    }
    return res;
};

const toString = (tensor, index = 0, depth = 0, start = "") => {
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
            res += toFixedSize(tensor.get(i + index) + sep, len);
        }
    } else {
        if (size != 2) {
            res += start + "[\n";
        }
        for (var i = 0; i < tensor.shape[depth]; i++) {
            var nxt_index =
                index +
                i * tensor.shape.slice(depth + 1).reduce((a, b) => a * b);

            var ths_start = size == 2 && i == 0 ? start + "[ " : start + "  ";
            var ths_end = size == 2 && i == tensor.shape[depth] - 1 ? "" : "\n";
            res += toString(tensor, nxt_index, depth + 1, ths_start) + ths_end;
        }
        if (size != 2) {
            res += start + "]";
        } else {
            res += " ]";
        }
    }

    return tensor.dimension == 1 ? `[${res}]` : res;
};

//// TENSOR BASE

function TensorBase(shape) {
    this.shape = shape;
    this.size = getSize(shape);
    this.dimension = getDimensions(shape);
}

TensorBase.prototype.getIndex = function (coords) {
    return this.getIndexAndShape(coords).index;
};

TensorBase.prototype.getValue = function (coords) {
    const index = this.getIndex(coords);
    return this.get(index);
};

TensorBase.prototype.T = function () {
    if (this.dimension != 2) {
        throw `You can only transpose 2-d tensor, not ${this.d}-d`;
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

TensorBase.prototype.toString = function () {
    return toString(this);
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

function Tensor(shape, values = null, fun = () => 0) {
    //// CONSTRUCTOR ////

    TensorBase.call(this, shape);

    this.type = "fixed";
    this.levelSizes = getLevelSizes(shape);

    if (values) {
        if (values.length == this.size) {
            this.values = values;
        } else {
            throw `The size of values (${values.length}) doesn't match the shape of the tensor (${shape})`;
        }
    } else {
        this.values = Array.from({ length: this.size }, fun);
    }
}

Tensor.prototype = Object.create(TensorBase.prototype);

Tensor.prototype.get = function (i) {
    return this.values[i];
};

Tensor.prototype.set = function (i, value) {
    this.values[i] = value;
    return this.values[i];
};

Tensor.prototype.getIndexAndShape = function (coords) {
    return getIndexAndShape(this.shape, coords, this.levelSizes);
};

Tensor.prototype.subTensor = function (coords) {
    var newD = this.shape.length - coords.length;
    if (newD < 0) {
        throw `${coords.length} coords for ${shape.length} array`;
    }

    let { index, shape } = this.getIndexAndShape(coords);
    var subSize = getSize(this.shape);

    return new SubTensor(this, shape, index, index + subSize);
};

function VariableTensor(shape, values, fun = () => 0) {
    //// CONSTRUCTOR ////

    TensorBase.call(this, shape);

    this.type = "variable";
    this.indexes = getIndexesMap(shape)[0];

    if (values) {
        if (values.length == this.size) {
            this.values = values;
        } else {
            throw `The size of values (${values.length}) doesn't match the shape of the tensor (${shape})`;
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
    return getVariableIndexAndShape(this.shape, coords, this.indexes);
};

VariableTensor.prototype.subTensor = function (coords) {
    let { index, shape } = this.getIndexAndShape(coords);
    var size = getSize(this.shape);
    return new SubTensor(this, shape, index, index + size);
};

VariableTensor.prototype.toString = function () {
    var res = "";

    for (var i = 0; i < this.shape.length; i++) {
        res += this.subTensor([i]).toString() + "\n";
    }

    return res;
};

const isVariable = (shape) => {
    if (shape.length > 0) {
        if (shape[0].constructor === Array) {
            return true;
        }
    }
    return false;
};

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
        this.end = getSize(shape);
    }

    //// FUNCTIONS ////

    if (isVariable(shape)) {
        this.indexes = getIndexesMap(this.shape)[0];
        this.getIndexAndShape =
            VariableTensor.prototype.getVariableIndexAndShape;
    } else {
        this.levelSizes = getLevelSizes(this.shape);
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
    var subSize = getSize(shape);

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

var operations = ["apply", ""];

var SPTensors = {
    //// INITIALIZERS ////

    // COPY //

    apply: (a, f = (x, i) => x) => {
        for (var i = 0; i < a.size; i++) {
            a.set(i, f(a.get(i), i));
        }
        return a;
    },

    copy: (a, f = (x) => x) => {
        return new (SPTensors.constructorForShape(a.shape))(
            a.shape,
            null,
            (v, i) => f(a.get(i))
        );
    },

    tensor: (shape, values, fun) => {
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

    constLike: (a, value = 0) => {
        return SPTensors.copy(a, () => value);
    },

    zerosLike: (a) => {
        return SPTensors.constLike(a);
    },

    onesLike: (a) => {
        return SPTensors.constLike(a, 1);
    },

    // RANDOM //

    random: (shape, min = 0, max = 1) => {
        return new Tensor(shape, null, () => SpoolMath.randRange(min, max));
    },

    randomLike: (a, min = 0, max = 1) => {
        return SPTensors.copy(a, () => SpoolMath.randRange(min, max));
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

    elementWiseOperation: (a, b, f) => {
        if (!SpoolUtils.arraysEqual(a.shape, b.shape)) {
            throw new Error(
                `The shapes of the tensors don't match: ${a.shape} != ${b.shape}`
            );
        }

        return SPTensors.tensor(a.shape, null, (_, i) => f(a.get(i), b.get(i)));
    },

    add: (a, b) => {
        if (typeof b === "number") {
            return SPTensors.copy(a, (a) => a + b);
        } else {
            return SPTensors.elementWiseOperation(a, b, (a, b) => a + b);
        }
    },

    sub: (a, b) => {
        if (typeof b === "number") {
            return SPTensors.copy(a, (a) => a - b);
        } else {
            return SPTensors.elementWiseOperation(a, b, (a, b) => a - b);
        }
    },

    mult: (a, b) => {
        if (typeof b === "number") {
            return SPTensors.copy(a, (a) => a * b);
        } else {
            return SPTensors.elementWiseOperation(a, b, (a, b) => a * b);
        }
    },

    dot: (a, b, coordsA = [], coordsB = []) => {
        if (a.dimension != 2 && b.dimension != 2) {
            throw `Dot product supports only 2-d tensor dot your (${a.d}d . ${b.d})`;
            console.trace();
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

    concat: (tensors) => {
        return new VariableTensor(
            tensors.map((tensor) => tensor.shape),
            [].concat(...tensors.map((tensor) => tensor.values))
        );
    },

    constructorForShape: (shape) => {
        var constructor = Tensor;

        if (shape.length > 0) {
            if (shape[0].constructor === Array) {
                constructor = VariableTensor;
            }
        }

        return constructor;
    },
};

try {
    modules.export = {
        SPTensors,
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
