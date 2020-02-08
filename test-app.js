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

////// MANAGERS //////

var collisionManager = CollisionManager(server.handler, [{
    a: 'PLAYER',
    b: 'PLAYER'
}]);

server.handler.addManager(collisionManager);

////// STARTING SERVER //////

server.fullStart(Player)