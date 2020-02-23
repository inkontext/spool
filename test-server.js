var {
    Server,
    Entity,
    SpoolMath,
    CollisionManager,
    ObjectSpawner,
    RectangleBodyParameters
} = require('./spoolserver.js');

const names = [
    "Tam",
    "Witty",
    "Friendly",
    "Pointy",
    "Cutthroat",
    "Jakoba",
    "Jakoba",
    "First",
    "Dread",
    "Captain",
    "Sir",
    "The",
    "Cristina",
    "Cap'n",
    "Jakoba",
    "Cristina",
    "Admiral",
    "Cristinaplan",
    "Friendly",
    "Brown"
];

////// SETTING UP SERVER //////

var server = Server({
    port: 3000,
    updateCallback: (self) => {

    }
}, ['/', '/textures'])

server.handler.staticKeys = [
    'WALL'
]

server.mouseEvent = (data, socket, player) => {
    var fireBall = Fireball({
        x: player.x,
        y: player.y,
        velX: player.calculatedVelX,
        velY: player.calculatedVelY
    })

    fireBall.impulse(20, SpoolMath.globalAngle(player.x, player.y, data.clickedX, data.clickedY))
}

var GRID_SIZE = 96;

////// OBJECTS //////

/**
 * Player represents the basic player, it extends entity to inherit its functionality but extends upon it via client connection and controls
 * @param {any} id - id of the socket player is connected from
 */
var Player = (initPack = {}) => {
    var self = Entity({
        ...initPack,
        ...RectangleBodyParameters
    });

    // Constants 
    self.maxAcc = 10;
    self.jumpAcc = 10;
    self.groundSpeed = 0.2;
    self.width = 44;
    self.height = 18;

    self.objectType = "PLAYER";
    self.name = 'NAME';

    self.rotation = Math.PI / 2;

    self.color = self.color = SpoolMath.randomHsvColor(0.5, 0.8);

    var superInitPackage = self.initPack;
    self.initPack = () => {
        return {
            ...superInitPackage(),
            name: self.name,
            maxHealth: self.maxHealth
        }
    }

    var superUpdatePack = self.updatePack;
    self.updatePack = () => {
        return {
            ...superUpdatePack(),
            radius: self.radius
        };
    };

    /**
     * Updates velocities from keyboard input
     */
    self.updateInputVel = () => {
        // setting the basic values

        xVelocity = 0;
        yVelocity = 0;

        if (self.pressedLeft || self.pressedRight) {
            if (self.pressedLeft) {
                xVelocity -= self.maxAcc;
            }
            if (self.pressedRight) {
                xVelocity += self.maxAcc;
            }
        }

        if (self.pressedUp || self.pressedDown) {
            if (self.pressedUp) {
                yVelocity += self.maxAcc;
            }
            if (self.pressedDown) {
                yVelocity -= self.maxAcc;
            }
        }


        self.setVelVector('x-movement', [xVelocity, yVelocity]);

    }

    /**
     * Update override
     */
    var superUpdate = self.update;
    self.update = () => {
        self.updateInputVel();
        return superUpdate();
    };

    self.addToHandler(server.handler);

    return self;
};

/**
 * Player represents the basic player, it extends entity to inherit its functionality but extends upon it via client connection and controls
 * @param {any} id - id of the socket player is connected from
 */
var Animal = (initPack = {}) => {
    var self = Entity(initPack);


    self.objectType = "ANIMAL";
    self.name = names[SpoolMath.randomInt(0, names.length)];

    self.rotation = Math.PI / 2;

    self.color = self.color = SpoolMath.randomHsvColor(0.5, 0.8);

    self.tickCounter = 0;

    self.speed = 3;
    self.targetX = 0;
    self.targetY = 0;

    self.maxDistance = 200;
    self.waitTime = SpoolMath.randomInt(0, 100);

    self.width = 30;
    self.height = 15;

    var superInitPackage = self.initPack;
    self.initPack = () => {
        return {
            ...superInitPackage(),
            name: self.name,
        }
    }
    /**
     * Update override
     */
    var superUpdate = self.update;
    self.update = () => {

        if (SpoolMath.distance(self.x, self.y, self.targetX, self.targetY) > 10) {
            self.setVel('movement', self.speed, SpoolMath.globalAngle(self.x, self.y, self.targetX, self.targetY))
        } else {
            self.setVel('movement', 0, 0)
        }

        if (self.tickCounter == self.waitTime) {
            self.targetX = self.x + SpoolMath.randomInt(-self.maxDistance, self.maxDistance);
            self.targetY = self.y + SpoolMath.randomInt(-self.maxDistance, self.maxDistance);
            self.waitTime = SpoolMath.randomInt(5, 1000)
            self.tickCounter = 0
        }
        self.tickCounter += 1;
        return superUpdate();
    };

    self.addToHandler(server.handler);

    return self;
};
/**
 * Player represents the basic player, it extends entity to inherit its functionality but extends upon it via client connection and controls
 * @param {any} id - id of the socket player is connected from
 */
var Wall = (initPack = {}) => {
    var self = Entity({
        ...initPack,
        ...RectangleBodyParameters
    });

    self.width = GRID_SIZE;
    self.height = GRID_SIZE;
    self.objectType = "WALL";
    self.rotation = Math.PI / 2;
    self.color = self.color = SpoolMath.randomHsvColor(0.5, 0.8);
    self.static = true;

    self.gridColRemoval = true;

    self.addToHandler(server.handler);

    return self;
};

var Fireball = (initPack = {}) => {
    var self = Entity(initPack);

    self.objectType = 'FIREBALL';

    self.rotation = Math.PI / 2;

    self.width = 20;
    self.height = 20;

    self.z = 50;
    self.velZ = 0;
    self.dmg = 10;


    var superInitPack = self.initPack;
    self.initPack = () => {
        return {
            ...superInitPack(),
            z: self.z
        }
    }

    var superUpdatePack = self.updatePack;
    self.updatePack = () => {
        return {
            ...superUpdatePack(),
            z: self.z
        }
    }

    var superUpdate = self.update;

    self.update = () => {
        self.z -= self.velZ;
        self.velZ += 0.2;
        if (self.z < 0) {
            server.handler.removeObj(self);
        }
        superUpdate()
    }

    self.addToHandler(server.handler);
    return self;
}

/**
 * Player represents the basic player, it extends entity to inherit its functionality but extends upon it via client connection and controls
 * @param {any} id - id of the socket player is connected from
 */
var Fence = (initPack = {}) => {
    var self = Entity({
        ...initPack,
        ...RectangleBodyParameters
    });

    self.width = GRID_SIZE;
    self.height = GRID_SIZE;
    self.objectType = "FENCE";
    self.rotation = Math.PI / 2;
    self.color = self.color = SpoolMath.randomHsvColor(0.5, 0.8);
    self.static = true;

    self.gridColRemoval = true;

    self.addToHandler(server.handler);

    return self;
};

var Ground = (initPack = {}) => {
    var self = Entity({
        objectType: "GROUND",
        ...initPack,
        ...RectangleBodyParameters
    });

    self.width = GRID_SIZE;
    self.height = GRID_SIZE;

    self.rotation = Math.PI / 2;
    self.color = self.color = SpoolMath.randomHsvColor(0.5, 0.8);
    self.static = true;

    self.addToHandler(server.handler);

    return self;
};


/**
 * Player represents the basic player, it extends entity to inherit its functionality but extends upon it via client connection and controls
 * @param {any} id - id of the socket player is connected from
 */
var Tree = (initPack = {}) => {
    var self = Entity({
        ...initPack,
        ...RectangleBodyParameters
    });

    self.width = 48;
    self.height = 20;
    self.objectType = "TREE";
    self.rotation = Math.PI / 2;
    self.color = self.color = SpoolMath.randomHsvColor(0.5, 0.8);
    self.static = true;

    self.gridColRemoval = true;

    self.addToHandler(server.handler);

    return self;
};
////// MANAGERS //////

var collisionManager = CollisionManager(server.handler, [{
        a: ['PLAYER', 'ANIMAL'],
        b: ['WALL', 'TREE', 'FENCE'],
    }, {
        a: ['FIREBALL'],
        b: ['ANIMAL'],
        func: function (a, b) {
            server.handler.removeObj(b);
            server.handler.removeObj(a);
        }
    }, {
        a: ['FIREBALL'],
        b: ['WALL', 'TREE', 'FENCE'],
        func: function (a, b) {
            server.handler.removeObj(a)
        }
    }

]);

server.handler.addManager(collisionManager);

////// SPAWN WORLD //////

spawnAnimal = () => {

    var x = SpoolMath.randomInt(-1000, 1000)
    var y = SpoolMath.randomInt(-1000, 1000)
    Animal({
        x,
        y
    })
}

// for (var i = 0; i < 100; i++) {
//     spawnAnimal()
// }

var objSpawner = ObjectSpawner(server.handler, {
    'ANIMAL': {
        const: Animal,
        defs: {
            x: 0,
            y: 0
        }
    },
    'WALL': {
        const: Wall,
        defs: {
            x: 0,
            y: 0
        }
    },
    'FENCE': {
        const: Fence,
        defs: {
            x: 0,
            y: 0
        }
    },
    'TREE': {
        const: Tree,
        defs: {}
    },
    'GROUND': {
        const: Ground,
        defs: {}
    },
    'GROUND_SAND': {
        const: Ground,
        defs: {
            objectType: 'GROUND_SAND'
        }
    }
})

objSpawner.spawnRPGWorld({
    objects: './maps/map-objects.png',
    ground: './maps/map-ground.png'
}, {
    '00ff00': 'GROUND',
    'fffe92': 'GROUND_SAND',
    'ffffff': 'WALL',
    '009000': 'TREE',
    '7e541e': 'FENCE'
}, GRID_SIZE, GRID_SIZE);

objSpawner.spawnInRadius('ANIMAL', 100, 20)


////// STARTING SERVER //////

server.fullStart(Player)