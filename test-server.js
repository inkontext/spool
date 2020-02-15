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
}, '/')

var GRID_SIZE = 80;

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
    self.width = 20;
    self.height = 20;

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

    self.radius = 10;

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
            //self.setVel('movement', self.speed, SpoolMath.globalAngle(self.x, self.y, self.targetX, self.targetY))
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

    self.gridColRemoval = true;

    self.addToHandler(server.handler);

    return self;
};
////// MANAGERS //////

var collisionManager = CollisionManager(server.handler, [{
    a: 'PLAYER',
    b: 'WALL',
}, {
    a: 'PLAYER',
    b: 'ANIMAL',
    func: function (a, b) {
        a.radius = parseInt(Math.sqrt((a.radius * a.radius + b.radius * b.radius)))
        server.handler.removeObj(b)

    }
}]);

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
    }
})

objSpawner.spawnFromImageMap('./image.png', {
    'ffffff': 'WALL'
}, GRID_SIZE, GRID_SIZE);



////// STARTING SERVER //////

server.fullStart(Player)