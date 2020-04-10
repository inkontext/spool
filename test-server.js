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
    SpoolTimer

} = require('./spoolserver.js');

var {
    FileReader
} = require('./spoolfilereader.js');

////// SETTING UP SERVER //////

var server = Server({
    port: 4000,
    TPS: 55,
    chunkSize: 300
}, ['/', '/textures'])


var Player = (initObject) => {
    var self = Entity(initObject);

    superSelf = {
        updatePack: self.updatePack
    }

    self.objectType = 'PLAYER';
    self.width = 50;
    self.height = 50;

    self.tx = 0;
    self.ty = 0;

    self.energy = 0;

    MAP.move(self, self.tx, self.ty);

    self.moveTo = (tx, ty) => {

        var temp = MAP.getTile(tx, ty);
        var price = Math.abs(temp.z - self.tile.z);

        console.log(price);

        if (self.energy >= price) {
            MAP.move(self, tx, ty);
            self.energy -= price
            return true;
        } else {
            return false;
        }
    }

    self.updatePack = () => {
        return {
            ...superSelf.updatePack(),
            z: self.tile ? self.tile.z : -1,
            energy: self.energy
        }
    }

    self.setName = (name) => {
        self.name = name;
        self.setAsyncUpdateValue('name', self.name);
    }

    return self;
}

var TILE_WIDTH = 60;

var Tile = (initObject) => {
    var self = Entity(initObject);

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

    self.hexRadius = TILE_WIDTH;

    self.objects = [];

    self.initPack = () => {
        return {
            z: self.z,
            tx: self.tx,
            ty: self.ty,
            hexRadius: self.hexRadius,
            objects: [],
            ...superSelf.initPack()
        }
    }

    self.updatePack = () => {
        return {
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
        console.log
    }

    return self;
}

var transformTileCoordToRealCord = (x, y) => {
    return {
        x: x * TILE_WIDTH * 3 / 2,
        y: y * TILE_WIDTH * 2 * Math.sin(Math.PI / 3) + x * TILE_WIDTH * Math.sin(Math.PI / 3)
    }
}

var Map = () => {

    var self = {}

    self.tiles = {}

    var layers = 2;

    var min = -1;
    var max = min + layers * 2 - 1;


    self.tileKey = (x, y) => {
        return `[${x},${y}]`
    }

    for (var y = 1 - layers; y < 0 + layers; y++) {
        for (var x = 1 - layers; x < 0 + layers; x++) {
            console.log(min, max);
            if (x > min && x <= max) {
                var tile = Tile({
                    tx: x,
                    ty: y,
                    z: SpoolMath.randomInt(1, 10)
                })

                self.tiles[self.tileKey(x, y)] = tile;
                server.handler.add(tile)
            }
        }
        min--;
        max--;
    }

    self.getTile = (x, y) => {
        return self.tiles[self.tileKey(x, y)];
    }

    self.move = (obj, tx, ty) => {
        if (obj.tile) {
            obj.tile.remove(obj.id);
        }
        var temp = self.tiles[self.tileKey(tx, ty)]
        temp.moveIn(obj);

        obj.tile = temp;
        console.log(obj.tile.tx, obj.tile.ty);
        obj.tx = tx;
        obj.ty = ty;
    }

    return self;
}

var CHARACTERS = [
    'Bob',
    'Joe',
    'Adel',
    'Jack',
    'Andy',
    'Sanches'
];

var MAP = Map()

var PlayerQueue = () => {
    var self = {
        players: [],
        queue: []
    };

    self.moveToBack = () => {
        var temp = self.queue[0];
        self.queue.splice(0, 1);
        self.queue.push(temp);
    }

    self.refreshFromHandler = () => {
        if (server.handler.objects['PLAYER']) {

            self.players = []
            Object.keys(server.handler.objects['PLAYER']).forEach(key => {
                self.players.push(server.handler.objects['PLAYER'][key])
            });
        }
    }

    self.randomizeQueue = () => {
        self.queue = [...self.players];
        self.names = [...CHARACTERS];

        SpoolUtils.shuffle(self.names);
        SpoolUtils.shuffle(self.queue);

        for (var i = 0; i < self.queue.length; i++) {
            self.queue[i].setName(self.names[i]);
        }
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
    }

    var self = {
        ...defs,
        active: false
    }

    self.nextPlayer = () => {
        self.playerQueue.moveToBack();
        self.currentPlayer = playerQueue.queue[0];
        self.partOfStep = 0;

        server.emit('SET_QUEUE', self.playerQueue.queue.map(value => value.name));
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

                        self.currentPlayer.energy += diceA + diceB;

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

    self.start = () => {
        self.playerQueue.refreshFromHandler();
        self.playerQueue.randomizeQueue();
        Object.assign(self, defs);
        self.nextPlayer();
        self.active = true;

    }

    self.end = () => {
        self.active = false;
    }

    self.pause = () => {
        self.active = false;
    }

    self.unpause = () => {
        self.active = true;
    }

    return self;
}

playerQueue = PlayerQueue();
gameStep = GameStep(playerQueue);

server.fullStart(Player)

server.onSocketCreated = (server, socket, player) => {
    socket.on('MOVE_TO', (data) => {
        if (gameStep.currentPlayer.id == player.id) {
            var moved = player.moveTo(data.tx, data.ty);
            if (!moved) {
                socket.emit('ALERT', {
                    msg: "You don't have enough energy for that move"
                })
            }
        } else {
            socket.emit('ALERT', {
                msg: "You aren't currently playing, wait for your round"
            })
        }
    })


}

server.updateCallback = () => {
    gameStep.update();
}

server.onPlayerAddedToHandler = (player) => {
    gameStep.end();
    gameStep.start();
}