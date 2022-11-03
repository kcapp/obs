const debug = require('debug')('kcapp-obs:main');
const host = process.env.KCAPP_API || "localhost";
const port = process.env.PORT || 3000;
const kcapp = require('kcapp-sio-client/kcapp')(host, port, 'smartboard', "http");
const OBSWebSocket = require('obs-websocket-js').default;
const obs = new OBSWebSocket();

const OBS_CONFIG = {
    host: process.env.OBS_HOST || "localhost",
    port: process.env.OBS_PORT || 4455,
    password: process.env.OBS_PASSWORD || "abcd1234"
}

const OBS_HOTKEYS = {
    // KeyId can be found at https://github.com/obsproject/obs-studio/blob/master/libobs/obs-hotkeys.h
    checkout: { keyId: 'OBS_KEY_1', keyModifiers: { control: true, shift: true } },
    fishnchips: { keyId: 'OBS_KEY_2', keyModifiers: { control: true, shift: true } }
}

async function connectObs() {
    try {
        await obs.connect(`ws://${OBS_CONFIG.host}:${OBS_CONFIG.port}`, OBS_CONFIG.password, { rpcVersion: 1 });
        debug(`Connected to obs on ${OBS_CONFIG.host}:${OBS_CONFIG.port}`);
    } catch (error) {
        debug('Failed to connect', error.code, error.message);
        process.exit(-1);
    }
}
connectObs();

function connectToMatch(data) {
    const match = data.match;
    const legId = match.current_leg_id;
    debug(`Connected to match ${match.id}`);
    kcapp.connectLegNamespace(legId, (leg) => {
        debug(`Connected to leg ${legId}`);

        leg.on('score_update', (data) => {
            if (!data.is_undo) {
                for (let i = 0; i < data.players.length; i++) {
                    const player = data.players[i];
                    if (!player.is_current_player) {
                        if (player.modifiers.is_fish_and_chips) {
                            debug("Trigger Fish-n-Chips animation")
                            obs.call('TriggerHotkeyByKeySequence', OBS_HOTKEYS.fishnchips);
                        }
                    }
                }
            }
        });

        leg.on('leg_finished', (data) => {
            debug(`Got leg_finished event!`);
            debug('Trigger Checkout Animation');
            obs.call('TriggerHotkeyByKeySequence', OBS_HOTKEYS.checkout);
        });
    });
}

kcapp.connect(() => {
    kcapp.on('new_match', (data) => {
        connectToMatch(data);
    });
    kcapp.on('warmup_started', (data) => {
        connectToMatch(data);
    });
});
debug("Waiting for matches to start...");
