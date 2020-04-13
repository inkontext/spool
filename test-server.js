var {
    Server,
    Entity,
    SpoolMath,
    CollisionManager,
    GravityManager,
    ObjectSpawner,
    RectangleBodyParameters,
    ServerObject,
    Line,
    SpoolUtils,
    SpoolTimer,
    Perlin,

} = require('./spoolserver.js');

var {
    FileReader
} = require('./spoolfilereader.js');



////// GLOBAL CONSTANTS //////

var TILE_WIDTH = 60;
var WORLD_LAYERS = 6;

var WORLD_CLIFFSNUMBER = 1;

var CHARACTERS = [
    'Bob',
    'Joe',
    'Adel',
    'Jack',
    'Andy',
    'Sanches'
];

////// FUNCTIONS //////

//// TILES ////

function tileDistance(ax, ay, bx, by) {
    return (Math.abs(bx - ax) + Math.abs(by - ay) + Math.abs(bx + by - ax - ay)) / 2
}

function tileDistance2T(a, b) {
    return tileDistance(a.tx, a.ty, b.tx, b.ty);
}

function transformTileCoordToRealCord(x, y) {
    return {
        x: x * TILE_WIDTH * 3 / 2,
        y: y * TILE_WIDTH * 2 * Math.sin(Math.PI / 3) + x * TILE_WIDTH * Math.sin(Math.PI / 3)
    }
}

function movingPrice(tilea, tileb) {
    if (tilea.z !== undefined && tilea.leavingPrice !== undefined && tileb.z !== undefined && tileb.enteringPrice !== undefined) {
        var res = Math.abs(tilea.z - tileb.z) + tilea.leavingPrice + tileb.enteringPrice;
        return res;
    } else {
        if (tilea.z === undefined || tilea.leavingPrice === undefined) {
            console.warn('@movingPrice: problem with tileA:', tilea);
        }
        if (tileb.z === undefined || tileb.enteringPrice === undefined) {
            console.warn('@movingPrice: problem with tileB:', tileb);
        }

        return null;
    }
}

//// ALERTING ////

function alertClient(socket, message) {
    socket.emit('ALERT', {
        msg: message
    })
}

////// SETTING UP SERVER //////

var server = Server({
    port: 4000,
    TPS: 55,
    chunkSize: 300
}, ['/', '/textures'])

////// OBJECTS //////

var Player = (initObject) => {
    var self = Entity(initObject);

    superSelf = {
        updatePack: self.updatePack
    }

    self.objectType = 'PLAYER';
    self.width = 42;
    self.height = 64;

    self.sendUpdatePackageAlways = true;
    self.name = 'Anonymous'

    self.startPosition = (tx, ty, defs) => {
        MAP.move(self, tx, ty);
        self.setDefs(defs);
    }

    self.setDefs = (defs) => {
        Object.assign(self, {
            maxEnergy: 30,
            energy: 0,
            maxHp: 10,
            hp: 10,
            maxAmmo: 5,
            ammo: 0,
            alive: true,
            hand: [],
            ...defs
        })
    }

    self.setDefs();

    self.moveTo = (tx, ty, hard = false) => {
        var temp = MAP.getTile(tx, ty);
        var price = movingPrice(self.tile, temp);
        if (self.energy >= price || hard) {
            tile = MAP.move(self, tx, ty);

            tile.objects.forEach(value => {
                var temp = server.handler.objectsById[value]
                if (temp) {
                    if (temp.objectType == 'BOX') {
                        temp.open(self);
                    }
                } else {
                    console.log('ID', value, 'is in the tile, but not in handler');
                }
            });

            self.energy -= price
            return true;
        } else {
            return false;
        }
    }

    self.energyDelta = (delta) => {
        self.energy += delta;
        if (self.energy < 0) {
            self.energy = 0;
        } else if (self.energy >= self.maxEnergy) {
            self.energy = self.maxEnergy;
        }
    }

    self.updatePack = () => {
        return {
            ...superSelf.updatePack(),
            hp: self.hp,
            maxHp: self.maxHp,
            energy: self.energy,
            maxEnergy: self.maxEnergy,
            ammo: self.ammo,
            maxAmmo: self.maxAmmo,

            x: self.x,
            y: self.y,
            id: self.id,
            name: self.name,

            alive: self.alive,

            tile: self.tile ? {
                tx: self.tile.tx,
                ty: self.tile.ty,
                z: self.tile.z,
                leavingPrice: self.tile.leavingPrice,
                enteringPrice: self.tile.enteringPrice
            } : null,
        }
    }

    self.die = () => {
        self.alive = false;

        if (self.onDeath) {
            self.onDeath();
        }
    }

    self.authorizedUpdatePack = () => {
        return {
            id: self.id,
            package: {
                id: self.id,
                hand: self.hand
            }
        }
    }

    self.setName = (name) => {
        self.name = name;
        self.setAsyncUpdateValue('name', self.name);
    }

    self.give = (cards) => {
        self.hand = self.hand.concat(cards);
    }

    return self;
}

var Box = (initObject) => {
    var self = Entity({
        objectType: 'BOX',
        width: 42,
        height: 42,
        ...initObject
    });

    self.open = (player) => {
        player.give(self.cards);
        server.handler.removeObj(self);
        MAP.remove(self.id);
    }

    return self;
}

var Tile = (initObject) => {
    var self = Entity({
        biome: 'grass',
        ...initObject
    });

    var superSelf = {
        initPack: self.initPack,
        updatePack: self.updatePack
    }

    self.inMapPos = transformTileCoordToRealCord(self.tx, self.ty);
    self.x = self.inMapPos.x;
    self.y = self.inMapPos.y;

    self.width = TILE_WIDTH;
    self.height = TILE_WIDTH;

    self.objectType = 'TILE';
    self.enteringPrice = 1;
    self.leavingPrice = 0;

    self.hexRadius = TILE_WIDTH;

    self.objects = [];

    self.initPack = () => {
        return {
            zRandomOffset: self.zRandomOffset,
            tx: self.tx,
            ty: self.ty,
            tw: self.tw,
            hexRadius: self.hexRadius,
            biome: self.biome,
            enteringPrice: self.enteringPrice,
            leavingPrice: self.leavingPrice,
            objects: self.objects,
            ...superSelf.initPack()
        }
    }

    self.updatePack = () => {
        return {
            dead: self.dead,
            z: self.z,
            ...superSelf.updatePack()
        }
    }

    self.moveIn = (obj) => {
        if (!self.objects.includes(obj.id)) {
            self.add(obj.id);
            obj.x = self.x;
            obj.y = self.y;
        }
    }

    self.add = (id) => {
        self.objects.push(id);
        self.setAsyncUpdateValue('objects', self.objects);
    }

    self.remove = (id) => {
        var i = self.objects.indexOf(id);
        self.objects.splice(i, 1);
        self.setAsyncUpdateValue('objects', self.objects);
    }



    return self;
}

////// MAP //////

var Map = () => {
    var self = {
        tiles: {},
        currentRadius: -1,
        possibleCoords: []
    }

    self.tileKey = (x, y) => {
        return `[${x},${y}]`
    }

    self.getTile = (x, y) => {
        return self.tiles[self.tileKey(x, y)];
    }

    /**
     * Get's all the tiles in said radius from said tile and returns it as a array
     * @param {int} tx
     * @param {int} ty
     * @returns returns array of all the tiles in said radius 
     */
    self.getTilesInRadius = (tx, ty, r, minR = null) => {
        var min = -1;
        var max = min + r * 2 - 1;

        res = []

        for (var y = 1 - r; y < 0 + r; y++) {
            for (var x = 1 - r; x < 0 + r; x++) {
                if ((x > min && x <= max)) {

                    if (minR !== null) {
                        if (tileDistance(tx, ty, x + tx, y + ty) < minR) {
                            continue;
                        }
                    }

                    var temp = self.getTile(x + tx, y + ty);

                    if (temp != null) {
                        res.push(temp);
                    }
                }
            }
            min--;
            max--;
        }
        return res;
    }

    self.initBlankTiles = (layers) => {
        var min = -1;
        var max = min + layers * 2 - 1;

        self.layers = layers;
        self.currentRadius = layers;

        for (var y = 1 - layers; y < 0 + layers; y++) {
            for (var x = 1 - layers; x < 0 + layers; x++) {
                if ((x > min && x <= max)) {
                    var tile = Tile({
                        tx: x,
                        ty: y,
                        z: 0,
                        zRandomOffset: 0,
                    })
                    self.possibleCoords.push([x, y]);
                    self.tiles[self.tileKey(x, y)] = tile;
                    server.handler.add(tile)
                }
            }
            min--;
            max--;
        }
    }



    self.spawnWorld = () => {
        self.currentRadius = self.layers;
        var worldSize = self.layers * 2 - 1;

        var options = {
            persistence: 0.1,
            amplitude: 0.1,
            octaveCount: 3,
        }

        var noiseFactor = 2;
        var noise = Perlin.generatePerlinNoise(worldSize * noiseFactor, worldSize * noiseFactor, options);

        var keys = Object.keys(self.tiles);

        var coords = [];

        keys.forEach(key => {
            var tile = self.tiles[key];

            var nx = tile.tx + self.layers - 1;
            var ny = tile.ty + self.layers - 1;

            nx *= noiseFactor;
            ny *= noiseFactor;

            var noiseValue = noise[(ny) * worldSize + (nx)]

            tile.z = Math.round(noiseValue * 6);
            tile.zRandomOffset = Math.random();
            tile.dead = false;
            tile.biome = 'grass';
        })

        for (var i = 0; i < 3; i++) {
            key = SpoolMath.randomChoice(self.possibleCoords);

            var height = SpoolMath.randomInt(5, 10)

            self.getTilesInRadius(key[0], key[1], SpoolMath.randomInt(2, 3)).forEach(tile => {
                tile.biome = 'stone';
                tile.z = height + SpoolMath.randomInt(1, 3)
            })
        }


        for (var i = 0; i < WORLD_CLIFFSNUMBER; i++) {
            key = SpoolMath.randomChoice(self.possibleCoords);

            var radius = SpoolMath.randomInt(2, 3);

            self.getTilesInRadius(key[0], key[1], radius + 1, radius).forEach(tile => {
                if (tile.biome == 'grass') {
                    tile.biome = 'sand';

                    tile.z = 0;
                }
            })
            self.getTilesInRadius(key[0], key[1], radius).forEach(tile => {
                if (tile.biome == 'grass') {
                    tile.biome = 'water';
                    tile.zRandomOffset = -1;
                    tile.enteringPrice = 1;
                    tile.leavingPrice = 1;
                    tile.z = 0;
                }
            })
        }

        keys.forEach(key => {
            var tile = self.tiles[key];

            var pack = tile.initPack();
            tile.addAsyncUpdatePackage(pack);
        })
    }

    self.spawnWaitingWorld = () => {
        var keys = Object.keys(self.tiles);

        console.log("MAP: waiting world spawned");

        keys.forEach(key => {
            var tile = self.tiles[key];
            tile.z = 0;
            tile.zRandomOffset = 0;
            tile.dead = false;
            tile.biome = 'grass';

            tile.addAsyncUpdatePackage(tile.initPack());
        })
    }

    self.move = (obj, tx, ty) => {
        if (obj.tile) {
            obj.tile.remove(obj.id);
        }

        var temp = self.tiles[self.tileKey(tx, ty)]
        temp.moveIn(obj);

        obj.tile = temp;
        obj.tx = tx;
        obj.ty = ty;

        return temp;
    }

    self.remove = (obj) => {
        if (obj.tile) {
            obj.tile.remove(obj.id);
        }
    }

    self.removeOuterLayer = () => {
        var tiles = self.getTilesInRadius(0, 0, self.currentRadius, self.currentRadius - 1);
        tiles.forEach(tile => {
            tile.dead = true;
            tile.z = -20;

            if (tile.objects) {
                tile.objects.forEach(id => {
                    var object = server.handler.objectsById[id]
                    if (object) {
                        if (object.die) {
                            object.die();
                        } else {
                            server.handler.removeObj(object);
                        }
                    }
                })
            }

        })
        self.currentRadius -= 1;
    }

    return self;
}

var PlayerQueue = () => {
    var self = {
        players: [],
        queue: [],
        position: 0,
    };

    self.refreshFromHandler = () => {
        if (server.handler.objects['PLAYER']) {

            self.players = []
            Object.keys(server.handler.objects['PLAYER']).forEach(key => {
                self.players.push(server.handler.objects['PLAYER'][key])
            });
        }
    }

    self.nextPlayer = () => {
        self.position += 1;
        if (self.position >= self.queue.length) {
            self.position = 0;
            if (self.onNewRound) {

                self.onNewRound()
            }
        }
    }

    self.getCurrent = () => {
        return self.queue[self.position];
    }

    self.randomizeQueue = () => {
        self.queue = [...self.players];
        self.names = [...CHARACTERS];

        SpoolUtils.shuffle(self.names);
        SpoolUtils.shuffle(self.queue);

        for (var i = 0; i < self.queue.length; i++) {
            temp = self.queue[i];
            self.queue[i].setName(self.names[i]);
        }
    }

    self.getNextPlayers = () => {
        var names = self.queue.map(value => value.name);
        return {
            thisRound: names.slice(self.position, self.queue.length),
            nextRound: names.slice(0, self.position)
        }
    }

    self.remove = (player) => {
        for (var i = 0; i < self.queue.length; i++) {
            if (self.queue.id = player.id) {
                if (i < self.position && self.position > 0) {
                    self.position--;
                }
                self.queue.splice(i, 1);
                self.sendQue();
            }
        }
        for (var i = 0; i < self.players.length; i++) {
            if (self.queue.id = player.id) {
                self.players.splice(i, 1);
            }
        }
    }

    self.sendQue = () => {
        server.emit('SET_QUEUE', self.getNextPlayers());
    }

    return self;
}

var GameStep = (playerQueue) => {
    var defs = {
        playerQueue: playerQueue,
        rolling: false,
        currentPlayer: null,
        currentTimer: null,
        partOfStep: 0,
        active: false,
        roundNumber: 0,
        waitingForPlayers: true,
        playersWaiting: 0
    }

    var self = {
        ...defs,
        active: false
    }

    self.nextPlayer = (firstPlayer = false) => {
        if (!firstPlayer) {
            self.playerQueue.nextPlayer();
        }
        self.currentPlayer = self.playerQueue.getCurrent();
        self.partOfStep = 0;
        self.playerQueue.sendQue();
    }

    self.finishStep = () => {
        delete self.currentTimer;
        self.nextPlayer();
    }

    self.update = () => {
        if (self.active) {
            if (self.partOfStep == 0) {
                if (!self.currentTimer) {
                    server.emit('DICE', {
                        rolling: true
                    });
                    rolling = true;

                    self.currentTimer = SpoolTimer(1000, (self) => {

                        var diceA = SpoolMath.randomInt(1, 6);
                        var diceB = SpoolMath.randomInt(1, 6);


                        self.currentPlayer.energyDelta(diceA + diceB);

                        console.log(`${self.currentPlayer.name} rolled ${diceA} and ${diceB}`)

                        server.emit('DICE', {
                            diceA: diceA,
                            diceB: diceB
                        })

                        self.partOfStep = 1;
                        delete currentTimer;

                        self.currentTimer = SpoolTimer(10000, () => {
                            self.finishStep();
                        })
                        server.emit('SET_TIMER', {
                            endTime: self.currentTimer.startTime + self.currentTimer.duration
                        })

                    }, self)
                }
            }

            //console.log(self.currentTimer.timeLeft);

            if (self.currentTimer) {
                self.currentTimer.update();
            }
        }
    }

    self.removePlayer = (player) => {
        playerQueue.remove(player);
        if (playerQueue.players.length == 0) {
            console.log('All players have disconnected, the round ended')
            self.end();
        }
        if (playerQueue.players.length == 1) {
            console.log('There is only one player thus he won?')

            server.emit('ALERT', {
                msg: 'Player ' +
                    playerQueue.players[0].name + ' remained last'
            });

            setTimeout(() => {
                self.end();
            }, 4000)
        }
    }

    self.onNewRound = () => {
        self.roundNumber += 1;

        if (self.roundNumber % 1 == 0) {
            MAP.removeOuterLayer();
        }
    }

    self.start = () => {

        if (!self.active) {
            self.playerQueue.refreshFromHandler();
            var numberOfPlayers = self.playerQueue.players.length;

            if (numberOfPlayers > 1) {
                MAP.spawnWorld();
                self.playerQueue.randomizeQueue();
                self.playerQueue.onNewRound = self.onNewRound;

                self.playerQueue.queue.forEach(player => {
                    player.startPosition(0, 0, {});
                    player.onDeath = () => {
                        self.removePlayer(player);
                    }
                })

                Object.assign(self, defs);
                console.log('Game started with', numberOfPlayers, 'players');
                self.nextPlayer(true);
                self.onNewRound();
                self.waitingForPlayers = false;
                self.active = true;
            }
        }
    }

    self.end = () => {
        self.active = false;
        MAP.spawnWaitingWorld();
    }

    self.pause = () => {
        self.active = false;
    }

    self.unpause = () => {
        self.active = true;
    }

    return self;
}

////// IMPLEMENTATION //////

var MAP = Map()
MAP.initBlankTiles(WORLD_LAYERS);

playerQueue = PlayerQueue();
gameStep = GameStep(playerQueue);

server.fullStart(Player)

server.onSocketCreated = (server, socket, player) => {
    socket.on('MOVE_TO', (data) => {

        var tile = MAP.getTile(data.tx, data.ty);
        if (tile.dead) {
            alertClient(socket, "You are trying to jump of the map bro?");
            return;
        }

        if (gameStep.waitingForPlayers) {
            player.moveTo(data.tx, data.ty, true);
        } else if (gameStep.active) {
            if (gameStep.currentPlayer.id == player.id) {
                if (tileDistance2T(player, data) == 1) {
                    var moved = player.moveTo(data.tx, data.ty);
                    if (!moved) {
                        alertClient(socket, "You don't have enough energy for that move");
                    }
                } else {
                    alertClient(socket, "That tile is out of your reach");
                }
            } else {
                alertClient(socket, "You aren't currently playing, wait for your round");
            }
        }
    })
}

server.updateCallback = () => {
    if (gameStep.active == false) {
        gameStep.start();
        if (gameStep.active == false) {
            gameStep.waitingForPlayers = true;
        }
    }
    gameStep.update();
}

server.onPlayerAddedToHandler = (player) => {
    player.alive = false;
    if (gameStep.waitingForPlayers) {
        player.startPosition(0, 0, {});
    }
}

server.onPlayerDisconnected = (server, socket, player) => {
    gameStep.removePlayer(player);
}