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
    SpoolUtils

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

    self.objectType = 'PLAYER';
    self.width = 50;
    self.height = 50;

    self.tx = 0;
    self.ty = 0;

    MAP.move(self, self.tx, self.ty);

    self.moveTo = (tx, ty) => {
        MAP.move(self, tx, ty);
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
            ...superSelf.initPack()
        }
    }

    self.updatePack = () => {
        return {
            objects: self.objects,
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
    }

    self.remove = (id) => {
        var i = self.objects.indexOf(id);
        console.log(id, self.objects);
        self.objects.splice(i, 1);
        console.log(self.objects);
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

    var layers = 4;

    var min = -1;
    var max = min + layers * 2 - 1;

    for (var y = 1 - layers; y < 0 + layers; y++) {
        for (var x = 1 - layers; x < 0 + layers; x++) {
            console.log(min, max);
            if (x > min && x <= max) {
                var tile = Tile({
                    tx: x,
                    ty: y,
                    z: Math.random() * 10
                })

                self.tiles[`[${x},${y}]`] = tile;
                server.handler.add(tile)
            }
        }
        min--;
        max--;
    }

    self.tileKey = (x, y) => {
        return `[${x},${y}]`
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

var MAP = Map()

server.fullStart(Player)

server.onSocketCreated = (server, socket, player) => {
    socket.on('MOVE_TO', (data) => {
        player.moveTo(data.tx, data.ty);
    })
}