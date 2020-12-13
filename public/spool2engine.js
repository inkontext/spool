function Coordinator() {
    this.entities = new Array(1000);
    this.systems = [];
    this.currentId = 0;
    this.returnedIdStack = [];
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
    this.entities[id] = entity;

    this.systems.forEach((sys) => {
        sys.add(entity);
    });
};

Coordinator.prototype.remove = function (entity) {
    this.entities[entity.id] = null;
    this.returnedIdStack.push(entity.id);
    this.currentId;

    this.systems.forEach((sys) => {
        sys.remove(entity);
    });
};

Coordinator.prototype.update = function (ts) {
    this.systems.forEach((sys) => {
        sys.update(ts);
    });
};

function System(coordinator, signatureList) {
    this.coordinator = coordinator;
    this.signature = new Set(signatureList);
    this.entities = new Set();
}

System.prototype.add = function (entity) {
    console.log(this.signature);
    this.signature.forEach((s) => {
        if (entity.signature.has(s)) {
            this.entities.add(entity.id);
        }
    });
};

System.prototype.remove = function (entity) {
    this.entities.remove(entity.id);
};

System.prototype.update = function () {};

function Entity() {
    this.id = -1;
    this.signature = new Set();
}

Entity.prototype.addComponent = function (name, object) {
    Object.assign(this, object);
    this.signature.add(name);
};

function Clock(frequency, onTick) {
    this.frameTime = 1000 / frequency;
    this.onTick = onTick;
}

Clock.prototype.start = function () {
    this.lastMillisTimer = Date.now();
    this.lastMillis = Date.now();

    this.lastFrameTime = Date.now();
    this.loop();
};

Clock.prototype.loop = function () {
    let now = Date.now();
    if (now - this.lastFrameTime >= this.frameTime) {
        var delta = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;

        this.onTick(delta);

        var delta = Date.now() - this.lastMillisTimer;

        if (delta >= 1000) {
            //console.log("FPS:" + this.frameCounter);
            this.frameCounter = 0;
            this.lastMillisTimer = Date.now();
        } else {
            this.frameCounter += 1;
        }
    }
    setTimeout(() => {
        this.loop();
    });
};
