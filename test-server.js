var {
    Server,
    Entity,
    SpoolMath,
    CollisionManager,
    ObjectSpawner,
    RectangleBodyParameters,
    ServerObject,
    Line
} = require('./spoolserver.js');

var ITEMS_JSON = require('./items.json');

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
    TPS: 55,
    updateCallback: (self) => {

    },
    onSocketCreated: (self, socket, player) => {
        socket.on('PLAYER_CONVERSATION', data => {
            player.moveInConversation(data.option);
        })

        socket.on('MOVE_ITEM', data => {
            var from = self.objectServer.getObject({
                objectType: "INVENTORY",
                id: data.from
            });
            var to = self.objectServer.getObject({
                objectType: 'INVENTORY',
                id: data.to
            });
            var value = data.value;

            if (from && to && value) {
                temp = to.object.add(value);
                from.object.remove(value);
                from.object.add(temp);
            }
        })
    }
}, ['/', '/textures'])

server.handler.staticKeys = [
    'WALL'
]

var GRID_SIZE = 96;

var LIVING_OBJECTS = ['PLAYER', 'ANIMAL', 'NPC']
var INTERACTABLE = ['NPC', 'NPC_KID', 'TREE', 'POST'];
var HARD_OBJECTS = ['WALL', 'STONE_WALL', 'POST', 'TREE', 'FENCE']

////// SCTRUCTURES /////

var ItemProt = (initPack = {}) => {
    var self = {
        value: 'none',
        amount: 0,
        maxAmount: 16,
        tags: [],
        itemProt: true,
        ...initPack
    }

    self.toStr = () => {
        return self.value + ":" + self.amount + '/' + self.maxAmount;
    }

    return self;
}

var Item = (type, amount) => {
    var self = null;

    if (type in ITEMS_JSON) {
        self = ItemProt({
            value: type,
            ...ITEMS_JSON[type],
            amount: amount
        })
    }
    return self;
}

var Slot = (initPack = {}) => {
    var self = {
        whitelist: [],
        blacklist: [],
        value: null,
        ...initPack
    }

    self.canTake = value => {

        var onWhiteList = false;

        if (!value) {
            return 0;
        }
        if (!value.tags) {
            return 0;
        }

        for (var i = 0; i < self.whitelist.length; i++) {
            for (var j = 0; j < value.tags.length; j++) {
                if (value.tags[j] == self.whitelist[i]) {
                    onWhiteList = true;
                    break;
                }
            }
        }

        if (onWhiteList) {
            if (!self.value) {
                return value.amount;
            } else {
                if (self.value.value == value.value) {
                    return self.value.maxAmount - self.value.amount;
                } else {
                    return 0;
                }
            }
        } else {
            return 0;
        }
    }

    self.add = v => {
        if (v) {
            var freeAmount = self.canTake(v)
            if (freeAmount > 0) {
                var removedAmount = Math.min(freeAmount, v.amount);
                v.amount -= removedAmount;
                if (self.value) {
                    self.value.amount += removedAmount;
                } else {
                    self.value = ItemProt({
                        ...v,
                        amount: removedAmount
                    })
                }
                if (v.amount == 0) {
                    return null;
                }
            }
        }

        return v;
    }

    self.remove = v => {
        if (v && self.value) {
            if (v.value == self.value.value) {
                var removedAmount = Math.min(v.amount, self.value.amount);

                self.value.amount -= removedAmount;
                if (self.value.amount <= 0) {
                    self.value = null;
                }

                return {
                    ...v,
                    amount: removedAmount
                };
            } else {
                return null;
            }
        }
        return null;
    }

    self.toStr = () => {
        return 'SLOT: ' + (self.value ? self.value.toStr() : 'empty');
    }

    return self;
}

var Inventory = (initPack = {}, whitelists = []) => {
    var self = ServerObject({
        size: 16,
        uiType: 'grid',
        type: 'all',
        objectType: 'INVENTORY',
        whitelists: whitelists,
        ...initPack
    }, server)

    self.slots = [];

    if (whitelists) {
        self.type = 'custom-whitelist'
    }

    for (var i = 0; i < self.size; i++) {
        self.slots.push(Slot({
            whitelist: whitelists[i] ? whitelists[i] : ['item']
        }))
    }

    self.update = data => {
        Object.assign(self, data);
        if (self.onUpdate) {
            self.onUpdate();
        }
        if (self.updateCallback) {
            self.updateCallback(self.subscribers, self.returnObject());
        }
    }

    self.add = (value, update = true) => {
        var temp = {
            ...value
        };
        for (var i = 0; i < self.size; i++) {

            temp = self.slots[i].add(temp);
        }

        if (update) {
            self.update();
        }
        return temp;
    }

    self.addBulk = array => {
        var res = []
        for (var i = 0; i < array.length; i++) {

            var temp = array[i];

            if (!temp.itemProt) {
                temp = Item(temp.value, temp.amount);
            }

            res.push(self.add(temp), false);
        }

        self.update();
        return res;
    }

    self.remove = (value, update = true) => {
        var temp = {
            value: value.value,
            amount: value.amount
        }

        for (var i = self.size - 1; i >= 0; i--) {
            var res = self.slots[i].remove(temp);
            if (res) {
                temp.amount -= res.amount;
            }
            if (temp.amount == 0) {
                break;
            }
        }
        if (update) {
            self.update();
        }
        return {
            amount: value.amount - temp.amount,
            ...value
        }
    }

    self.removeBulk = array => {
        var res = []
        for (var i = 0; i < array.length; i++) {
            var temp = array[i];

            if (!temp.itemProt) {
                temp = Item(temp.value, temp.amount);
            }
            res.push(self.remove(temp), false);
        }

        self.update();
        return res;
    }

    /**
     * Checks if inventory contains all the necesarry items
     * @param {array} items = array of item definitions [{value, amount}]
     */
    self.containsBulk = items => {
        var res = true;
        for (var i = 0; i < items.length; i++) {
            res &= self.contains(items[i]);
        }
        return res;
    }

    /**
     * Checks if inventory contains the necessary item
     * @param {object} items = item definition {value, amount}
     */
    self.contains = item => {
        return self.count(item.value) >= item.amount;
    }

    /**
     * Counts all the items in the inventory
     */
    self.count = type => {
        var res = 0;
        for (var i = 0; i < self.slots.length; i++) {
            var item = self.slots[i].value;

            if (item) {
                if (item.value == type) {
                    res += item.amount;
                }
            }
        }

        return res;
    }

    self.toStr = () => {
        var res = 'INVENTORY\n';

        for (var i = 0; i < self.slots.length; i++) {
            res += self.slots[i].toStr() + '\n'
        }

        return res;
    }

    /**
     * Returns object in format suited for server-client sending 
     */
    self.returnObject = () => {
        return {
            id: self.id,
            objectType: self.objectType,
            slots: self.slots,
            size: self.size,
            uiType: self.uiType
        }
    }

    return self;
}

////// OBJECTS //////

var RPGEntity = (initPack = {}) => {
    var self = Entity(initPack);
    return self;
}

var RPGLivingEntity = (initPack = {}) => {
    var self = RPGEntity({

        maxHp: 12,
        hp: 12,
        maxMp: 4,
        mp: 4,

        hpRegen: 0.1,
        mpRegen: 0.1,

        name: 'Unknown',

        inventory: Inventory({
            type: 'items-all',
            size: 16
        }),

        equip: Inventory({
            size: 5,
            uiType: 'entity-equipment'
        }, [
            ['helmet'],
            ['chestplate'],
            ['footwear'],
            ['mainhand', 'weapon'],
            ['offhand', 'weapon']
        ]),

        ...initPack
    });

    self.inventory.owner = self;
    self.equip.owner = self;

    var superSelf = {
        update: self.update,
        updatePack: self.updatePack,
        initPack: self.initPack
    }

    //// INVENTORIES ////

    server.objectServer.add(self.inventory);
    server.objectServer.add(self.equip);

    //// HEALTH ////

    self.regeneration = () => {
        self.hp += self.hpRegen;
        if (self.hp >= self.maxHp) {
            self.hp = self.maxHp;
        }

        self.mp += self.mpRegen;
        if (self.mp >= self.maxMp) {
            self.mp = self.maxMp;
        }
    }

    self.damage = (damage) => {
        console.log(damage.owner.id)
        if (damage.owner.id !== self.id) {
            self.hp -= damage.dmg;
            if (self.hp < 0) {
                self.die()
            }

            self.setVel('knockback', 10, damage.direction)
        }
    }

    self.die = () => {
        server.handler.removeObj(self);
        var pile = Pile({
            x: self.x,
            y: self.y
        }, [Item('ash', 5)])

        server.handler.add(pile);
    }

    //// PACKAGES ////

    self.initPack = () => {
        return {
            ...superSelf.initPack(),
            inventoryId: self.inventory.id,
            equipId: self.equip.id,
            name: self.name,
            maxHp: self.maxHp,
            maxMp: self.maxMp
        }
    }

    self.updatePack = () => {
        return res = {
            ...superSelf.updatePack(),
            hp: self.hp,
            mp: self.mp,
            roofZone: self.roofZone,

            ...self.asyncUpdatePackage
        };
    };

    //// UPDATE METHOD ////

    self.update = () => {
        self.regeneration();
        if ('knockback' in self.velocities) {
            self.velocities['knockback'].vel /= 1.2;
            if (self.velocities['knockback'].vel < 0.5) {
                delete self.velocities['knockback']
            }
        }
        superSelf.update();
    }

    return self;
}

var Pile = (initPack = {}, items = []) => {
    var self = Entity({
        items: items,
        objectType: 'PILE',
        width: 30,
        height: 20,
        ...initPack
    })
    var superSelf = {
        ...self
    }

    self.initPack = () => {
        return {
            items: items,
            ...superSelf.initPack()
        }
    }

    self.addToHandler(server.handler);

    return self;
}

var Player = (initPack = {}) => {
    var self = RPGLivingEntity({
        ...initPack,
        ...RectangleBodyParameters
    });

    var superSelf = {
        update: self.update,
        updatePack: self.updatePack
    }

    // Constants 
    self.maxAcc = 10;
    self.jumpAcc = 10;
    self.groundSpeed = 0.2;
    self.width = 44;
    self.height = 18;

    self.objectType = "PLAYER";

    self.rotation = Math.PI / 2;
    self.color = SpoolMath.randomHsvColor(0.5, 0.8);
    self.roofZone = null;

    self.inventory.add(Item('ash', 10));


    self.equip.add(Item('iron_helmet', 1))
    self.equip.add(Item('iron_sword', 1))
    self.equip.add(Item('iron_sword', 1))
    self.inventory.add(Item('iron_shield', 1))
    self.inventory.add(Item('iron_shield', 1))

    self.update = () => {
        self.updateInputVel();
        self.roofZone = null;
        superSelf.update();
    }

    self.melle = (data) => {
        if (!self.leftHandActive) {
            self.asyncUpdatePackage.leftHandMovement = {
                type: 'slash',
                id: Math.random(),
                params: {
                    angle: SpoolMath.globalAngle(self.x, self.y, data.clickedX, data.clickedY),
                    span: Math.PI / 5
                }
            }
            self.leftHandActive = true;
        } else {
            self.asyncUpdatePackage.rightHandMovement = {
                type: 'slash',
                id: Math.random(),
                params: {
                    angle: SpoolMath.globalAngle(self.x, self.y, data.clickedX, data.clickedY),
                    span: Math.PI / 5
                }
            }
            self.leftHandActive = false;
        }
        damageManager.addDamageImpulseRadial(self.x, self.y, SpoolMath.globalAngle(self.x, self.y, data.clickedX, data.clickedY), Math.PI / 5, 100, {
            owner: self,
            dmg: 10,
            type: 'physical'
        })
    }

    //// EQUIP 


    self.getCurrentEquip = () => {
        return self.equip.returnObject();
    }

    self.updateEquip = () => {
        var equip = self.getCurrentEquip();

        self.asyncUpdatePackage.equip = equip;
    }

    self.equip.onUpdate = self.updateEquip;

    //// CONVERSATION 

    self.updateConversationPosition = () => {
        self.asyncUpdatePackage.conversation = self.getCurrentConversation();
    }

    self.getCurrentConversation = () => {
        if (self.conversation) {

            var options = []
            var keys = Object.keys(self.conversation.conversation.options);

            keys.forEach(key => {
                if (self.conversation.conversation.options[key]) {
                    var price = self.conversation.conversation.options[key].price;
                    var reward = self.conversation.conversation.options[key].reward;
                } else {
                    var price = undefined;
                    var reward = undefined;
                }

                var availible = (price ? self.inventory.containsBulk(price.items) : true);

                options.push({
                    response: key,
                    price: price,
                    reward: reward,
                    availible: availible
                })
            })
            return {
                message: self.conversation.conversation.message,
                options: options,
                oponent: {
                    objectType: self.conversation.oponent.objectType,
                    id: self.conversation.oponent.id
                }
            }
        } else {
            return null;
        }
    }

    self.updateFocusObject = (object) => {
        self.focusObject = object;
        if (object) {
            self.asyncUpdatePackage.focusObject = {
                objectType: object.objectType,
                id: object.id
            }
        } else {
            self.asyncUpdatePackage.focusObject = null
        }
    }

    self.moveInConversation = (option) => {
        if (self.conversation) {
            if (option in self.conversation.conversation.options) {
                var selectedOption = self.conversation.conversation.options[option];

                if (selectedOption == null) {
                    self.conversation.oponent.standStill = false;

                    self.updateFocusObject(null);
                    self.standStill = false;
                    self.conversation = null;
                } else {
                    var price = selectedOption.price
                    var reward = selectedOption.reward
                    if (price) {
                        if (self.inventory.containsBulk(price.items)) {
                            self.inventory.removeBulk(price.items);
                            if (reward) {
                                self.inventory.addBulk(reward.items);
                            }
                        } else {
                            return false;
                        }
                    }

                    self.conversation.conversation = selectedOption;
                }
            }

        }
        self.updateConversationPosition();
    }

    self.interaction = obj => {
        if (['NPC', 'NPC_KID', 'POST'].includes(obj.objectType)) {
            if (obj.bigConversation) {
                self.conversation = {
                    oponent: obj,
                    conversation: obj.bigConversation
                }

                self.updateFocusObject(obj);

                self.standStill = true;
                obj.standStill = true;

                self.updateConversationPosition();
            } else {
                obj.talk();
            }
        } else if (obj.objectType == 'TREE') {
            self.inventory.add(Item('berry', 1));
        }
    }

    /**
     * Updates velocities from keyboard input
     */
    self.updateInputVel = () => {
        // setting the basic values
        if (!self.standStill) {
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
        } else {
            self.setVelVector('x-movement', [0, 0]);
        }
    }

    self.updateEquip()
    return self;
};

var Npc = (initPack = {}) => {
    var self = RPGLivingEntity({

        objectType: "NPC",
        ...initPack,
        ...RectangleBodyParameters
    });

    var superSelf = {
        update: self.update
    }

    // Constants 
    self.maxAcc = 10;
    self.jumpAcc = 10;
    self.groundSpeed = 0.2;
    self.width = 44;
    self.height = 18;

    self.rotation = Math.PI / 2;

    self.color = self.color = SpoolMath.randomHsvColor(0.5, 0.8);

    self.roofZone = null;

    // Wandering parameters
    self.tickCounter = 0;

    self.speed = 3;
    self.targetX = 0;
    self.targetY = 0;

    self.maxDistance = 200;
    self.waitTime = SpoolMath.randomInt(0, 100);

    self.message = 0;

    self.bigConversation = {
        message: 'Hello there, may I talk to you?',
        options: {
            'Sure': {
                message: "I don't have anything to say actually. Do you want to chat anyway?",
                options: {
                    'Ok': {
                        message: "Actually, I remembered that I need some ash, for obvious reasons, could you fetch me some?",
                        options: {
                            'Here you go': {
                                price: {
                                    items: [{
                                        value: 'ash',
                                        amount: 5
                                    }]
                                },
                                reward: {
                                    items: [{
                                        value: 'iron_helmet',
                                        amount: 1
                                    }, {
                                        value: 'iron_chestplate',
                                        amount: 1
                                    }, {
                                        value: 'iron_footwear',
                                        amount: 1
                                    }]
                                },
                                message: "Thanks, have some berries",
                                options: {
                                    "No worries and thanks": null
                                }
                            },
                            'Let me get some': null
                        }
                    },
                    'No, not really': {
                        message: ":(",
                        options: {
                            '...': null
                        }
                    }
                }
            },
            'No': {
                message: ":(",
                options: {
                    '...': null
                }
            }
        }
    }

    self.update = () => {
        if (self.standStill) {
            self.setVel('movement', 0, 0);
        } else {

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

            self.roofZone = null;


            if (self.message) {
                if (Date.now() > self.messageExpirationTime) {
                    self.message = null;
                }
            }
        }
        superSelf.update();
    }

    var superUpdatePack = self.updatePack;
    self.updatePack = () => {
        return {
            ...superUpdatePack(),
            roofZone: self.roofZone,
            message: self.message
        };
    };

    self.talk = () => {
        if (self.objectType == 'NPC_KID') {
            self.message = '420 xd';
        } else {
            self.message = 'hello there';
        }

        self.messageExpirationTime = Date.now() + 600;
    }

    return self;
};

var Animal = (initPack = {}) => {
    var self = RPGLivingEntity(initPack);


    self.objectType = "ANIMAL";


    self.rotation = Math.PI / 2;

    self.color = self.color = SpoolMath.randomHsvColor(0.5, 0.8);

    // Wandering parameters
    self.tickCounter = 0;

    self.speed = 3;
    self.targetX = 0;
    self.targetY = 0;

    self.maxDistance = 200;
    self.waitTime = SpoolMath.randomInt(0, 100);

    // Size
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

var Wall = (initPack = {}) => {
    var self = Entity({
        objectType: 'WALL',
        ...initPack,
        ...RectangleBodyParameters,
        wallHeight: 1
    });

    var superSelf = {
        initPack: self.initPack
    };

    self.width = GRID_SIZE;
    self.height = GRID_SIZE;

    self.rotation = Math.PI / 2;
    self.color = self.color = SpoolMath.randomHsvColor(0.5, 0.8);
    self.static = true;

    self.gridColRemoval = true;

    self.initPack = () => {
        return {
            ...superSelf.initPack(),
            wallHeight: self.wallHeight,
            roofZone: self.zones['roof']

        }
    }

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
};

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
    self.gridColRemoval = true;

    self.addToHandler(server.handler);

    return self;
};

var Roof = (initPack = {}) => {
    var self = Entity({
        objectType: "ROOF",
        ...initPack,
        ...RectangleBodyParameters
    });
    var superSelf = {
        initPack: self.initPack
    }

    self.width = GRID_SIZE;
    self.height = GRID_SIZE;

    self.rotation = Math.PI / 2;
    self.color = self.color = SpoolMath.randomHsvColor(0.5, 0.8);
    self.static = true;
    self.gridColRemoval = true;

    self.initPack = () => {
        return {
            ...superSelf.initPack(),
            roofZone: self.zones['roof']
        }
    }

    return self;
};

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

    self.addToHandler(server.handler);

    return self;
};

var Post = (initPack = {}) => {
    var self = Entity({
        ...initPack,
        ...RectangleBodyParameters
    });

    self.width = 48;
    self.height = 20;
    self.objectType = "POST";
    self.rotation = Math.PI / 2;
    self.color = self.color = SpoolMath.randomHsvColor(0.5, 0.8);
    self.static = true;

    self.bigConversation = {
        message: "Welcome to the Spool village",
        options: {
            'fuck...': null
        }
    }

    self.addToHandler(server.handler);

    return self;
};

var Flower = (initPack = {}) => {
    var self = Entity({
        ...initPack,
        ...RectangleBodyParameters
    });

    self.width = 24;
    self.height = 24;
    self.objectType = "FLOWER";
    self.rotation = Math.PI / 2;
    self.color = self.color = SpoolMath.randomHsvColor(0.5, 0.8);
    self.static = true;

    self.addToHandler(server.handler);

    return self;
};
////// MANAGERS //////

var DamageManager = (handler, colPairs) => {

    var self = {
        handler,

        damageImpulse: [],
        evaluatedImpulses: []
    }

    self.update = (object) => {
        if (!object.damage) {
            return null;
        }
        self.evaluatedImpulses.forEach(di => {
            var dx = di.x;
            var dy = di.y;
            var radius = di.radius;
            var angleStart = di.angleStart;
            var angleEnd = di.angleEnd;
            var damage = di.damage;

            var ox = object.x;
            var oy = object.y;



            if (SpoolMath.distance(dx, dy, ox, oy) < radius) {
                var angle = SpoolMath.globalAngle(dx, dy, ox, oy)
                if (angleStart <= angle && angle <= angleEnd) {
                    object.damage({
                        ...damage,
                        direction: angle
                    })
                }
            }
        })
    }

    self.addDamageImpulseRadial = (x, y, angle, span, radius, damage) => {
        var a = SpoolMath.polarPoint(x, y, radius, angle - span);
        var b = SpoolMath.polarPoint(x, y, radius, angle + span);

        // handler.add(Line({
        //     x: x,
        //     y: y,
        //     xx: a.x,
        //     yy: a.y
        // }))
        // handler.add(Line({
        //     x: x,
        //     y: y,
        //     xx: b.x,
        //     yy: b.y
        // }))

        return self.damageImpulse.push({
            x: x,
            y: y,
            angleStart: angle - span,
            angleEnd: angle + span,
            radius: radius,
            damage: damage
        })


    }

    self.addSplashDamage = (x, y, radius, damage) => {
        return self.damageImpulse.push({
            x: x,
            y: y,
            angleStart: 0,
            angleEnd: Math.PI * 2,
            radius: radius,
            damage: damage
        })
    }

    self.handlerUpdate = () => {
        self.evaluatedImpulses = [...self.damageImpulse];
        self.damageImpulse = [];
    }

    return self;
}

var damageManager = DamageManager(server.handler)
server.handler.addManager(damageManager);

var collisionManager = CollisionManager({
    colPairs: [{
            a: LIVING_OBJECTS,
            b: HARD_OBJECTS,
        }, {
            a: ['FIREBALL'],
            b: LIVING_OBJECTS,
            func: function (a, b) {
                if (a.parent != b) {

                    server.handler.removeObj(a);

                    if (b.die) {
                        b.die()
                    } else {
                        server.handler.removeObj(b);
                        var pile = Pile({
                            x: b.x,
                            y: b.y
                        }, [Item('ash', 5)])
                    }

                }
            }
        }, {
            a: ['FIREBALL'],
            b: HARD_OBJECTS,
            func: function (a, b) {
                server.handler.removeObj(a)
            }
        }, {
            a: ['PLAYER'],
            b: ['PILE'],
            notSolid: true,
            func: function (a, b) {

                var leftItems = []
                var pileLeft = false;

                b.items.forEach(element => {
                    var item = a.inventory.add(element);
                    if (item) {
                        leftItems.push(item);
                        pileLeft = true;
                    }
                });
                if (!pileLeft) {
                    server.handler.removeObj(b)
                } else {
                    b.items = leftItems;
                }
            }
        },
        {
            a: ['PLAYER'],
            b: ['ROOF'],
            notSolid: true,
            func: (a, b) => {
                a.roofZone = b.zones['roof'];
            }
        }

    ]
}, server.handler);

server.handler.addManager(collisionManager);

////// MOUSE //////

server.mouseEvent = (data, socket, player) => {
    if (data.type == 'mousedown') {
        if (data.button == 0) {
            player.melle(data);
        } else if (data.button == 2) {
            var res = server.handler.getClosestObject(data.clickedX, data.clickedY, {
                whitelist: INTERACTABLE
            });
            if (res) {
                if (SpoolMath.objDistance(res.object, player) < 100 && res.distance < 30) {
                    player.interaction(res.object);
                }
            }
        }
    }
}


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
        const: Animal
    },
    'NPC': {
        const: Npc,
    },
    'NPC_KID': {
        const: Npc,
        defs: {
            objectType: 'NPC_KID'
        }
    },
    'WALL': {
        const: Wall
    },
    'STONE_WALL': {
        const: Wall,
        defs: {
            objectType: 'STONE_WALL'
        }
    },
    'FENCE': {
        const: Fence
    },
    'TREE': {
        const: Tree
    },
    'POST': {
        const: Post
    },
    'FLOWER': {
        const: Flower
    },
    'GROUND': {
        const: Ground
    },
    'GROUND_SAND': {
        const: Ground,
        defs: {
            objectType: 'GROUND_SAND'
        }
    },
    'GROUND_STONE': {
        const: Ground,
        defs: {
            objectType: 'GROUND_STONE'
        }
    },
    'ROOF': {
        const: Roof,
        defs: {
            objectTYpe: 'ROOF'
        }
    }
})

objSpawner.gx = GRID_SIZE;
objSpawner.gy = GRID_SIZE;

objSpawner.addZonesArray(
    ['./maps/map-roofs.png', './maps/map-zones.png'], {
        'ff0000': 'roof',
        '202020': 'cave',
        '00ff00': 'houses',
        '009000': 'forest',
        '4e2f0e': 'village'
    }, () => {

        objSpawner.spawnRPGWorld({
            objects: './maps/map-objects.png',
            ground: './maps/map-ground.png'
        }, {
            '00ff00': 'GROUND',
            'fffe92': 'GROUND_SAND',
            'ffffff': 'WALL',
            '009000': 'TREE',
            '7e541e': 'FENCE',
            '252525': 'STONE_WALL',
            '646464': 'GROUND_STONE',
            'af865b': 'POST'
        });

        objSpawner.spawnFromImageMap('./maps/map-roofs.png', {
            'ff0000': 'ROOF'
        })

        objSpawner.spawnInZone('ANIMAL', 100, 'cave', 0);
        objSpawner.spawnInZone('NPC', 25, 'houses');
        objSpawner.spawnInZone('NPC_KID', 10, 'village');
        objSpawner.spawnInZone('TREE', 300, 'forest');
        objSpawner.spawnInZone('FLOWER', 200, 'village');
        objSpawner.spawnInZone('ANIMAL', 100, 'forest');
    })


////// STARTING SERVER //////

server.fullStart(Player)