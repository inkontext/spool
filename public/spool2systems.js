//#region Components

const Transform = defineComponent("tran", (pos) => ({
    pos: SPTensors.vector(pos),
    rot: 0,
}));

const Movement = defineComponent("mov", (vel = [0, 0], acc = [0, 0]) => ({
    acc: SPTensors.vector(acc),
    vel: SPTensors.vector(vel),
}));

const RigidBody = defineComponent(
    "rig",
    (rad, shape = "aabb", polygon = null) => ({
        rad: SPTensors.vector(rad),
        shape: shape,
        polygon: polygon ? polygon.copy((x, i) => x * rad[i % 2]) : null,
    })
);

const Meta = defineComponent("meta", (type) => ({
    type,
}));

const DNNComponent = defineComponent(
    "dnn",
    (input, hiddenLayerNumber, hiddenLayerSize, output, values = null) => ({
        network: new dnn(
            input,
            hiddenLayerSize,
            hiddenLayerNumber,
            output,
            values
        ),
    })
);

const Genome = defineComponent("genome", (genes) => ({
    genes,
}));

const EvolutionComponent = defineComponent("evolution", (spieces) => ({
    spieces,
    dead: false,
    fitness: 0,
}));

const MouseFollow = defineComponent("mfollow", () => ({}));

const Material = defineComponent("mat", (color) => ({
    color: color,
}));

const Eyes = defineComponent(
    "eyes",
    (count, radius, angle, allow = null, block = null) => ({
        count: count,
        radius: radius,
        output: null,
        angle: angle,
        types: new ABList(allow, block),
    })
);

//#endregion Components

function posRadToBounds(pos, rad) {
    return {
        pos: SPTensors.vector([pos.x - rad.x, pos.y - rad.y]),
        dims: SPTensors.mult(rad, 2),
    };
}

function posRadToRect(pos, rad) {
    return SPTensors.vector([
        pos.x - rad.x,
        pos.y - rad.y,
        rad.x * 2,
        rad.y * 2,
    ]);
}

function entityGetBounds(entity) {
    return posRadToBounds(entity.tran.pos, entity.rig.rad);
}

//#region ChunkSystem

function ChunkSystem(coordinator) {
    System.call(this, coordinator, ["tran", "rig", "meta", "mov"]);

    this.map = {};
    this.chunkSize = 250;
}

ChunkSystem.prototype = Object.create(System.prototype);
ChunkSystem.prototype.update = function (ts) {
    this.map = {};
    for (let entity of this.getEntities()) {
        let { pos, dims } = entityGetBounds(entity);
        let { a, b } = this.getChunkBoundsCoords(pos, dims);

        for (var y = a.y; y <= b.y; y++) {
            for (var x = a.x; x <= b.x; x++) {
                if (this.map[`${x}-${y}`] === undefined) {
                    this.map[`${x}-${y}`] = new Set();
                }
                this.map[`${x}-${y}`].add(entity.id);
            }
        }
    }
};

ChunkSystem.prototype.remove = function (entity) {
    this.entities.delete(entity.id);
    let { pos, dims } = posRadToBounds(entity.tran.pos, entity.rig.rad);
    let { a, b } = this.getChunkBoundsCoords(pos, dims);

    for (var y = a.y; y <= b.y; y++) {
        for (var x = a.x; x <= b.x; x++) {
            if (this.map[`${x}-${y}`] !== undefined) {
                this.map[`${x}-${y}`].delete(entity.id);
            }
        }
    }
};

ChunkSystem.prototype.getChunkBoundsCoords = function (pos, dims) {
    let a = SPTensors.copy(pos, (x) => Math.floor(x / this.chunkSize));
    let b = SPTensors.copy(SPTensors.add(pos, dims), (x) =>
        Math.floor(x / this.chunkSize)
    );
    return { a, b };
};

ChunkSystem.prototype.getObjectsInRect = function (pos, dims, predicate) {
    let res = new Set();
    let { a, b } = this.getChunkBoundsCoords(pos, dims);
    let rect = SPTensors.link([pos, dims], [4]);

    for (var y = a.y; y <= b.y; y++) {
        for (var x = a.x; x <= b.x; x++) {
            if (this.map[`${x}-${y}`] !== undefined) {
                this.map[`${x}-${y}`].forEach((id) => {
                    var entity = this.coordinator.entities[id];
                    if (!predicate || predicate(entity)) {
                        var entDimRect = posRadToBounds(
                            entity.tran.pos,
                            entity.rig.rad
                        );
                        var a = SPTensors.link(
                            [entDimRect.pos, entDimRect.dims],
                            [4]
                        );

                        if (SPMath.rectCollision(a, rect)) {
                            res.add(entity);
                        }
                    }
                });
            }
        }
    }

    return res;
};

//#endregion

//#region Physics

function VelocitySystem(coordinator) {
    System.call(this, coordinator, ["tran", "mov"]);
}

VelocitySystem.prototype = Object.create(System.prototype);
VelocitySystem.prototype.update = function (ts) {
    for (let entity of this.getEntities()) {
        entity.tran.pos.add(SPTensors.mult(entity.mov.vel, ts));
        entity.mov.vel.add(SPTensors.mult(entity.mov.acc, ts));
    }
};

//#endregion

//#region Rendering

/// RENDERING ///

function RenderingSystem(coordinator, renderer) {
    System.call(this, coordinator, ["tran", "rig", "mat"]);

    this.renderer = renderer;
}

RenderingSystem.prototype = Object.create(System.prototype);

RenderingSystem.prototype.update = function (ts) {
    for (let entity of this.getEntities()) {
        this.renderer.setColor(entity.mat.color);
        if (entity.rig.shape == "aabb") {
            this.renderer.drawRect(
                SPTensors.sub(entity.tran.pos, entity.rig.rad),
                SPTensors.mult(entity.rig.rad, 2)
            );
        } else if (entity.rig.shape == "circle") {
            this.renderer.fillCircle(entity.tran.pos, entity.rig.rad.x);
        } else if (entity.rig.shape == "polygon") {
            let polygon = SPMath.rotatePolygon(
                entity.rig.polygon,
                SPTensors.vector([0, 0]),
                entity.tran.rot
            );

            this.renderer.fillPolygon(
                SPTensors.add(polygon, entity.tran.pos, true)
            );
        } else {
            assert(
                false,
                `${entity.rig.shape} is not supported by RenderingSystem`
            );
        }
    }
};
//#endregion

//#region EyeSystem

function EyeSystem(coordinator, chunkSystem) {
    System.call(this, coordinator, ["tran", "meta", "eyes"]);

    this.chunkSystem = chunkSystem;
}

EyeSystem.prototype = Object.create(System.prototype);

EyeSystem.prototype.update = function (ts) {
    for (let entity of this.getEntities()) {
        var eyes = [];

        var min = entity.tran.pos.copy();
        var max = entity.tran.pos.copy();

        var eyes = SPMath.polarPoints(
            entity.eyes.count,
            entity.tran.pos,
            entity.eyes.radius,
            entity.tran.rot,
            entity.eyes.angle
        );

        eyes.forEach((point) => {
            if (!min.x || point.x < min.x) {
                min.x = point.x;
            }
            if (!min.y || point.y < min.y) {
                min.y = point.y;
            }

            if (!max.x || point.x > max.x) {
                max.x = point.x;
            }
            if (!max.y || point.y > max.y) {
                max.y = point.y;
            }
        });

        var objects = this.chunkSystem.getObjectsInRect(
            min,
            SPTensors.sub(max, min),
            (e) => entity.eyes.types.allowed(e.meta.type)
        );
        entity.eyes.output = [];
        renderer.setColor(`rgb(0, 0, 0, ${0.5})`);
        eyes.forEach((eye, eyeIndex) => {
            let line = SPTensors.link([entity.tran.pos, eye], [2, 2]);
            var lineValue = 0;
            objects.forEach((object) => {
                if (object.id != entity.id) {
                    var rect = posRadToRect(object.tran.pos, object.rig.rad);
                    var polygon = SPMath.rectToPolygon(rect);

                    var intersections = SPMath.polygoneLineIntersection(
                        line,
                        polygon
                    );

                    intersections.forEach((intersection) => {
                        var value =
                            1 -
                            SPMath.distance(entity.tran.pos, intersection) /
                                entity.eyes.radius;
                        if (value > lineValue) {
                            lineValue = value;
                        }
                    });
                }
            });
            entity.eyes.output.push(lineValue);
            if (lineValue > 0) {
                renderer.drawLine(entity.tran.pos, eye);
            }
        });
    }
};

//#endregion

//#region MouseFollowerSystem

function MouseFollowerSystem(coordinator, mouseListener) {
    System.call(this, coordinator, ["tran", "mfollow"]);

    this.mouseListener = mouseListener;
}

MouseFollowerSystem.prototype = Object.create(System.prototype);

MouseFollowerSystem.prototype.update = function (ts) {
    for (let entity of this.getEntities()) {
        entity.tran.pos = mouseListener.m.copy();
        var objects = chunkSystem.getObjectsInRect(
            SPTensors.sub(entity.tran.pos, entity.rig.rad),
            SPTensors.mult(entity.rig.rad, 2)
        );
        objects.forEach((object) => {
            object.mat.color = "red";
        });
    }
};

//#endregion

//#region AvoiderSystem

function AvoiderSystem(coordinator) {
    System.call(this, coordinator, ["rigidbody", "eye", "dnn"]);
}

AvoiderSystem.prototype = Object.create(System.prototype);

AvoiderSystem.prototype.update = function (ts) {
    for (let entity of this.getEntities()) {
        if (entity.eyeOutput) {
            let input = SPTensors.vector(entity.eyeOutput).reshape([
                1,
                entity.eyeCount,
            ]);

            let output = entity.dnn.forward(input);
            entity.rot += output.x / 10;
            entity.vel = SPMath.getUnitVector(entity.rot).mult(output.y * 5);
        }
    }
};

//#endregion

//#region WorldFoldingSystem

function WorldFoldingSystem(coordinator, bounds, onObjectPorted) {
    System.call(this, coordinator, ["tran"]);
    this.onObjectPorted = onObjectPorted;
    this.bounds = bounds;
}

WorldFoldingSystem.prototype = Object.create(System.prototype);

WorldFoldingSystem.prototype.update = function (ts) {
    for (entity of this.getEntities()) {
        if (!SPMath.rectContains(this.bounds, entity.tran.pos)) {
            entity.tran.pos.x = SPMath.posmodRange(
                entity.tran.pos.x,
                this.bounds.x,
                this.bounds.x + this.bounds.width
            );
            entity.tran.pos.y = SPMath.posmodRange(
                entity.tran.pos.y,
                this.bounds.y,
                this.bounds.y + this.bounds.height
            );
            if (this.onObjectPorted) {
                this.onObjectPorted(entity);
            }
        }
    }
};

function onObjectPorted(object) {
    if (object.objectType == "boid") {
        boidResetFitness(object);
    }
}

//#endregion

//#region EvolutionSystem

function EvolutionSystem(coordinator, spieces) {
    System.call(this, coordinator, ["genome", "evolution"]);

    this.spieces = spieces;
    this.spiecesTypes = Object.keys(spieces);

    this.timer = new SimpleTimer(5000);
}

EvolutionSystem.prototype = Object.create(System.prototype);

Object.defineProperty(EvolutionSystem.prototype, "period", {
    get: function () {
        return this.timer.length;
    },
    set: function (value) {
        this.timer.length = value;
        this.timer.lap();
        return this.timer.length;
    },
});

EvolutionSystem.prototype.update = function (ts) {
    if (this.timer.isDone()) {
        var list = Array.from(this.getEntities());

        for (let sp of this.spiecesTypes) {
            var spList = list.filter((a) => a.evolution.spieces == sp);
            spList.sort((a, b) => b.evolution.fitness - a.evolution.fitness);
            this.spieces[sp].onGenerationEnds(spList);
        }
        this.timer.lap();
    } else {
        for (let entity of this.getEntities()) {
            entity.fitness = this.spieces[
                entity.evolution.spieces
            ].fitnessFunction(entity);
        }
    }
};

//#endregion

//#region CollisionSystem
function CollisionSystem(coordinator, chunkSystem, onCollision) {
    System.call(this, coordinator, ["tran", "rig"]);

    this.chunkSystem = chunkSystem;
    this.onCollision = onCollision;
}

CollisionSystem.prototype = Object.create(System.prototype);

CollisionSystem.prototype.update = function () {
    for (let entity of this.getEntities()) {
        var bounds = entityGetBounds(entity);
        var objects = this.chunkSystem.getObjectsInRect(
            bounds.pos,
            bounds.dims
        );

        for (let object of objects) {
            if (entity.id != object.id) {
                this.onCollision(entity, object);
            }
        }
    }
};

//#endregion

//#region SpawningSystem
function DraggingSystem(coordinator, mouseListener, renderer) {
    System.call(this, coordinator);
    this.mouseListener = mouseListener;
    this.renderer = renderer;
    this.button = 0;
    this.dragging = false;
    this.dragStart = false;
}

DraggingSystem.prototype = Object.create(System.prototype);

DraggingSystem.prototype.update = function (ts) {
    let mDrag = this.mouseListener.pressedButtons[this.button];

    if (!this.dragging && mDrag) {
        this.dragging = true;
        this.dragStart = this.mouseListener.m.copy();
    }
    if (this.dragging && mDrag) {
        this.renderer.drawRect(
            SPMath.getRect(this.dragStart, this.mouseListener.m)
        );
    }
    if (this.dragging && !mDrag) {
        if (this.onDragFinished) {
            this.onDragFinished(
                SPMath.getRect(this.dragStart, this.mouseListener.m)
            );
        }
        this.dragging = false;
    }
};

// draggingSystem.onDragFinished = function (rect) {
//     var box = new Entity();
//     box.addComponent("transform", {
//         pos: SPTensors.vector([
//             rect.x + rect.width / 2,
//             rect.y + rect.height / 2,
//         ]),
//         rot: 0,
//     });

//     box.addComponent("type", {
//         objectType: "box",
//     });

//     box.addComponent("rigidbody", {
//         color: "black",
//         vel: SPTensors.vector([0, 0]),
//         rad: SPTensors.vector([rect.width / 2, rect.height / 2]),
//     });

//     coordinator.add(box);
// };

//#endregion
