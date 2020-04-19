////// FUNCTIONS //////

//// SERVER - CLIENT ////

function tileDistance(ax, ay, bx, by) {
    return (Math.abs(bx - ax) + Math.abs(by - ay) + Math.abs(bx + by - ax - ay)) / 2
}

function tileDistance2T(a, b) {
    return tileDistance(a.tx, a.ty, b.tx, b.ty);
}

function movingPrice(tilea, tileb, playerMovingPrice = 0) {
    if (tilea.z !== undefined && tilea.leavingPrice !== undefined && tileb.z !== undefined && tileb.enteringPrice !== undefined) {
        var res = Math.abs(tilea.z - tileb.z) + tilea.leavingPrice + tileb.enteringPrice + playerMovingPrice;
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

function getStat(player, name, delta = 0) {
    if (['range', 'sight'].includes(name) && player) {
        return player.stats[name] ? player.stats[name] + delta : delta;
    } else {
        return 0;
    }
}

////// CLIENT //////

function renderVialValue(ctx, color, value, maxValue, box, text = null) {
    SpoolRenderer.setColor(ctx, '#333333');
    var newBox = SpoolRect(box.x + 5, box.y + 5, box.width - 10, box.height - 10);
    ctx.drawImage(textureManager.getSprite('hotbarbg_sq', 1), box.x + 5, box.y + 5, box.width - 10, box.height - 10);

    SpoolRenderer.setColor(ctx, color);
    SpoolRenderer.fillInscribedOvalPercentFull(ctx, newBox, value / maxValue);
    ctx.imageSmoothingEnabled = false;


    ctx.drawImage(textureManager.getSprite('ring'), box.x, box.y, box.width, box.height);

    SpoolRenderer.setColor(ctx, 'white');
    ctx.strokeStyle = 'black';
    SpoolRenderer.multiLineText(ctx, text ? text : value.toString(), box, box.width, FONT_OFFSETCOEF, 3);
}

function getTileInPoint(x, y, cb = colBoxes) {
    var res = null;
    Object.keys(cb).forEach(key => {
        var box = cb[key];
        if (SpoolMath.distance(x, y, box.x, box.y) <= box.radius) {
            res = box.tile;
        }
    })
    return res;
}

////// CLIENT //////

var Z_SCALINGFACTOR_MAX = 10;
var Z_SCALINGFACTOR_MIN = 2;
var Z_SCALINGFACTOR = Z_SCALINGFACTOR_MAX;
var Z_SCALINGENABLED = true;

var colBoxes = {};
var movingColBoxes = {};

var client = null;

var FONT = "'dpcomic'"
var FONT_OFFSETCOEF = 0.2;

var BUFFS = {
    'freezing': {
        textureId: 0,
        tooltip: 'makes moving harder'
    },
    'burning': {
        textureId: 1,
        tooltip: 'deals 1 damage on the start of every turn'
    },
    'silence': {
        textureId: 2,
        tooltip: "You can't play cards (you can use your weapon)"
    }
}

BIOME_COLORS = {
    'grass': '#a0d964',
    'stone': '#757575',
    'sand': '#f0e089',
    'water': '#0077be',
    'dead': '#444444',
    'bush': '#13612d',
}

BIOME_TEXTROWS = {
    'grass': 3,
    'stone': 4,
    'sand': 2,
    'water': 1,
    'dead': 0,
    'bush': 3,
}

NATURE_TEXTROWS = {
    'bush': 0,
    'grass': 1,
    'stone': 2,
}

TILE_SELECTOR_FCOUNTER = 0;
TILE_SELECTOR_INDEX = 0;
TILE_SELECTOR_LENGTH = 5;

var SELECTOR = {
    activatedCard: null,
    selectedTx: null,
    selectedTy: null,
}

var Tile = (initObject) => {
    var self = Entity({
        ...initObject,
        lastBiome: null
    });

    var superSelf = {
        render: self.render
    }

    self.deadColor = '#444444';
    self.baseColor = '#b58d65'
    self.baseDark = ['#a37a52', '#a8835e', '#c2a07e']

    self.topColor = BIOME_COLORS[self.biome]

    self.renderZ = self.z;
    self.renderR = 0;

    self.color = SpoolMath.randomColor(100, 255);
    self.darkColor = SpoolMath.divideColor(self.color, 2);

    self.textureId = SpoolMath.randomInt(0, 3);
    self.biome;
    self.frameCounter = 0;

    self.update = (data) => {
        Object.assign(self, data);
    }

    self.render = (ctx, camera) => {
        // Calculating the distance from the player
        var distanceFromPlayer = client.clientObject ? client.clientObject.tile ? tileDistance2T(client.clientObject.tile, self) : null : null;

        delete colBoxes[self.id];
        delete movingColBoxes[self.id];

        // Not rendering tile if not in sight (not secure)

        var sight = getStat(client.clientObject, 'sight', 3)

        if (distanceFromPlayer) {
            if (distanceFromPlayer > sight) {
                self.renderR = SpoolMath.lerp(self.renderR, self.hexRadius, 0)
                return;
            }
        }

        // Adding to animationFrame (at top because of the returns at the bottom)

        if (self.biome == 'water') {
            self.frameCounter += 1;
            if (self.frameCounter >= 20) {
                self.frameCounter = 0;
                self.animationFrame += 1;
                if (self.animationFrame >= 4) {
                    self.animationFrame = 0;
                }
            }
        }



        // Calculating tile radius (small if on the border of sight)

        var r = self.hexRadius;

        if (distanceFromPlayer) {
            if (distanceFromPlayer > sight - 1) {
                self.renderR = SpoolMath.lerp(self.renderR, self.hexRadius / 2, 0.2)
            } else {
                self.renderR = SpoolMath.lerp(self.renderR, self.hexRadius, 0.2)
            }
        } else {
            self.renderR = SpoolMath.lerp(self.renderR, self.hexRadius, 0.2)
        }

        var r = self.renderR;

        // Calculating the hexagons points

        var startAngle = 0;
        var n = 6;

        var points = []
        var pointsDown = []
        var pointsInner = []

        var innerRadiusFactor = 0.8;

        self.renderZ = SpoolMath.lerp(self.renderZ, self.z, 0.2);

        var zOffset = self.renderZ * Z_SCALINGFACTOR + self.zRandomOffset * Z_SCALINGFACTOR * 1;

        for (var i = 0; i < n; i++) {
            angle = startAngle + Math.PI * 2 / n * i;
            var point = camera.transformPoint(self.x - r * Math.cos(angle), self.y - r * Math.sin(angle));
            var pointInner = camera.transformPoint(self.x - r * innerRadiusFactor * Math.cos(angle), self.y - r * innerRadiusFactor * Math.sin(angle))
            pointInner.y -= zOffset
            pointsDown.push(point);
            pointsInner.push(pointInner);
            points.push({
                x: point.x,
                y: point.y - zOffset
            })
        }

        ctx.imageSmoothingEnabled = false;

        var rectHeight = client.gameArea.height - points[0].y;

        // Drawing the faces that go down to the void

        ctx.fillStyle = self.baseDark[0];
        ctx.fillRect(points[0].x, points[0].y, points[1].x - points[0].x, rectHeight)
        ctx.fillStyle = self.baseDark[1];
        ctx.fillRect(points[1].x, points[0].y, points[2].x - points[1].x, rectHeight)
        ctx.fillStyle = self.baseDark[2];
        ctx.fillRect(points[2].x, points[0].y, points[3].x - points[2].x, rectHeight)

        // Calculating the upper centerp point

        colPoint = camera.transformPoint(self.x, self.y);
        colBox = {
            x: colPoint.x,
            y: colPoint.y - zOffset,
            radius: camera.transformDimension(self.hexRadius) * Math.sin(Math.PI / 3),
            tile: self
        }
        colBoxes[self.id] = colBox;

        var t_width = r * 2;


        // Changing sprites if biome changed
        if (((self.biome != self.lastBiome && !self.dead) || (self.lastBiome != 'dead' && self.dead)) && false) {
            self.sprite = textureManager.getSprite('tiles', BIOME_TEXTROWS[self.dead ? 'dead' : self.biome] * 4 + (self.textureId + self.animationFrame) % 4)
            self.resizedSprite = null;
            textureManager.resizeSprite(self.sprite, self.hexRadius * 2, self.hexRadius * 2 / self.sprite.width * self.sprite.height, (result) => {
                self.resizedSprite = result;
            })
            if (self.dead) {
                self.lastBiome = 'dead';
            } else {
                self.lastBiome = self.biome;
            }
        }

        if ((self.resizedSprite && Math.abs(self.renderR - self.hexRadius) < 2 && self.animationFrame == 0) && false) {
            var t_height = self.resizedSprite.height;
            ctx.drawImage(self.resizedSprite, colBox.x - self.resizedSprite.width / 2, colBox.y - self.resizedSprite.height / 2);
        } else {
            var sprite = textureManager.getSprite('tiles', BIOME_TEXTROWS[self.dead ? 'dead' : self.biome] * 4 + (self.textureId + self.animationFrame) % 4)
            var t_height = t_width / sprite.width * sprite.height;
            ctx.drawImage(sprite, colBox.x - t_width / 2, colBox.y - t_height / 2, t_width, t_height);
        }

        if (distanceFromPlayer) {
            if (distanceFromPlayer > sight - 1) {
                return;
            }
        }

        self.objects.forEach(object => {
            var temp = client.handler.objectsById[object];
            if (temp) {
                temp.renderOnTile(ctx, camera, colBox.x, colBox.y);
            }
        })


        if (client.handUi) {
            if (SELECTOR.activatedCard) {

                var selectorId = null;
                var selectorZOffset = 0;

                if (distanceFromPlayer <= getStat(client.clientObject, 'range', SELECTOR.activatedCard.range)) {
                    selectorId = 0;
                }


                if (SELECTOR.selectedTx != null && SELECTOR.selectedTy != null) {
                    var distanceFromAction = tileDistance(SELECTOR.selectedTx, SELECTOR.selectedTy, self.tx, self.ty)
                }

                if (distanceFromAction !== undefined) {

                    if (SELECTOR.activatedCard.effectArea) {
                        var area = SELECTOR.activatedCard.effectArea;
                        if (area.type == 'radius') {
                            if ((area.value.max !== undefined ? distanceFromAction <= area.value.max : true) && (area.value.min !== undefined ? distanceFromAction >= area.value.min : true)) {
                                selectorId = SELECTOR.validPosition ? 1 : 2;
                            }
                        }
                    } else {
                        if (distanceFromAction === 0) {
                            selectorId = SELECTOR.validPosition ? 1 : 2;
                        }
                    }
                }

                if (selectorId != null) {
                    var selectorWidth = t_width * 1 / 2;
                    var selectorHeight = t_height * 1 / 2;
                    var selectorZ = 10;
                    ctx.drawImage(textureManager.getSprite('tileselector', selectorId * 4 + TILE_SELECTOR_INDEX), colBox.x - selectorWidth / 2, colBox.y - selectorHeight / 2 - selectorZ - selectorZOffset, selectorWidth, selectorHeight);
                }
            }
        }

        if (client.clientObject && !self.dead) {
            if (client.clientObject.tile) {
                if (distanceFromPlayer == 1) {
                    SpoolRenderer.setFont(ctx, FONT, 25);
                    SpoolRenderer.setColor(ctx, 'white');

                    var price = movingPrice(client.clientObject.tile, self, client.clientObject.movingPrice);

                    ctx.strokeStyle = 'black';
                    SpoolRenderer.multiLineText(ctx, `${price}`, SpoolRect(colBox.x, colBox.y, 0, 0), 100, FONT_OFFSETCOEF, 3)
                    movingColBoxes[self.id] = colBox;
                }
            }
        }

        // SpoolRenderer.setFont(ctx, FONT, 25);
        // SpoolRenderer.setColor(ctx, 'white');

        // var price = movingPrice(self, client.clientObject.tile);

        // ctx.strokeStyle = 'black';
        // SpoolRenderer.multiLineText(ctx, `${self.tx} ${self.ty}`, SpoolRect(colBox.x, colBox.y, 0, 0), 100, FONT_OFFSETCOEF, 3)

    }

    return self;
}

var StandableEntity = (initObject) => {
    var self = RectangleEntity({
        ...initObject
    })

    self.render = () => {};

    self.renderOnTile = (ctx, camera, tilex, tiley) => {
        SpoolRenderer.setColor(ctx, 'red');
        var textureOffsetY = self.textureOffsetY ? self.textureOffsetY : 0;
        if (self.sprite) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(self.sprite, tilex - self.width / 2, tiley - self.height + textureOffsetY, self.width, self.height);
        } else {
            SpoolRenderer.fillRect(ctx, tilex - self.width / 2, tiley - self.height, self.width, self.height);
        }
    }

    return self;
}

var Player = (initObject) => {
    var self = MovementAnimationEntity({
        ...initObject,
        currentX: null,
        currentY: null,
    })

    var superSelf = {
        render: self.render
    }

    self.render = () => {};

    self.renderOnTile = (ctx, camera, tilex, tiley) => {
        var index = self.getMovementAnimationSpriteIndex(false, 0);
        var textureOffsetY = self.textureOffsetY ? self.textureOffsetY : 0;
        ctx.drawImage(self.texture.sprites[index], tilex - self.width / 2, tiley - self.height + textureOffsetY, self.width, self.height)

        if (client.clientObject) {
            if (client.clientObject.id != self.id) {
                var nameY = tiley - self.height - 10;
                ctx.fillStyle = 'white';
                ctx.strokeStyle = 'black';
                SpoolRenderer.setFont(ctx, FONT, 20);
                SpoolRenderer.simpleText(ctx, `${self.name} ${self.hp}/${self.maxHp}`, tilex, nameY, 3)
            }
        }
        // Counter

        if (self.animationCounter == self.animationTime) {
            if (self.texture) {
                self.animationFrame += 1;
                if (self.animationFrame == self.texture.columns) {
                    self.animationFrame = 0;
                }
            }

            self.animationCounter = 0;
        } else {
            self.animationCounter += 1;
        }
    }

    return self;
}

var Nature = (initObject) => {
    var self = RectangleEntity({
        ...initObject
    })

    self.render = () => {};

    textureManager.resizeSprite(textureManager.getSprite('nature', NATURE_TEXTROWS[self.natureType] * 4 + self.variationId), self.width, self.height, (result) => {
        self.sprite = result;
    })

    self.renderOnTile = (ctx, camera, tilex, tiley) => {
        if (!self.sprite) {
            var sprite = textureManager.getSprite('nature', NATURE_TEXTROWS[self.natureType] * 4 + self.variationId);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(sprite, tilex - self.width / 2 + self.xOffset, tiley - self.height + self.yOffset * camera.scaleY);
        } else {
            ctx.drawImage(self.sprite, tilex - self.width / 2 + self.xOffset, tiley - self.height + self.yOffset * camera.scaleY)
        }
    }

    return self;
}

var OBJECTS = {
    'TILE': {
        const: Tile
    },
    'PLAYER': {
        const: Player
    },
    'BOX': {
        const: StandableEntity,
        defs: {
            textureOffsetY: 12,
            yOffset: 10
        }
    },
    'NATURE': {
        const: Nature
    }
}

textureManager = TextureManager({
    'cards': {
        src: './textures/full_stack.png',
        r: 5,
        c: 5,
    },
    'buffs': {
        src: './textures/buffs.png',
        r: 1,
        c: 3,
    },
    'tiles': {
        src: './textures/tiles.png',
        r: 6,
        c: 4,
    },
    'tileselector': {
        src: './textures/tileselector.png',
        r: 4,
        c: 4,
    },
    'boxes': {
        src: './textures/boxes.png',
        r: 2,
        c: 2,
    },
    'ring': {
        src: './textures/ring.png',
        r: 1,
        c: 1,
    },
    'queuegems': {
        src: './textures/queuegems.png',
        r: 3,
        c: 1,
    },
    'nature': {
        src: './textures/nature.png',
        r: 3,
        c: 4,
    },
    'dice': {
        src: './textures/dice.png',
        r: 1,
        c: 6,
    },
    'player': {
        src: './textures/player.png',
        r: 9,
        c: 8
    },
    'hotbarbg': {
        src: './textures/hotbarbg.png',
        r: 1,
        c: 1,
    },
    'hotbarbg_sq': {
        src: './textures/hotbarbg_sq.png',
        r: 1,
        c: 2,
    },
    'cursors': {
        src: './textures/cursors.png',
        r: 1,
        c: 3,
    },
    'pictograms': {
        src: './textures/pictograms.png',
        r: 1,
        c: 2,
    }
}, {
    'BOX': {
        src: 'boxes',
        x: 0,
        y: 0,
        xx: 0,
        yy: 0,
    },
    'PLAYER': {
        src: 'player'
    }
})

client = Client({
    keyToConstructor: OBJECTS,
    FPS: 70
});

client.preHandler = () => {
    if (Z_SCALINGENABLED) {
        Z_SCALINGFACTOR = SpoolMath.lerp(Z_SCALINGFACTOR, Z_SCALINGFACTOR_MAX, 0.5)
    } else {
        Z_SCALINGFACTOR = SpoolMath.lerp(Z_SCALINGFACTOR, Z_SCALINGFACTOR_MIN, 0.5)
    }
    TILE_SELECTOR_FCOUNTER += 1;
    if (TILE_SELECTOR_FCOUNTER >= TILE_SELECTOR_LENGTH) {
        TILE_SELECTOR_FCOUNTER = 0;
        TILE_SELECTOR_INDEX += 1;
        if (TILE_SELECTOR_INDEX >= 4) {
            TILE_SELECTOR_INDEX = 0;
        }
    }
}

client.camera.scaleY = 0.8



////// UI //////

//// VIAL ////


var VialInformation = (initObject) => {
    var self = SpoolUIElement({
        ...initObject,
        active: false,
        width: 100,
        height: 100
    })

    self.render = (ctx) => {
        if (self.active) {
            ctx.drawImage(textureManager.getSprite('hotbarbg_sq', 0), self.x, self.y, self.width, self.height)

            SpoolRenderer.setColor(ctx, 'white');
            SpoolRenderer.multiLineText(ctx, `${self.title}\n${self.value}/${self.maxValue}`, self, self.width, FONT_OFFSETCOEF);

        }
    }

    return self;
}

var VialButton = (initObject) => {
    var self = SpoolUIElement({

        value: 0,
        maxValue: 1,
        title: 'vial',
        pulsing: false,
        pulsingAmplitude: 10,

        ...initObject,
        id: Math.random(),
        pulseFrame: 0,
    });

    self.onMouseEnter = (event, self) => {
        client.vialInformation.x = event.clientX;
        client.vialInformation.y = event.clientY;
        client.vialInformation.title = self.title;
        client.vialInformation.value = self.value;
        client.vialInformation.maxValue = self.maxValue;
        client.vialInformation.active = true;
        client.vialInformation.id = self.id;
    }

    self.onMouseLeave = (event, self) => {
        if (client.vialInformation.id == self.id) {
            client.vialInformation.active = false;
            client.vialInformation.id = null;
        }
    }

    self.render = (ctx) => {

        if (self.pulsing && self.maxValue != 0) {
            var pulseAnimationCoef = (Math.sin(self.pulseFrame) + 1) / 2;
            var pulseCoef = (self.maxValue - self.value) / self.maxValue;
            var pulseRadius = pulseAnimationCoef * pulseCoef * self.pulsingAmplitude;

            renderVialValue(ctx, self.color, self.value, self.maxValue, SpoolRect(self.x - pulseRadius, self.y - pulseRadius, self.width + pulseRadius * 2, self.height + pulseRadius * 2), self.overrideText);
            self.pulseFrame += Math.sin(pulseCoef * Math.PI / 2) * 0.2;

            if (self.pulseFrame > Math.PI * 2) {
                self.pulseFrame -= Math.PI * 2
            }
        } else {
            renderVialValue(ctx, self.color, self.value, self.maxValue, SpoolRect(self.x, self.y, self.width, self.height), self.overrideText);
        }
    }

    return self;
}

//// MINIMAP UI ////

var MinimapUI = (initObject) => {
    var self = SpoolUIElement({
        tiles: {},
        active: true,
        keys: null,
        ...initObject
    });

    self.tileKey = (x, y) => {
        return `[${x},${y}]`
    }

    self.setTiles = (data) => {
        self.tiles = data;
        self.keys = Object.keys(self.tiles);
    }

    self.render = (ctx) => {



        if (self.active && self.keys) {
            ctx.drawImage(textureManager.getSprite('hotbarbg_sq', 0), self.x, self.y, self.width, self.height);

            var middleX = self.x + 0.5 * self.width;
            var middleY = self.y + 0.5 * self.height;

            var horOverhang = 2;
            var verOverhang = 2;

            var tileWidth = horOverhang * 4;
            var tileHeight = verOverhang * 4;
            var xDif = horOverhang * 3;

            var clientColor = "#00FFFF";
            var enemyColor = "#FF0000";

            self.keys.forEach(key => {
                var tile = self.tiles[key];
                var color;
                var isPlayer = false;
                var isClient = false;

                // Decide if enemy or client is on tile
                for (player in client.handler.objects['PLAYER']) {
                    var boy = client.handler.objects['PLAYER'][player];

                    if (boy && tile && client.clientObject) {
                        if (boy.tile) {
                            if (tile.tx == boy.tile.tx && tile.ty == boy.tile.ty) {
                                isPlayer = true;

                                if (tile.tx == client.clientObject.tile.tx && tile.ty == client.clientObject.tile.ty) {
                                    isClient = true;
                                }
                            }
                        }
                    }
                }

                // Choose color of tile based on its inhabitant/s
                if (isPlayer) {
                    if (isClient) {
                        ctx.fillStyle = clientColor;
                    } else {
                        ctx.fillStyle = enemyColor;
                    }
                } else {
                    ctx.fillStyle = BIOME_COLORS[tile.biome];
                }

                /*
                var pixelSize = 15;

                var x = middleX + tile.tx * pixelSize - 0.5 * pixelSize
                var y = middleY + (-tile.ty) * pixelSize - 0.5*pixelSize*tile.tx - 0.5 * pixelSize

                ctx.fillRect(x, y, pixelSize, pixelSize);
                */

                var x = middleX + tile.tx * xDif;
                var y = middleY + (-tile.ty) * tileHeight - 0.5 * tileHeight * tile.tx;

                var verRectX = x - (horOverhang);
                var verRectY = y - (verOverhang * 2);
                var horRectX = x - (horOverhang * 2);
                var horRectY = y - (verOverhang);

                // Draw the cross
                ctx.fillRect(verRectX, verRectY, horOverhang * 2, tileHeight);
                ctx.fillRect(horRectX, horRectY, tileWidth, verOverhang * 2);

            })
        }
    }

    return self;
}
var minimapUi = MinimapUI({
    x: client.gameArea.width - 220,
    y: 20,
    width: 200,
    height: 200
});
client.minimapUi = minimapUi;

//// DICE ////

var DiceUI = (initObject) => {
    var self = SpoolUIElement({
        visible: true,

        diceSize: 50,

        rolling: false,

        diceA: 1,
        diceB: 1,

        currentX: 0,
        currentY: 0,
        currentDiceSize: 50,

        ...initObject
    })

    self.renderNumberPair = (ctx, a, b) => {
        ctx.imageSmoothingEnabled = false;

        var diceMargin = self.diceSize / 5;

        ctx.drawImage(textureManager.getSprite('dice', a - 1), self.currentX - self.currentDiceSize - diceMargin / 2, self.currentY - self.currentDiceSize, self.currentDiceSize, self.currentDiceSize);
        ctx.drawImage(textureManager.getSprite('dice', b - 1), self.currentX + diceMargin / 2, self.currentY - self.currentDiceSize, self.currentDiceSize, self.currentDiceSize);

    }

    self.render = (ctx) => {
        if (self.rolling) {
            self.renderNumberPair(ctx, `${SpoolMath.randomInt(1, 6)}`, `${SpoolMath.randomInt(1, 6)}`);
        } else {
            self.renderNumberPair(ctx, `${self.diceA}`, `${self.diceB}`);
        }

        var targetX = self.x
        var targetY = self.y
        var targetSize = self.diceSize

        if (client.queueUi.currentPlayerId != undefined) {
            if (client.queueUi.currentPlayerId == client.clientId && (Date.now() - self.rollTime < 1000 || self.rolling)) {
                targetX = self.focusX;
                targetY = self.focusY;
                targetSize = self.diceSize * 2;
            }
        }
        self.currentX = SpoolMath.lerp(self.currentX, targetX, 0.2)
        self.currentY = SpoolMath.lerp(self.currentY, targetY, 0.2)
        self.currentDiceSize = SpoolMath.lerp(self.currentDiceSize, targetSize, 0.2);
    }

    return self;
}

var diceUi = DiceUI({
    x: minimapUi.x + minimapUi.width / 2,
    y: minimapUi.y + minimapUi.height + 75,
    focusX: client.gameArea.width / 2,
    focusY: client.gameArea.height / 2 + 300
})
client.diceUi = diceUi;

//// QUEUE ////

var QueueUI = (initObject) => {
    var self = SpoolUIElement({
        visible: true,

        queue: [],
        timeOnTimer: 0,
        currentRound: 0,
        roundsPerDrop: 3,

        ...initObject
    })

    var superSelf = {
        render: self.render
    }

    self.renderGem = (ctx, text, box, type) => {
        ctx.fillStyle = 'white';
        ctx.drawImage(textureManager.getSprite('queuegems', type), box.x, box.y, box.width, box.height);
        SpoolRenderer.multiLineText(ctx, text, box, box.width, FONT_OFFSETCOEF);
    }

    var timerMargin = 20;
    var timerBox = SpoolRect(self.x + timerMargin, self.y + timerMargin, 100 - timerMargin * 2, self.height - timerMargin * 2);

    var timer = VialButton({
        title: 'Timer',
        color: 'green',
        ...timerBox
    })
    timer.bindedMouseEvent = (event) => {
        client.emit('SKIP_ROUND', '');
    }

    self.add(timer);

    self.render = (ctx) => {

        if (!client.clientObject) {
            return null;
        }

        SpoolRenderer.setColor(ctx, 'black');
        SpoolRenderer.setFont(ctx, FONT, 20)

        var timerValue = 0;
        var timerMaxValue = 0;

        if (self.endTime) {
            timerValue = Math.ceil((self.endTime - Date.now()) / 1000)
            timerMaxValue = Math.ceil((self.timeOnTimer ? self.timeOnTimer : 1) / 1000)
        }


        timer.value = timerValue
        timer.maxValue = timerMaxValue;


        if (timerBox.contains(self.mx, self.my)) {
            timer.overrideText = 'skip'
        } else {
            timer.overrideText = null
        }


        x = 100;

        var queueHeight = 64;
        var queueY = self.height / 2 - queueHeight / 2


        if (self.currentRound % self.roundsPerDrop == 0) {
            SpoolRenderer.setColor(ctx, '#222222')
        } else {
            SpoolRenderer.setColor(ctx, 'white')
        }
        SpoolRenderer.setFont(ctx, FONT, 25);
        SpoolRenderer.multiLineText(ctx, self.currentRound.toString(), SpoolRect(self.x + x, queueY, 20, queueHeight), 20, FONT_OFFSETCOEF, 3)

        x += 20;

        if (self.queue.thisRound) {
            self.queue.thisRound.forEach(value => {
                self.renderGem(ctx, value.name, SpoolRect(self.x + x, queueY, queueHeight * 2, queueHeight), value.id == client.clientObject.id ? 0 : 2);
                x += queueHeight * 2 + 10;
            })
        }

        if ((self.currentRound + 1) % self.roundsPerDrop == 0) {
            SpoolRenderer.setColor(ctx, '#222222')
        } else {
            SpoolRenderer.setColor(ctx, 'white')
        }
        SpoolRenderer.multiLineText(ctx, (self.currentRound + 1).toString(), SpoolRect(self.x + x, queueY, 20, queueHeight), 20, FONT_OFFSETCOEF, 3)

        x += 20;

        if (self.queue.nextRound) {
            self.queue.nextRound.forEach(value => {
                self.renderGem(ctx, value.name, SpoolRect(self.x + x, queueY, queueHeight * 2, queueHeight), value.id == client.clientObject.id ? 0 : 2);
                x += queueHeight * 2 + 10;
            })
        }

        superSelf.render(ctx);
    }

    return self;
}

var queueUi = QueueUI({
    x: 0,
    y: 0,
    width: client.gameArea.width,
    height: 100
})

client.queueUi = queueUi;

//// ALERT UI ////

var AlertUi = (initObject) => {
    var self = SpoolUIElement({
        alerts: [],
        bigAlert: '',
        bigAlertTime: null,
        ...initObject
    });

    self.setBigAlert = (msg) => {
        self.bigAlertTime = Date.now();
        self.bigAlert = msg;
    }

    self.pushAlert = (msg) => {
        self.alerts.push(msg);
        if (self.alerts.length > 5) {
            self.alerts.splice(0, 1);
        }
        self.awake = true;
        self.endTime = Date.now() + 2000;
    }

    self.bigAlertRect = SpoolRect(0, client.gameArea.height / 2 - 200, client.gameArea.width, 150);

    self.render = (ctx) => {

        if (self.awake) {

            self.alerts.forEach((value, index) => {

                var invertedIndex = self.alerts.length - (index);

                var rect = SpoolRect(
                    self.x - self.width / 2,
                    self.y - self.height * (invertedIndex),
                    self.width,
                    self.height)
                invertedIndex++;
                SpoolRenderer.setColor(ctx, `#${invertedIndex}${invertedIndex}${invertedIndex}${invertedIndex}${invertedIndex}${invertedIndex}`)
                SpoolRenderer.fillSplRect(ctx, rect);
                SpoolRenderer.setColor(ctx, 'white')
                SpoolRenderer.setFont(ctx, FONT, 20);
                SpoolRenderer.multiLineText(ctx, value, rect, rect.width, FONT_OFFSETCOEF);
            })


            if (Date.now() > self.endTime) {
                self.awake = false;
            }
        }

        if (self.bigAlertTime != null) {
            if (Date.now() - self.bigAlertTime < 2000) {
                ctx.globalAlpha = 0.8;
                SpoolRenderer.setColor(ctx, 'black');
                SpoolRenderer.fillSplRect(ctx, self.bigAlertRect);
                ctx.globalAlpha = 1;

                SpoolRenderer.setFont(ctx, FONT, 75);
                SpoolRenderer.setColor(ctx, '#963427');
                SpoolRenderer.multiLineText(ctx, self.bigAlert, self.bigAlertRect, client.gameArea.width / 2, FONT_OFFSETCOEF, 5)
            } else {
                self.bigAlertTime = null;
            }
        }
    }

    return self;
}

var alertUi = AlertUi({
    x: client.gameArea.width / 4 * 3,
    y: client.gameArea.height,
    width: 300,
    height: 50
});
client.alertUi = alertUi;
client.uiHandler.add(alertUi);

//// HAND ////

var HandUI = (initObject) => {
    var self = SpoolUIElement({
        visible: true,

        cardsPar: [],

        cardsCol: [],

        lastCol: undefined,

        limit: 6,

        handType: 'card',
        playable: true,

        animTop: 100,
        animStart: 0,

        activatedCard: null,
        activatedIndex: null,

        yOffsetMax: 200,
        yOffsetMin: -50,
        yOffset: -100,

        cardWidth: 204 * initObject.cardFactor,
        hardHeight: 380 * initObject.cardFactor,

        hidden: false,

        delayedMx: 0,
        delayedMy: 0,

        openedWidth: 600,
        closedWidth: 300,
        handWidth: 600,

        handActive: true,

        ...initObject
    })

    self.render = (ctx) => {

        if (!client.clientObject) {
            console.warn('@HandUI no clientObject');
            return null;
        }

        if (!client.clientObject.alive) {
            return null;
        }

        self.delayedMx = SpoolMath.lerp(self.delayedMx, self.mx, 0.15);
        self.delayedMy = SpoolMath.lerp(self.delayedMy, self.my, 0.15);

        if (self.handType == 'card') {
            self.cards = client.clientObject.hand;
        } else if (self.handType == 'weapon') {
            self.cards = client.clientObject.equip.weapon ? [client.clientObject.equip.weapon.cardID] : []
        } else if (self.handType == 'equip') {
            self.cards = client.clientObject.equip.trinkets ? client.clientObject.equip.trinkets.map(value => value.cardID) : []
        } else {
            return;
        }
        if (self.cards.length == 0) {
            return;
        }

        if (!self.hidden) {
            if (self.my < client.gameArea.height / 2) {
                self.hidden = true;
            }

        } else {
            if (self.my > client.gameArea.height / 4 * 3) {
                self.hidden = false;
            }
        }

        if (SELECTOR.activatedCard || self.hidden) {
            self.handActive = false;
            self.yOffset = SpoolMath.lerp(self.yOffset, self.yOffsetMax, 0.2);
            self.handWidth = SpoolMath.lerp(self.handWidth, self.closedWidth, 0.2);
        } else {
            self.handActive = true;
            self.yOffset = SpoolMath.lerp(self.yOffset, self.yOffsetMin, 0.2);
            self.handWidth = SpoolMath.lerp(self.handWidth, self.openedWidth, 0.2);
        }

        var handbounds = {
            width: self.handWidth,
        }
        var point = {
            x: self.x,
            y: self.y + self.yOffset,
        }
        var bounds = {
            x: -self.cardWidth / 2,
            y: -self.hardHeight,
            width: self.cardWidth,
            height: self.hardHeight
        }
        var circle = {
            radius: 800,
            x: point.x,
            start: 0 - ((handbounds.width / (self.limit - 1)) * (self.cards.length - 1)) / 2
        }
        circle.y = point.y + circle.radius
        if (self.cards.length <= self.limit) {
            for (i = 0; i < self.cards.length; i++) {
                var pos = SpoolMath.getYFromMovedCircle(circle.x, circle.y, circle.start, circle.radius)
                var angle = SpoolMath.getAngleFromCircle(circle.radius, circle.start)
                self.cardsPar.push(pos[0])
                self.cardsPar.push(pos[1])
                self.cardsPar.push(angle)
                circle.start += handbounds.width / (self.limit - 1)
            }
        } else {
            circle.start = 0 - handbounds.width / 2
            for (i = 0; i < self.cards.length; i++) {
                var pos = SpoolMath.getYFromMovedCircle(circle.x, circle.y, circle.start, circle.radius)
                var angle = SpoolMath.getAngleFromCircle(circle.radius, circle.start)
                self.cardsPar.push(pos[0])
                self.cardsPar.push(pos[1])
                self.cardsPar.push(angle)
                circle.start += handbounds.width / (self.cards.length - 1)
            }
        }
        for (i = 0; i < self.cards.length; i++) {

            var rotatedP = SpoolMath.rotatePoint(self.cardsPar[i * 3], self.cardsPar[1 + i * 3], self.mx, self.my, self.cardsPar[2 + i * 3])
            if (SpoolMath.rectangleMouseCollision(self.cardsPar[i * 3] - bounds.width / 2, self.cardsPar[1 + i * 3], bounds.width, bounds.height, rotatedP[0], rotatedP[1])) {
                self.cardsCol.push(true)
            } else {
                self.cardsCol.push(false)
            }
        }

        for (i = 0; i < self.cards.length; i++) {
            if (self.cardsCol[self.cards.length - i - 1] == true) {
                var colOn = self.cards.length - i - 1
                break
            }
        }
        if (colOn != self.lastCol) {
            self.animStart = 0
        }
        if (colOn != undefined) {
            self.animStart = SpoolMath.lerp(self.animStart, 1, 0.2)
        } else {
            self.animStart = 0
        }

        ctx.imageSmoothingEnabled = true;

        for (i = 0; i < self.cards.length; i++) {


            var cardid = self.cards[i];
            var card = client.clientObject.cardInfo[cardid];

            if (!card) {
                console.log('@handUI problem with card: ' + cardid);
            }

            var sprite = textureManager.getSprite('cards', card.cardTileIndex);




            if (i == self.activatedIndex) {
                var angle = (self.mx - self.delayedMx) / 100;
                angle = angle > Math.PI / 2 ? (Math.PI / 2) : (angle < -Math.PI / 2 ? -Math.PI / 2 : angle);

                SpoolRenderer.renderRotatedSprite(ctx, sprite, angle, self.mx, self.my - 10, {
                    x: bounds.x / 2,
                    y: bounds.y / 2,
                    width: bounds.width / 2,
                    height: bounds.height / 2
                });
            } else {
                if (colOn != undefined && i == colOn && self.handActive) {
                    var lerpX = Math.sin(self.cardsPar[2 + i * 3]) * bounds.height / 1.2
                    var lerpY = Math.cos(self.cardsPar[2 + i * 3]) * bounds.height / 1.2
                    SpoolRenderer.renderRotatedSprite(ctx, sprite, self.cardsPar[2 + i * 3], self.cardsPar[0 + i * 3] - self.animStart * lerpX, self.cardsPar[1 + i * 3] - self.animStart * lerpY, bounds)
                } else {
                    SpoolRenderer.renderRotatedSprite(ctx, sprite, self.cardsPar[2 + i * 3], self.cardsPar[0 + i * 3], self.cardsPar[1 + i * 3], bounds)
                }
            }
        }
        self.lastCol = colOn
        self.cardsPar = []
        self.cardsCol = []


    }

    self.mouseEvent = (event) => {
        if (!self.cards) {
            return false;
        }
        if (self.cards.length == 0) {
            return false;
        }

        if (!client.clientObject) {
            return false;
        }

        if (!client.clientObject.alive) {
            return false;
        }


        if (self.playable) {
            if (event.type == 'mousedown') {
                if (event.button == 0) {
                    if (!self.activatedCard) {
                        if (self.lastCol != undefined) {
                            var cardid = self.cards[self.lastCol];
                            var card = client.clientObject.cardInfo[cardid]
                            self.activatedCard = card;
                            self.activatedIndex = self.lastCol;
                            SELECTOR.activatedCard = card;
                            console.log(self.handType, self.lastCol);
                            return true;
                        }
                    } else {
                        var res = getTileInPoint(event.x, event.y);
                        client.emit('CARD_ACTION', {
                            type: self.handType,
                            tx: res.tx,
                            ty: res.ty,
                            cardid: self.activatedCard.cardID
                        })
                        self.activatedCard = null;
                        self.activatedIndex = null;
                        SELECTOR.activatedCard = null;
                        console.log(self.handType);
                        return true;
                    }
                } else if (event.button == 2) {
                    self.activatedCard = null;
                    self.activatedIndex = null;
                    SELECTOR.activatedCard = null;
                    console.log(self.handType);
                    return true;
                }
            }
        }
    }

    self.mouseMove = (event) => {
        self.mx = event.clientX;
        self.my = event.clientY;
        var selection = false;

        if (self.activatedCard) {
            var res = null;
            Object.keys(colBoxes).forEach(key => {
                var box = colBoxes[key];
                if (SpoolMath.distance(event.x, event.y, box.x, box.y) <= box.radius) {
                    res = box.tile;
                }
            })

            if (res) {
                self.selectedTx = res.tx;
                self.selectedTy = res.ty;
                SELECTOR.selectedTx = self.selectedTx;
                SELECTOR.selectedTy = self.selectedTy;
                SELECTOR.validPosition = tileDistance(self.selectedTx, self.selectedTy, client.clientObject.tile.tx, client.clientObject.tile.ty) <= getStat(client.clientObject, 'range', self.activatedCard.range);
                selection = true;
            }
        }

        if (self.selectedTx && !selection) {
            self.selectedTx = null;
            self.selectedTy = null;
            SELECTOR.selectedTx = self.selectedTx;
            SELECTOR.selectedTy = self.selectedTy;
            SELECTOR.validPosition = false;
        }
    }

    return self
}

CARD_FACTOR = 0.7;

var handUi = HandUI({
    x: client.gameArea.width / 2,
    y: client.gameArea.height,
    openedWidth: 500,
    closedWidth: 300,
    cardFactor: CARD_FACTOR,
})
client.handUi = handUi

var weaponHandUi = HandUI({
    x: client.gameArea.width - 300,
    y: client.gameArea.height,
    handType: 'weapon',
    cardFactor: CARD_FACTOR,
})
client.weaponHandUi = weaponHandUi

var equipHandUi = HandUI({
    x: client.gameArea.width - 100,
    y: client.gameArea.height,
    handType: 'equip',
    playable: false,
    cardFactor: CARD_FACTOR,
})
client.equipHandUi = equipHandUi

//// DAMAGE FLOATERS ////

var DamageFloatersUI = (initObject) => {
    var self = SpoolUIElement(initObject);

    self.damageFloaters = [];

    self.render = (ctx) => {
        SpoolRenderer.setColor(ctx, 'white');

        var cuttingIndex = -1;

        self.damageFloaters.forEach((floater, index) => {
            if (!floater.frameCounter) {
                floater.frameCounter = 0;
            }
            var point = client.camera.transformPoint(floater.x, floater.y);
            point.y -= Z_SCALINGFACTOR * floater.z + floater.frameCounter * 5;

            ctx.globalAlpha = 1 - floater.frameCounter / 30;

            SpoolRenderer.setFont(ctx, FONT, 25);
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 4;
            ctx.strokeText(floater.dmg, point.x, point.y);

            if (floater.type == 'hp') {
                if (floater.dmg < 0) {
                    ctx.fillStyle = 'red';
                } else {
                    ctx.fillStyle = 'green';
                }
            } else if (floater.type == 'energy') {
                if (floater.dmg < 0) {
                    ctx.fillStyle = 'blue';
                }
            } else {
                ctx.fillStyle = 'white';
            }

            ctx.fillText(floater.dmg, point.x, point.y);
            ctx.globalAlpha = 1;

            floater.frameCounter += 1;

            if (floater.frameCounter > 30) {
                if (index > cuttingIndex) {
                    cuttingIndex = index;
                }
            }
        })

        if (cuttingIndex > -1) {
            self.damageFloaters.splice(0, cuttingIndex + 1);
        }
    }

    self.add = (data) => {
        self.damageFloaters = self.damageFloaters.concat(data);
    }

    return self;
}

var damageFloatersUI = DamageFloatersUI();

client.damageFloatersUI = damageFloatersUI;

//// PLAYER INFORMATION ////

var vialInformation = VialInformation();
client.vialInformation = vialInformation;

var PlayerInformationUI = (initObject) => {
    var self = SpoolUIElement({
        ...initObject,
    });

    var superSelf = {
        render: self.render
    }

    var vialSize = 70;
    var margin = 20;
    var vialX = 39 / 106 * self.width - vialSize / 2 + self.x;


    var nameBox = SpoolRect(self.x, self.y + 186 / 228 * self.height, self.width, 42 / 228 * self.height);

    var textX = 53 / 106 * self.width + self.x;
    var textY = 207 / 228 * self.height + self.y;

    var buffsWidth = 34 / 106 * self.width / 4 * 3

    var buffsX = 84 / 106 * self.width + self.x;
    var buffsY = 184 / 228 * self.height + self.y;

    var hpVial = VialButton({
        title: 'Health',
        color: 'red',
        pulsing: true,
        ...SpoolRect(vialX, self.y + margin, vialSize, vialSize)
    })
    self.add(hpVial);
    var energyVial = VialButton({
        title: 'Energy',
        color: 'yellow',
        ...SpoolRect(vialX, self.y + vialSize + margin * 2, vialSize, vialSize)
    })
    self.add(energyVial);
    var ammoVial = VialButton({
        title: 'Ammo',
        color: 'gray',
        ...SpoolRect(vialX, self.y + vialSize * 2 + margin * 3, vialSize, vialSize)
    })
    self.add(ammoVial);

    self.render = (ctx) => {
        if (client.clientObject) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(textureManager.getSprite('hotbarbg', 0), self.x, self.y, self.width, self.height);

            SpoolRenderer.setFont(ctx, "'dpcomic'", 30);
            SpoolRenderer.setColor(ctx, 'white');
            SpoolRenderer.multiLineText(
                ctx,
                `${client.clientObject.name ? client.clientObject.name : 'Spectator'}`,
                nameBox,
                self.width,
                FONT_OFFSETCOEF);

            ctx.lineWidth = 2;

            // Vials

            hpVial.value = client.clientObject.hp
            hpVial.maxValue = client.clientObject.maxHp

            energyVial.value = client.clientObject.energy
            energyVial.maxValue = client.clientObject.maxEnergy

            ammoVial.value = client.clientObject.ammo
            ammoVial.maxValue = client.clientObject.maxAmmo

            superSelf.render(ctx);

            if (nameBox.contains(self.mx, self.my)) {
                var infoBoxSize = 150;
                var infoBox = SpoolRect(nameBox.cx - infoBoxSize / 2, nameBox.y - infoBoxSize, infoBoxSize, infoBoxSize);
                ctx.drawImage(textureManager.getSprite('hotbarbg_sq', 0), infoBox.x, infoBox.y, infoBox.width, infoBox.height);

                var text = ''

                Object.keys(client.clientObject.stats).forEach((key, index) => {
                    text += `${key}: ${client.clientObject.stats[key] > 0 ? '+' : '-'}${client.clientObject.stats[key]}`
                    if (index < client.clientObject.stats.length - 1) {
                        text += '\n'
                    }
                });

                SpoolRenderer.setFont(ctx, FONT, 20);
                SpoolRenderer.multiLineText(ctx, text, infoBox, infoBox.width, FONT_OFFSETCOEF, 3);
            }

            client.clientObject.buffs.forEach((buff, index) => {

                var buffJson = BUFFS[buff.name];
                var buffRect = SpoolRect(buffsX - buffsWidth / 2, buffsY - (buffsWidth + 10) * (index + 1), buffsWidth, buffsWidth);


                ctx.drawImage(textureManager.getSprite('buffs', buffJson.textureId), buffRect.x, buffRect.y, buffRect.width, buffRect.height);
                SpoolRenderer.simpleText(ctx, buff.duration, buffRect.x + buffRect.width, buffRect.y + buffRect.height, 5)

                if (buffRect.contains(self.mx, self.my)) {
                    SpoolRenderer.multiLineText(ctx, buffJson.tooltip, SpoolRect(self.mx + 100, self.my, 0, 0), 200, FONT_OFFSETCOEF, 10);
                }

            })
        }
    }

    return self;
}

var playerInformation = PlayerInformationUI({
    x: 10,
    y: client.gameArea.height - 466,
    width: 212,
    height: 456
})

////// CAMERA //////

client.camera.lerp = true;
client.camera.followSpeed = 0.2;
client.camera.onUpdate = (self) => {
    if (client.clientObject) {
        self.followObject = client.clientObject;
    }
}

client.handler.textureManager = textureManager;
textureManager.onLoad = () => {
    client.socketInit()

    // LISTENERS //

    var keyListener = KeyboardListener(client.socket);
    keyListener.initListener();
    keyListener.onKeyDown = (event) => {
        if (event.keyCode == 70) {
            Z_SCALINGENABLED = !Z_SCALINGENABLED;
        }
    }

    var mouseListener = MouseListener(client);
    mouseListener.initListener();



    client.onMouseEvent = (event) => {
        if (client.clientObject) {

            if (client.clientObject.alive) {

                if (event.type == 'mousedown') {
                    var res = null;

                    Object.keys(colBoxes).forEach(key => {
                        var box = colBoxes[key];
                        if (SpoolMath.distance(event.x, event.y, box.x, box.y) <= box.radius) {
                            res = box.tile;
                        }
                    })

                    if (res) {
                        if (event.button == 0) {
                            client.emit("MOVE_TO", {
                                tx: res.tx,
                                ty: res.ty
                            });
                        }
                    }
                }
            } else {
                client.alertUi.pushAlert('You are dead');
            }
        }

    }

    //// UI LISTENERS ////

    client.socket.on('DAMAGE_FLOATERS', data => {
        client.damageFloatersUI.add(data);
    })

    client.socket.on('DICE', (data) => {
        if (data.rolling) {
            client.diceUi.rolling = true;
        } else {
            client.diceUi.rolling = false;
            client.diceUi.diceA = data.diceA;
            client.diceUi.diceB = data.diceB;
            client.diceUi.rollTime = Date.now();
        }
    })

    client.socket.on('SET_QUEUE', (data) => {
        client.queueUi.currentRound = data.currentRound;
        client.queueUi.roundsPerDrop = data.roundsPerDrop;
        client.queueUi.queue = data.queue;
        client.queueUi.currentPlayerId = data.currentPlayerId;
    })

    client.socket.on('SET_TIMER', (data) => {
        client.queueUi.endTime = data.endTime;
        client.queueUi.timeOnTimer = data.duration
    })

    client.socket.on('ALERT', (data) => {
        if (data.bigAlert) {
            client.alertUi.setBigAlert(data.msg);
        } else {
            client.alertUi.pushAlert(data.msg);
        }
    });

    client.socket.on('SET_MINIMAP_TILES', (data) => {
        client.minimapUi.setTiles(data);
    })

    client.uiHandler.add(diceUi);
    client.uiHandler.add(queueUi);
    client.uiHandler.add(damageFloatersUI);
    client.uiHandler.add(handUi);
    client.uiHandler.add(weaponHandUi);
    client.uiHandler.add(equipHandUi);
    client.uiHandler.add(playerInformation);
    client.uiHandler.add(vialInformation);
    client.uiHandler.add(minimapUi);

    client.background = (ctx, camera) => {
        ctx.fillStyle = '#87cefa';
        ctx.fillRect(0, 0, client.gameArea.width, client.gameArea.height);
    }

    client.startGameLoop()
}

var g_cursorId = 0;

client.onMouseMove = (event) => {
    client.mx = event.clientX;
    client.my = event.clientY;

    if (!SELECTOR.activatedCard) {
        var tile = getTileInPoint(client.mx, client.my, movingColBoxes);
        if (tile && g_cursorId != 1) {
            client.gameArea.canvas.style.cursor = 'url("./textures/cursor_moving.png") 0 0, auto';
            g_cursorId = 1;
        } else if (!tile && g_cursorId != 0) {
            client.gameArea.canvas.style.cursor = 'url("./textures/cursor.png") 0 0, auto';
            g_cursorId = 0;
        }
    } else if (g_cursorId != 2) {
        client.gameArea.canvas.style.cursor = 'url("./textures/cursor_attack.png") 0 0, auto';
        g_cursorId = 2;

    }
}

var F_PRESSED = false;

client.postUi = (ctx, camera) => {

    var pictX = minimapUi.x - 100
    var pictY = minimapUi.y;
    ctx.drawImage(textureManager.getSprite('pictograms', Z_SCALINGENABLED ? 0 : 1), pictX, pictY, 48, 48);
    if (!F_PRESSED) {
        SpoolRenderer.setFont(ctx, FONT, 20);
        SpoolRenderer.setColor(ctx, 'black');
        ctx.textAlign = 'center';
        SpoolRenderer.simpleText(ctx, 'press F', pictX + 24, pictY + 64, 0);

        if (!Z_SCALINGENABLED) {
            F_PRESSED = true;
        }
    }

}

client.gameArea.canvas.style.cursor = 'url("./textures/cursor.png") 0 0, auto';

textureManager.load()