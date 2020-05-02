var MessageCodes = {

    SM_RESET: 'reset',

    SM_PACK_INIT: 'init-pack',
    SM_PACK_UPDATE: 'update-pack',
    SM_PACK_REMOVE: 'remove-pack',

    OS_GET_OBJ: 'get-obj',
    OS_SEND_OBJ: 'send-obj',

    ASIGN_CLIENT_ID: 'asign-id',

    SM_KEY_PRESS: 'key-press',
    SM_MOUSE_INPUT: 'mouse-clicked',

    KI_MOV_LEFT: 'MOV_LEFT',
    KI_MOV_RIGHT: 'MOV_RIGHT',
    KI_MOV_UP: 'KI_MOV_UP',
    KI_MOV_DOWN: 'KI_MOV_DOWN',

    SERVER_LOADING: 'SERVER_LOADING'
}

try {
    module.exports = {
        ...MessageCodes
    }
} catch (e) {
    console.warn('Module exporting is not present. If you are in client make sure you include files correctly in you index file.')
}