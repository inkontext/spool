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