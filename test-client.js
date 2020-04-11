////// FUNCTIONS //////

function tileDistance(ax, ay, bx, by) {
    return (Math.abs(bx - ax) + Math.abs(by - ay) + Math.abs(bx + by - ax - ay)) / 2
}

function tileDistance2T(a, b) {
    return tileDistance(a.tx, a.ty, b.tx, b.ty);
}

////// CLIENT //////

var Z_SCALINGFACTOR_MAX = 10;
var Z_SCALINGFACTOR_MIN = 3;
var Z_SCALINGFACTOR = Z_SCALINGFACTOR_MAX;
var Z_SCALINGENABLED = true;

var colBoxes = {};

var client = null;

BIOME_COLORS = {
    'grass': '#a0d964',
    'stone': '#757575'
}

var Tile = (initObject) => {
    var self = Entity({
        ...initObject
    });

    var superSelf = {
        render: self.render
    }

    self.baseColor = '#b58d65'
    self.baseDark = ['#a37a52', '#a8835e', '#c2a07e']



    self.topColor = BIOME_COLORS[self.biome]


    self.color = SpoolMath.randomColor(100, 255);
    self.darkColor = SpoolMath.divideColor(self.color, 2);

    self.render = (ctx, camera) => {
        var r = self.hexRadius;
        var startAngle = 0;
        var n = 6;

        var points = []
        var pointsDown = []
        var pointsInner = []

        var innerRadiusFactor = 0.8;

        for (var i = 0; i < n; i++) {
            angle = startAngle + Math.PI * 2 / n * i;
            var point = camera.transformPoint(self.x - r * Math.cos(angle), self.y - r * Math.sin(angle));
            var pointInner = camera.transformPoint(self.x - r * innerRadiusFactor * Math.cos(angle), self.y - r * innerRadiusFactor * Math.sin(angle))
            pointInner.y -= self.z * Z_SCALINGFACTOR
            pointsDown.push(point);
            pointsInner.push(pointInner);
            points.push({
                x: point.x,
                y: point.y - self.z * Z_SCALINGFACTOR
            })
        }

        // Drawing the base going down the screen

        ctx.fillStyle = self.baseDark[0];
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y)
        ctx.lineTo(points[5].x, points[5].y)
        ctx.lineTo(points[5].x, client.gameArea.height)
        ctx.lineTo(points[0].x, client.gameArea.height) //, pointsDown[0].y)
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = self.baseDark[1];
        ctx.beginPath();
        ctx.moveTo(points[5].x, points[5].y)
        ctx.lineTo(points[4].x, points[4].y)
        ctx.lineTo(points[4].x, client.gameArea.height) //pointsDown[3].y)
        ctx.lineTo(points[5].x, client.gameArea.height)
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = self.baseDark[2];
        ctx.beginPath();
        ctx.moveTo(points[4].x, points[4].y)
        ctx.lineTo(points[3].x, points[3].y)
        ctx.lineTo(points[3].x, client.gameArea.height) //pointsDown[3].y)
        ctx.lineTo(points[4].x, client.gameArea.height)
        ctx.closePath();
        ctx.fill();

        // Calculating the upper point 

        colPoint = camera.transformPoint(self.x, self.y);
        colBox = {
            x: colPoint.x,
            y: colPoint.y - self.z * Z_SCALINGFACTOR,
            radius: camera.transformDimension(self.hexRadius) * Math.sin(Math.PI / 3),
            tile: self
        }
        colBoxes[self.id] = colBox;

        // Drawing the upper face of the hexagon

        ctx.fillStyle = self.baseColor;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y)
        for (var i = 1; i < n; i++) {
            ctx.lineTo(points[i].x, points[i].y)
        }
        ctx.closePath();
        ctx.fill();

        // Drawing the inner part of the hexagon

        ctx.fillStyle = self.topColor;
        ctx.beginPath();
        ctx.moveTo(pointsInner[0].x, pointsInner[0].y)
        for (var i = 1; i < n; i++) {
            ctx.lineTo(pointsInner[i].x, pointsInner[i].y)
        }
        ctx.closePath();
        ctx.fill();

        self.objects.forEach(object => {
            var temp = client.handler.objectsById[object];
            if (temp) {
                temp.renderOnTile(ctx, camera, colBox.x, colBox.y);
            }
        })

        if (client.clientObject) {
            if (tileDistance2T(client.clientObject, self) == 1) {
                var clientZ = client.clientObject.z;
                SpoolRenderer.setFont(ctx, 'Arial', 25);
                SpoolRenderer.setColor(ctx, 'white');
                SpoolRenderer.multiLineText(ctx, `${Math.abs(clientZ - self.z)}`, SpoolRect(colBox.x, colBox.y, 0, 0))
                //SpoolRenderer.multiLineText(ctx, `${self.tx}, ${self.ty}`, SpoolRect(colBox.x, colBox.y, 0, 0));
            }
        }
    }

    return self;
}

var Player = (initObject) => {
    var self = RectangleEntity({
        ...initObject
    })

    self.render = () => {};

    self.renderOnTile = (ctx, camera, tilex, tiley) => {
        SpoolRenderer.setColor(ctx, 'red');
        SpoolRenderer.fillRect(ctx, tilex - self.width / 2, tiley - self.height, self.width, self.height);
    }

    return self;
}

var OBJECTS = {
    'TILE': {
        const: Tile
    },
    'PLAYER': {
        const: Player
    }
}

client = Client({
    keyToConstructor: OBJECTS
});

client.preHandler = () => {
    if (Z_SCALINGENABLED) {
        Z_SCALINGFACTOR = SpoolMath.lerp(Z_SCALINGFACTOR, Z_SCALINGFACTOR_MAX, 0.5)
    } else {
        Z_SCALINGFACTOR = SpoolMath.lerp(Z_SCALINGFACTOR, Z_SCALINGFACTOR_MIN, 0.5)
    }
}



client.camera.scaleY = 0.8

client.socketInit()

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

    console.log(event);


    if (event.type == 'mousedown') {
        var res = null;

        Object.keys(colBoxes).forEach(key => {
            var box = colBoxes[key];
            if (SpoolMath.distance(event.x, event.y, box.x, box.y) <= box.radius) {
                res = box.tile;
            }
        })
        if (res) {
            client.emit("MOVE_TO", {
                tx: res.tx,
                ty: res.ty
            });
        }
    }


}

client.startGameLoop()

////// UI //////

//// DICE ////

var DiceUI = (initObject) => {
    var self = SpoolUIElement({
        visible: true,

        diceSize: 50,
        diceMargin: 10,

        rolling: false,

        diceA: 1,
        diceB: 1,

        ...initObject
    })

    self.renderNumberPair = (ctx, a, b) => {
        SpoolRenderer.setColor(ctx, 'red');
        SpoolRenderer.fillRect(ctx, self.x - self.diceSize - self.diceMargin / 2, self.y - self.diceSize, self.diceSize, self.diceSize)
        SpoolRenderer.fillRect(ctx, self.x + self.diceMargin / 2, self.y - self.diceSize, self.diceSize, self.diceSize);

        SpoolRenderer.setColor(ctx, 'white');
        SpoolRenderer.setFont(ctx, 'Arial', 30);
        SpoolRenderer.multiLineText(ctx, a, SpoolRect(self.x - self.diceSize - self.diceMargin / 2, self.y - self.diceSize, self.diceSize, self.diceSize))
        SpoolRenderer.multiLineText(ctx, b, SpoolRect(self.x + self.diceMargin / 2, self.y - self.diceSize, self.diceSize, self.diceSize))
    }

    self.render = (ctx) => {
        if (self.rolling) {
            self.renderNumberPair(ctx, `${SpoolMath.randomInt(1, 6)}`, `${SpoolMath.randomInt(1, 6)}`);
        } else {
            self.renderNumberPair(ctx, `${self.diceA}`, `${self.diceB}`);
        }
    }

    return self;
}

var diceUi = DiceUI({
    x: client.gameArea.width - 200,
    y: 200
})
client.diceUi = diceUi;

client.socket.on('DICE', (data) => {
    console.log(data);
    if (data.rolling) {
        client.diceUi.rolling = true;
    } else {
        client.diceUi.rolling = false;
        client.diceUi.diceA = data.diceA;
        client.diceUi.diceB = data.diceB;
    }
})

client.uiHandler.add(diceUi);

//// QUEUE ////

var QueueUI = (initObject) => {
    var self = SpoolUIElement({
        visible: true,

        queue: [],

        ...initObject
    })

    self.render = (ctx) => {
        SpoolRenderer.setColor(ctx, 'black');
        SpoolRenderer.setFont(ctx, 'Arial', 20)

        var timerMargin = 20;

        SpoolRenderer.drawInscribedOval(ctx, SpoolRect(self.x + timerMargin, self.y + timerMargin, 100 - timerMargin * 2, self.height - timerMargin * 2))

        if (self.endTime) {
            delta = self.endTime - Date.now()

            if (delta > 0) {
                SpoolRenderer.multiLineText(
                    ctx,
                    `${Math.ceil(delta/1000)}`,
                    SpoolRect(self.x, self.y, 100, self.height))
            }
        }
        for (var i = 0; i < self.queue.length; i++) {
            SpoolRenderer.setFont(ctx, 'Arial', 20);

            var offset = i == 0 ? 100 : 400;

            SpoolRenderer.multiLineText(
                ctx,
                self.queue[i],
                SpoolRect(self.x + offset, self.y, 100, self.height))
        }
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

client.uiHandler.add(queueUi);

client.socket.on('SET_QUEUE', (data) => {
    client.queueUi.queue = data;
})

client.socket.on('SET_TIMER', (data) => {
    client.queueUi.endTime = data.endTime;
})

//// ALERT UI ////

var AlertUi = (initObject) => {
    var self = SpoolUIElement({
        alerts: [],
        ...initObject
    });

    self.pushAlert = (msg) => {
        self.alerts.push(msg);
        if (self.alerts.length > 5) {
            self.alerts.splice(0, 1);
        }
        self.awake = true;
        self.endTime = Date.now() + 2000;
    }

    self.render = (ctx) => {

        if (self.awake) {

            self.alerts.forEach((value, index) => {

                var invertedIndex = self.alerts.length - (index + 1);

                var rect = SpoolRect(
                    self.x - self.width / 2,
                    self.y - self.height * (invertedIndex),
                    self.width,
                    self.height)
                invertedIndex++;
                SpoolRenderer.setColor(ctx, `#${invertedIndex}${invertedIndex}${invertedIndex}${invertedIndex}${invertedIndex}${invertedIndex}`)
                SpoolRenderer.fillSplRect(ctx, rect);
                SpoolRenderer.setColor(ctx, 'white')
                SpoolRenderer.setFont(ctx, 'Arial', 15);
                SpoolRenderer.multiLineText(ctx, value, rect, rect.width);
            })
            if (Date.now() > self.endTime) {
                self.awake = false;
            }
        }
    }

    return self;
}

var alertUi = AlertUi({
    x: client.gameArea.width / 4 * 3,
    y: client.gameArea.height,
    width: 200,
    height: 50
});
client.alertUi = alertUi;

client.socket.on('ALERT', (data) => {
    client.alertUi.pushAlert(data.msg);
});

client.uiHandler.add(alertUi);



//// PLAYER INFORMATION ////

var PlayerInformationUI = (initObject) => {
    var self = SpoolUIElement({
        ...initObject
    });

    self.render = (ctx) => {
        if (client.clientObject) {
            SpoolRenderer.setColor(ctx, 'red');
            SpoolRenderer.fillSplRect(ctx, self);

            SpoolRenderer.setColor(ctx, 'black');
            SpoolRenderer.multiLineText(
                ctx,
                `${client.clientObject.energy}`,
                SpoolRect(self.x + 100, self.y, 100, 100));
            SpoolRenderer.multiLineText(
                ctx,
                `${client.clientObject.name}`,
                SpoolRect(self.x, self.y, 100, 100));

        }
    }

    return self;
}

var playerInformation = PlayerInformationUI({
    x: 0,
    y: client.gameArea.height - 100,
    width: 400,
    height: 100
})

client.uiHandler.add(playerInformation);

////// CAMERA //////

client.camera.lerp = true;
client.camera.onUpdate = (self) => {
    if (client.clientObject) {
        self.followObject = client.clientObject;
    }
}