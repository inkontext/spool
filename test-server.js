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

let {
    cards
} = require('./cards.json');

var CARDS = {}

cards.forEach(card => {
    CARDS[card.cardID] = card;
})

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


var DAMAGEFLOATERS = [];

////// OBJECTS //////

var Player = (initObject = {}) => {
    var self = Entity({
        ...initObject
    });

    var superSelf = {
        updatePack: self.updatePack,
        initPack: self.initPack
    }

    self.objectType = 'PLAYER';
    self.width = 42;
    self.height = 78;

    self.sendUpdatePackageAlways = true;
    self.name = 'Anonymous'

    //// DEFAULT VALUES AND STARTING POSITION ////

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
            maxAmmo: 10,
            ammo: 0,
            alive: true,
            hand: [],
            equip: {
                weapon: null,
                trinkets: []
            },
            stats: {},

            ...defs
        })
    }

    self.setDefs();

    //// MOVING ////

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

    //// UPDATE PACK ////

    self.initPack = () => {
        return {
            ...superSelf.initPack(),
            cardInfo: CARDS
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

            alive: self.alive,

            equip: self.equip,
            stats: self.stats,

            tile: self.tile ? {
                tx: self.tile.tx,
                ty: self.tile.ty,
                z: self.tile.z,
                leavingPrice: self.tile.leavingPrice,
                enteringPrice: self.tile.enteringPrice
            } : null,
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

    //// GAMESTEP ACTIONS ////

    self.damage = (dmg) => {
        console.log('player dmg:', dmg);
        self.deltaValue('hp', -dmg);
    }

    self.die = () => {
        self.alive = false;

        if (self.onDeath) {
            self.onDeath();
        }
    }

    //// CARDS ////

    self.give = (cards) => {
        self.hand = self.hand.concat(cards);
    }


    self.recalcEquip = () => {
        var stats = {};

        if (self.equip.weapon) {
            if (self.equip.weapon.stats) {
                Object.keys(self.equip.weapon.stats).forEach(key => {
                    if (!stats[key]) {
                        stats[key] = 0;
                    }
                    stats[key] += self.equip.weapon.stats[key];
                })
            }
        }
        self.equip.trinkets.forEach(trinket => {
            if (trinket.stats) {
                Object.keys(trinket.stats).forEach(key => {
                    if (!stats[key]) {
                        stats[key] = 0;
                    }
                    stats[key] += trinket.stats[key];
                })
            }
        })

        self.stats = stats;
    }

    self.playCard = (tile, cardid) => {
        if (self.hand.includes(cardid)) {
            var index = self.hand.indexOf(cardid);
            var card = CARDS[cardid];

            if (index != -1) {
                if (self.energy >= card.cost) {
                    if (tileDistance2T(self, tile) <= card.range) {
                        // WEAPONS 
                        if (card.type == 'weapon') {
                            self.equip.weapon = card;
                            self.recalcEquip();
                        }
                        if (card.type == 'trinket') {
                            self.equip.trinkets.push(card);
                            self.recalcEquip();
                        }

                        // SPELLS 
                        // SPECIAL 

                        if (card.type == 'spell' || card.type == 'special') {
                            if (card.action) {
                                // Add 
                                if (card.action.add) {
                                    Object.keys(card.action.add).forEach(element => {
                                        self.deltaValue(element, card.action.add[element]);
                                    });
                                }
                                // Remove 
                                if (card.action.removes) {
                                    Object.keys(card.action.removes).forEach(element => {
                                        self.deltaValue(element, card.action.removes[element]);
                                    });
                                }
                                // Special
                                if (card.action.actionString) {
                                    var words = card.action.actionString.split(' ');

                                    if (words[0] == 'splashdmg') {
                                        var dmg = parseInt(words[1]);
                                        var range = parseInt(words[2]);
                                        MAP.getTilesInRadius(tile.tx, tile.ty, range).forEach(tile => {
                                            tile.dealDamage(dmg, self);
                                        });
                                    }
                                    if (words[0] == 'rise') {
                                        var h = parseInt(words[1]);
                                        var minRange = parseInt(words[2]);
                                        var maxRange = parseInt(words[3]);

                                        MAP.getTilesInRadius(tile.tx, tile.ty, maxRange, minRange).forEach(tile => {
                                            tile.z += h
                                        });
                                    }
                                }
                            } else {
                                console.log('Every spell card needs an action');
                            }
                        }

                        self.hand.splice(index, 1);
                    } else {
                        return "That tile is not in the range of the card"
                    }
                } else {
                    return "You don't have enough energy"
                }
            } else {
                return "You don't have that card"
            }
        }
    }

    self.useWeapon = (tile) => {
        var weapon = self.equip.weapon;
        if (weapon) {

            if (weapon.dmg) {

                console.log(weapon.ammoConsuption)

                if (weapon.ammoConsuption) {

                    if (self.ammo >= weapon.ammoConsuption) {
                        self.deltaValue('ammo', -weapon.ammoConsuption);
                    } else {
                        return "You don't have enough ammo";
                    }
                }
                tile.dealDamage(weapon.dmg, self);
            } else {
                console.log("This weapon doesn't have damage");
                console.log(weapon);
            }

        } else {
            return "You don't have any weapon";
        }
    }

    self.deltaValue = (type, value) => {
        if (self[type] == undefined) {
            console.log('Player with id: ', self.id, "doesn't have", `'${type}'`);
            self[type] = 0;
        }
        self[type] += value;

        var max = null;
        var min = null;
        var minAction = null;
        var maxAction = null;

        if (type == 'hp') {
            max = self.maxHp;
            min = 0;
            minAction = self.die
        }

        if (type == 'energy') {
            max = self.maxEnergy;
            min = 0;
        }

        if (type == 'ammo') {
            max = self.maxAmmo;
            min = 0;
        }

        if (max ? self[type] > max : false) {
            self[type] = max;
            if (maxAction) {
                maxAction();
            }
        }

        if (min !== null ? self[type] < min : false) {
            self[type] = min;
            if (minAction) {
                minAction();
            }
        }
    }

    return self;
}

var Box = (initObject) => {
    var self = Entity({
        objectType: 'BOX',
        width: 48,
        height: 48,
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

        self.objects.sort((aid, bid) => {
            var a = server.handler.objectsById[aid]
            var b = server.handler.objectsById[bid]
            if (a && b) {
                var aoff = a.yOffset ? a.yOffset : 0;
                var boff = b.yOffset ? b.yOffset : 0;
                return aoff - boff;
            }
        })

        self.setAsyncUpdateValue('objects', self.objects);
    }

    self.remove = (id) => {
        var i = self.objects.indexOf(id);
        self.objects.splice(i, 1);
        self.setAsyncUpdateValue('objects', self.objects);
    }

    self.setBiomeParameters = (biome, leavingPrice, enteringPrice) => {
        self.biome = biome;
        self.leavingPrice = leavingPrice;
        self.enteringPrice = enteringPrice;
    }

    self.setBiome = (biome) => {
        switch (biome) {
            case 'grass':
                self.setBiomeParameters(biome, 0, 1);
                break;
            case 'water':
                self.setBiomeParameters(biome, 1, 1);
                break;
            case 'stone':
                self.setBiomeParameters(biome, 0, 1);
                break;
            case 'sand':
                self.setBiomeParameters(biome, 0, 1);
                break;
            default:
                self.setBiomeParameters(biome, 0, 1);
                break;
        }
    }

    self.reset = () => {
        self.z = 0;
        self.zRandomOffset = 0;
        self.dead = false;
        self.objects = [];
        self.setBiome('grass');
    }

    self.addNature = (nature, count = 1) => {
        for (var i = 0; i < count; i++) {
            var nat = Nature({
                natureType: nature
            })
            server.handler.add(nat);
            self.add(nat.id);

        }
    }

    // DAMAGE //

    self.dealDamage = (damage, player = null) => {
        self.objects.forEach(id => {
            var temp = server.handler.objectsById[id];
            if (temp) {

                if (player ? temp.id != player.id : true) {
                    if (temp.damage) {
                        temp.damage(damage)
                    }
                }
            }
        })
        DAMAGEFLOATERS.push({
            x: self.x,
            y: self.y,
            z: self.z,
            dmg: damage
        });
    }




    return self;
}

var Nature = (initObject) => {
    var self = Entity({
        natureType: 'bush',
        ...initObject
    });

    var superSelf = {
        initPack: self.initPack
    }

    self.width = 64;
    self.height = 64;
    self.objectType = 'NATURE';

    self.xOffset = (Math.random() - 0.5) * TILE_WIDTH
    self.yOffset = (Math.random() - 0.5) * TILE_WIDTH


    self.variationId = SpoolMath.randomInt(0, 3);

    self.initPack = () => {
        return {
            ...superSelf.initPack(),
            natureType: self.natureType,
            variationId: self.variationId,
            xOffset: self.xOffset,
            yOffset: self.yOffset
        }
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

    self.astarNode = (tile, g, h, parent = null) => {
        return {
            x: tile.tx,
            y: tile.ty,
            f: g + h,
            g,
            h,
            parent: parent,
            tile,
            key: self.tileKey(tile.tx, tile.ty)
        }
    }

    self.findShortestPath = (ax, ay, bx, by) => {
        var open = []
        var closed = []

        var targetTile = self.getTile(bx, by);

        var closedKeys = [];

        open.push(
            self.astarNode(self.getTile(ax, ay), 0, SpoolMath.distance(ax, ay, bx, by))
        );

        var resTile = null;

        while (open.length > 0) {
            open.sort((a, b) => a.f - b.f);
            currentNode = open[0];

            if (currentNode.x == bx && currentNode.y == by) {
                resTile = currentNode;
                break;
            }
            open.splice(0, 1);
            closed.push(currentNode);
            closedKeys.push(currentNode.key)

            var neighboars = self.getTilesInRadius(currentNode.x, currentNode.y, 1, 1);

            neighboars.forEach(tile => {
                var key = self.tileKey(tile.tx, tile.ty);
                if (!closedKeys.includes(key)) {

                    var openListInstance = null;
                    for (var i = 0; i < open.length; i++) {
                        if (open[i].key == key) {
                            openListInstance = open[i];
                            break;
                        }
                    }

                    var price = movingPrice(currentNode.tile, tile);

                    if (!openListInstance) {
                        open.push(self.astarNode(tile, currentNode.g + price, SpoolMath.distance(tile.x, tile.y, bx, by), currentNode));
                    } else {
                        if (openListInstance.parent) {
                            if (openListInstance.parent.g > currentNode.g) {
                                openListInstance.parent = currentNode;
                                openListInstance.g = currentNode.g + price;
                                openListInstance.f = openListInstance.g + openListInstance.h;
                            }
                        }
                    }
                }
            })
        }

        if (!resTile) {
            return null;
        } else {
            res = []
            var temp = resTile;
            while (temp) {
                res.push([temp.x, temp.y]);
                temp = temp.parent;
            }
            return res;
        }

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
        r += 1;
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

            tile.reset();

            tile.z = Math.round(noiseValue * 6);
            tile.zRandomOffset = Math.random();

        })

        for (var i = 0; i < 3; i++) {
            key = SpoolMath.randomChoice(self.possibleCoords);
            self.spawnCliff(key[0], key[1], SpoolMath.randomInt(1, 2), SpoolMath.randomInt(5, 10));
        }


        for (var i = 0; i < 3; i++) {
            key = SpoolMath.randomChoice(self.possibleCoords);
            self.spawnLake(key[0], key[1], SpoolMath.randomInt(1, 2))
        }

        for (var i = 0; i < 3; i++) {
            key = SpoolMath.randomChoice(self.possibleCoords);
            self.spawnBox(key[0], key[1]);
        }

        keys.forEach(key => {
            var tile = self.tiles[key];

            var pack = tile.initPack();

            if (tile.biome == 'grass') {

                tile.addNature('grass', 3);

            }
            tile.addAsyncUpdatePackage(pack);
        })
    }

    self.spawnWaitingWorld = () => {
        var keys = Object.keys(self.tiles);

        console.log("MAP: waiting world spawned");

        keys.forEach(key => {
            var tile = self.tiles[key];
            tile.reset()
        })

        for (var i = 0; i < 3; i++) {
            key = SpoolMath.randomChoice(self.possibleCoords);
            self.spawnCliff(key[0], key[1], SpoolMath.randomInt(1, 2), SpoolMath.randomInt(5, 10));
        }

        for (var i = 0; i < 3; i++) {
            key = SpoolMath.randomChoice(self.possibleCoords);
            self.spawnLake(key[0], key[1], SpoolMath.randomInt(1, 2))
        }

        for (var i = 0; i < 3; i++) {
            key = SpoolMath.randomChoice(self.possibleCoords);
            self.spawnBox(key[0], key[1]);
        }

        keys.forEach(key => {
            var tile = self.tiles[key];

            if (tile.biome == 'grass') {
                for (var g = 0; g < 5; g++) {
                    tile.addNature('grass');
                }
            }

            tile.addAsyncUpdatePackage(tile.initPack());
        })
    }

    //// SPAWNING FEATURES //// 

    self.spawnBox = (x, y) => {
        var box = Box({
            cards: ['bullets', 'bullets', 'slingshot']
        });
        server.handler.add(box);
        self.getTile(x, y).add(box.id);
    }

    self.spawnCliff = (x, y, r, height) => {
        self.getTilesInRadius(x, y, r).forEach(tile => {
            if (tile.biome != 'stone') {
                tile.setBiome('stone');
                tile.z = height + SpoolMath.randomInt(1, 3)

                tile.addNature('stone', 3);
            }
        })
    }

    self.spawnLake = (x, y, r) => {
        self.getTilesInRadius(x, y, r, r).forEach(tile => {
            if (tile.biome == 'grass') {
                tile.setBiome('sand');
                tile.z = 0;
            }
        })
        self.getTilesInRadius(x, y, r).forEach(tile => {
            if (tile.biome == 'grass') {
                tile.setBiome('water');

                tile.zRandomOffset = -1;
                tile.z = 0;
            }
        })
    }

    self.spawnRiver = (ax, ay, bx, by) => {
        var path = self.findShortestPath(ax, ay, bx, by);

        if (path) {
            path.forEach(value => {
                var tile = self.tiles[self.tileKey(value[0], value[1])]
                tile.biome = 'water';
                tile.addAsyncUpdatePackage(tile.initPack());
            })
        }
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
        server.emit('SET_QUEUE', {
            queue: self.getNextPlayers(),
            currentPlayerId: self.getCurrent() ? self.getCurrent().id : null
        });
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

                        self.currentTimer = SpoolTimer(30000, () => {
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
                    player.give(['shovel', 'slingshot', 'bullets'])
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
MAP.spawnWaitingWorld();

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

    socket.on('CARD_ACTION', (data) => {
        var tile = MAP.getTile(data.tx, data.ty);

        if (tile.dead) {
            alertClient(socket, "You can't use cards on dead tiles");
            return;
        }

        if (gameStep.active || gameStep.waitingForPlayers) {
            if (gameStep.waitingForPlayers ? true : gameStep.currentPlayer.id == player.id) {
                if (data.type == 'card') {
                    console.log(data.cardid);
                    var res = player.playCard(tile, data.cardid);
                    if (res) {
                        alertClient(socket, res);
                    }
                } else if (data.type == 'weapon') {
                    var res = player.useWeapon(tile);
                    if (res) {
                        alertClient(socket, res);
                    }
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

    if (DAMAGEFLOATERS.length != 0) {
        server.emit('DAMAGE_FLOATERS', DAMAGEFLOATERS);
        DAMAGEFLOATERS = [];
    }

    gameStep.update();
}

server.onPlayerAddedToHandler = (player) => {
    player.alive = false;
    if (gameStep.waitingForPlayers) {
        player.startPosition(0, 0, {});
    }

    console.log(Object.keys(server.handler.objects['PLAYER']))
}

server.onPlayerDisconnected = (server, socket, player) => {
    gameStep.removePlayer(player);
}