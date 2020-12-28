//#region ECS

//#region Coordinator

function Coordinator() {
    this.entities = new Array(20000);
    this.systems = [];
    this.currentId = 0;
    this.returnedIdStack = [];
    this.usedIds = new Set();
}

Coordinator.prototype.addSystem = function (system) {
    this.systems.push(system);
};

Coordinator.prototype.add = function (entity) {
    var id = -1;
    if (this.returnedIdStack.length > 0) {
        id = this.returnedIdStack.pop();
    } else {
        id = this.currentId++;
    }
    entity.id = id;
    this.usedIds.add(id);
    this.entities[id] = entity;

    this.systems.forEach((sys) => {
        sys.add(entity);
    });
};

Coordinator.prototype.remove = function (entity) {
    this.entities[entity.id] = null;
    this.returnedIdStack.push(entity.id);
    this.currentId;
    this.usedIds.delete(entity.id);
    this.systems.forEach((sys) => {
        sys.remove(entity);
    });
};

Coordinator.prototype.removeId = function (id) {
    this.remove(this.entities[id]);
};

Coordinator.prototype.removeAll = function () {
    while (this.usedIds.size > 0) {
        this.removeId(this.usedIds.values().next().value);
    }
};

Coordinator.prototype.update = function (ts) {
    this.systems.forEach((sys) => {
        sys.update(ts);
    });
};

//#endregion

//#region Entity

function Entity() {
    this.id = -1;
    this.signature = new Set();
}

Entity.prototype.addComponent = function (name, object) {
    this[name] = object;
    this.signature.add(name);
    return this;
};

Entity.prototype.addTo = function (coordinator) {
    coordinator.add(this);
    return this;
};

//#endregion

//#region Component

function Component(name, values) {
    this.name = name;
    this.values = values;
}

Component.prototype.addTo = function (entity) {
    entity.addComponent(this.name, this.values);
};

function defineComponent(name, valFunction) {
    let res = function (...args) {
        Component.call(this, name, valFunction(...args));
    };
    res.prototype = Object.create(Component.prototype);
    return res;
}

function constructObject(...components) {
    let res = new Entity();

    components.forEach((comp) => {
        comp.addTo(res);
    });

    return res;
}

//#endregion Component

//#region System

function System(coordinator, signatureList) {
    if (!coordinator) {
        console.warn(
            `Your system with signature:${signatureList.toString()} has invalid coordinator: ${coordinator}`
        );
    }

    this.coordinator = coordinator;
    if (!signatureList) {
        this.signature = null;
    } else {
        this.signature = new Set(signatureList);
    }
    this.entities = new Set();
}

System.prototype.add = function (entity) {
    if (!this.signature) {
        return;
    }

    for (let s of this.signature) {
        if (!entity.signature.has(s)) {
            return;
        }
    }
    this.entities.add(entity.id);
};

System.prototype.remove = function (entity) {
    this.entities.delete(entity.id);
};

System.prototype.getEntities = function* () {
    for (let entity of this.entities) {
        yield this.coordinator.entities[entity];
    }
};

System.prototype.addTo = function (coordinator) {
    coordinator.addSystem(this);
    return this;
};

System.prototype.update = function () {};

/**
 * @callback updateCallback
 * @param {number} ts - coef of normal frametime
 */

/**
 *
 * @param {array} signatureList - list of needed components
 * @param {updateCallback} update - udpate callback
 * @param {function} constructor - constructor definition example:
 *                                 (x, y) => ({x, y})
 *
 * @returns Object constructor (coordinator, ...args), args are defined via
 *          constructor argument
 */
function defineSystem(signatureList, update, constructor = () => ({})) {
    let res = function (coordinator, ...args) {
        System.call(this, coordinator, signatureList);
        var constructed = constructor(...args);
        assert(
            typeof constructed === "object",
            "Invalid system constructor, constructor needs to return object"
        );

        Object.assign(this, constructed);
    };

    res.prototype = Object.create(System.prototype);
    res.prototype.update = update;
    return res;
}

//#endregion

//#endregion ECS

//#region TIME

//#region Clock

function Clock(frequency, onTick) {
    this.frameTime = 1000 / frequency;
    this.onTick = onTick;
    this.offset = 0;
}

Clock.prototype.start = function () {
    this.lastMillisTimer = Date.now();
    this.lastMillis = Date.now();

    this.lastFrameTime = Date.now();
    this.loop();
};

Clock.prototype.loop = function () {
    let now = Date.now();
    if (now - this.lastFrameTime >= this.frameTime - this.offset) {
        var delta = now - this.lastFrameTime;

        this.onTick(delta / this.frameTime);

        this.lastFrameTime = now;

        var delta = Date.now() - this.lastMillisTimer;

        if (delta >= 1000) {
            console.log("FPS:" + this.frameCounter);
            this.frameCounter = 0;
            this.lastMillisTimer = Date.now();
        } else {
            this.frameCounter += 1;
        }
        this.offset = Date.now() - now;
    }
    setTimeout(() => {
        this.loop();
    });
};

//#endregion

//#region BrowserClock

function BrowserClock(onTick) {
    this.onTick = onTick;
    this.frameTime = 1000 / 60;
    this.lastFrameTime = 0;
    this.tickCounter = 0;
}

BrowserClock.prototype.start = function () {
    window.requestAnimationFrame((ts) => {
        this.update(ts);
    });
};

BrowserClock.prototype.update = function (ts) {
    let delta = ts - this.lastFrameTime;
    this.onTick(delta / this.frameTime);

    this.lastFrameTime = ts;
    this.tickCounter = (this.tickCounter + 1) % 60;

    window.requestAnimationFrame((ts) => {
        this.update(ts);
    });
};

//#endregion

//#region SimpleTimer

function SimpleTimer(length = 0) {
    this.start = Date.now();
    this.length = length;
}

SimpleTimer.prototype.delta = function () {
    return Date.now() - this.start;
};

SimpleTimer.prototype.isDone = function () {
    return this.delta() >= this.length;
};

SimpleTimer.prototype.lap = function () {
    this.start = Date.now();
    return this.start;
};

//#endregion

//#region PeriodicLogger

function PeriodicLogger(broswerClock) {
    this.broswerClock = broswerClock;
}

PeriodicLogger.prototype.log = function (...strings) {
    if (this.broswerClock.tickCounter % 60 == 0) {
        console.log(...strings);
    }
};

//#endregion

//#endregion TIME
