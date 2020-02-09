var {
    Server,
    Entity,
    SpoolMath,
    CollisionManager
} = require('./spoolserver.js');


var server = Server({}, '/')

////// OBJECTS //////

/**
 * Player represents the basic player, it extends entity to inherit its functionality but extends upon it via client connection and controls
 * @param {any} id - id of the socket player is connected from
 */
var Player = (initPack = {}) => {
    var self = Entity(initPack);

    // Constants 
    self.maxAcc = 10;
    self.jumpAcc = 10;
    self.groundSpeed = 0.2;
    self.radius = 20;

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
            kills: self.kills,
            deaths: self.deaths,
            health: self.health
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
    self.name = 'NAME';

    self.rotation = Math.PI / 2;

    self.color = self.color = SpoolMath.randomHsvColor(0.5, 0.8);

    self.tickCounter = 0;

    self.speed = 3;
    self.targetX = 0;
    self.targetY = 0;

    self.maxDistance = 200;
    self.waitTime = SpoolMath.randomInt(0, 100);

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

////// MANAGERS //////

var collisionManager = CollisionManager(server.handler, [{
    a: 'PLAYER',
    b: 'PLAYER',
}, {
    a: 'PLAYER',
    b: 'ANIMAL',
    func: function (a, b) {
        server.handler.removeObj(b)
    }
}]);

server.handler.addManager(collisionManager);

////// SPAWN ANIMALS //////

for (var i = 0; i < 10; i++) {
    animal = Animal({
        x: SpoolMath.randomInt(-500, 1000),
        y: SpoolMath.randomInt(-500, 1000)
    })
    server.handler.add(animal);
}

////// STARTING SERVER //////

server.fullStart(Player)