var Tensor = (shape, values = null, fun = () => 0) => {
    // Init

    var self = {
        shape: shape,
        d: shape.length,
    };

    var levelSize = [1];
    var acc = 1;

    for (var i = 0; i < self.d; i++) {
        acc *= shape[self.d - i - 1];
        levelSize.push(acc);
    }

    self.size = acc;

    levelSize.reverse();
    self.levelSize = levelSize;

    if (values) {
        if (values.length == self.size) {
            self.values = values;
        } else {
            throw "The size of values doesn't match the shape of the tensor";
        }
    } else {
        var size = shape.reduce((a, b) => a * b);
        self.values = Array.from({ length: size }, fun);
    }

    // Getting values

    self.getIndex = (coords) => {
        var res = 0;

        coords.forEach((coord, index) => {
            if (SpoolMath.inRange(coord, 0, shape[index])) {
                res += coord * levelSize[1 + index];
            } else {
                throw `${coord} at ${index}-d is out of range(${shape[index]})`;
            }
        });

        return res;
    };

    self.getValue = (coords) => {
        if (coords.length != shape.length) {
            throw `${coords.length} coords for ${shape.length} array`;
        }

        var index = self.getIndex(coords);

        return values[index];
    };

    self.subTensor = (coords) => {
        var newD = shape.length - coords.length;
        if (newD < 0) {
            throw `${coords.length} coords for ${shape.length} array`;
        }

        var index = self.getIndex(coords);

        var subSize = self.levelSize[self.d - newD];
        var subShape = self.shape.slice(self.d - newD);

        return Tensor(subShape, self.values.slice(index, index + subSize));
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

    elementViseOperation: (a, b, f) => {
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
        return SpoolTensors.elementViseOperation(a, b, (a, b) => a + b);
    },

    sub: (a, b) => {
        return SpoolTensors.elementViseOperation(a, b, (a, b) => a - b);
    },

    mult: (a, b) => {
        return SpoolTensors.elementViseOperation(a, b, (a, b) => a * b);
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
