const getIndex = (shape, coords, levelSizes = null) => {
    var res = 0;

    if (!levelSizes) {
        levelSizes = getLevelSizes(shape);
    }

    console.log(shape, coords, levelSizes);

    coords.forEach((coord, index) => {
        if (SpoolMath.inRange(coord, 0, shape[index])) {
            res += coord * levelSizes[1 + index];
        } else {
            throw `${coord} at ${index}-d is out of range(${shape[index]})`;
        }
    });

    var currentShape = shape.slice(coords.length);

    console.log(res, currentShape);

    return { index: res, shape: currentShape };
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

var Tensor = (shape, values = null, fun = () => 0) => {
    // Init

    var self = {
        shape: shape,
        d: shape.length,
    };

    self.size = getSize(shape);
    self.levelSizes = getLevelSizes(shape);

    if (values) {
        if (values.length == self.size) {
            self.values = values;
        } else {
            throw `The size of values (${values.length}) doesn't match the shape of the tensor (${shape})`;
        }
    } else {
        var size = shape.reduce((a, b) => a * b);
        self.values = Array.from({ length: size }, fun);
    }

    // Getting values
    self.getIndex = (coords) => {
        return getIndex(self.shape, coords);
    };

    self.getValue = (coords) => {
        if (coords.length != shape.length) {
            throw `${coords.length} coords for ${shape.length} array`;
        }

        let { index } = self.getIndex(coords);

        return values[index];
    };

    self.subTensor = (coords) => {
        var newD = self.shape.length - coords.length;
        if (newD < 0) {
            throw `${coords.length} coords for ${shape.length} array`;
        }

        let { index, shape } = self.getIndex(coords);
        var subSize = getSize(shape);

        return Tensor(shape, self.values.slice(index, index + subSize));
    };

    self.toString = () => {
        if (self.d == 0) {
            if (self.values.length == 1) {
                return self.values[0];
            } else {
                return "";
            }
        }

        if (self.d == 1) {
            return "[" + self.values.toString() + "]";
        }

        var res = "";
        for (var i = 0; i < self.shape[0]; i++) {
            res += self.subTensor([i]).toString() + "\n";
        }

        return res;
    };

    return self;
};

var VariableTensor = (shape, values) => { 
    var self = {
        shape: shape,
    };

    self.indexes = getIndexesMap(shape)[0];

    self.values = values;

    self.getIndex = (coords) => {
        var currentIndexesContainer = self.indexes;
        var currentShape = self.shape;

        var res = { index: currentIndexesContainer[0], shape: currentShape };

        for (var i = 0; i < coords.length; i++) {
            var coord = coords[i];

            currentIndexesContainer = currentIndexesContainer[coord];
            currentShape = currentShape[coord];

            if (currentIndexesContainer.constructor !== Array) {
                var res = getIndex(currentShape, coords.slice(i + 1));
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

    self.subTensor = (coords) => {
        let { index, shape } = self.getIndex(coords);

        var constructor = Tensor;

        if (shape.length > 0) {
            if (shape[0].constructor === Array) {
                constructor = VariableTensor;
            }
        }

        var size = getSize(shape);

        return constructor(shape, self.values.slice(index, index + size));
    };

    self.toString = () => {
        var res = "";

        for (var i = 0; i < self.shape.length; i++) {
            res += self.subTensor([i]).toString() + "\n";
        }

        return res;
    };

    return self;
};

var SubTensor = (parent, shape, start, end) => {
    var self = {
        parent: parent,
        shape: shape,
        start: start,
        end: end,
    };

    self.get = (index) => {
        return parent.get(index + start);
    };
};

var SpoolTensors = {
    //// INITIALIZERS ////

    const: (shape, value) => {
        return Tensor(shape, null, () => value);
    },

    zeros: (shape) => {
        return SpoolTensors.const(shape);
    },

    ones: (shape) => {
        return SpoolTensors.const(shape, 1);
    },

    constLike: (a, value = 0) => {
        return SpoolTensors.apply(a, () => value);
    },

    zerosLike: (a) => {
        return SpoolTensors.constLike(a);
    },

    onesLike: (a) => {
        return SpoolTensors.constLike(a, 1);
    },

    randomLike: (a, min = 0, max = 1) => {
        return SpoolTensors.apply(a, () => SpoolMath.randRange(min, max));
    },

    random: (shape, min = 0, max = 1) => {
        return Tensor(shape, null, () => SpoolMath.randRange(min, max));
    },

    apply: (a, f) => {
        return Tensor(a.shape, null, (v, i) => f(a.values[i]));
    },

    elementWiseOperation: (a, b, f) => {
        if (!SpoolUtils.arraysEqual(a.shape, b.shape)) {
            throw `The shapes of the tensors don't match: ${a.shape} != ${b.shape}`;
        }

        var c = Tensor(a.shape);

        for (var i = 0; i < a.size; i++) {
            c.values[i] = f(a.values[i], b.values[i]);
        }

        return c;
    },

    range: (shape, coef = 1) => {
        return Tensor(shape, null, (v, i) => i * coef);
    },

    add: (a, b) => {
        return SpoolTensors.elementWiseOperation(a, b, (a, b) => a + b);
    },

    sub: (a, b) => {
        return SpoolTensors.elementWiseOperation(a, b, (a, b) => a - b);
    },

    mult: (a, b) => {
        return SpoolTensors.elementWiseOperation(a, b, (a, b) => a * b);
    },

    dot: (a, b, coordsA = [], coordsB = []) => {
        aValues = a.values;
        bValues = b.values;

        let aRes = a.getIndex(coordsA);
        let aIndex = aRes.index;
        let aShape = aRes.shape;
        var aHeight = aShape[0];
        var aWidth = aShape[1];

        let bRes = b.getIndex(coordsB);
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

        console.log(resShape, values);

        return Tensor(resShape, values);
    },

    concat: (tensors) => {
        console.log(tensors.map((tensor) => tensor.values));

        return VariableTensor(
            tensors.map((tensor) => tensor.shape),
            [].concat(...tensors.map((tensor) => tensor.values))
        );
    },
};

try {
    modules.export = {
        SpoolTensors,
    };
} catch {
    if (typeof module === "undefined") {
        console.log(
            "Modules are not present, you are probably on client, make sure this script is included before the files that require it"
        );
    } else {
        console.error(e);
    }
}
