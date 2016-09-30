var server = require('http').createServer()
    ,noble = require('noble')
    ,db = require('./db.sqlite')
    ,dashboard = require('./dashboard')
    ,jsonfile = require('jsonfile')
    ,fs = require('fs')
    ,Nexmo = require('nexmo')
;

var configPath = __dirname + '/config.json',
    config;
try {
    fs.accessSync(configPath, fs.F_OK);
    config = jsonfile.readFileSync(configPath);
} catch (e) {
    console.log('WARN: Config not found; using defaults!');

}

/////
// cleanup
/////

var noblePeripheral;

//process.stdin.resume();//so the program will not close instantly

function exitHandler(options, err) {
    if (options.cleanup) {
        if (noblePeripheral != undefined) {
            noblePeripheral.disconnect(function (error) {
                console.log('disconnected from peripheral: ' + noblePeripheral.uuid);
            });
        }
        db.close();
    }
    if (err) {
        console.log(err.stack);
        process.exit();
    }
    if (options.exit) {
        process.exit();
    }
}

//do something when app is closing
process.on('exit', exitHandler.bind(null, {
    cleanup: true
}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {
    exit: true
}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {
    exit: true
}));

/////
// dashboard
/////

// dashboard.init();

var io = require('socket.io')(server);
io.on('connection', function(client){
    client.on('event', function(data){});
    client.on('disconnect', function(){});
});
server.listen(3000);

/////
// noble - bluetooth to 735
/////

var serviceUuids = ['4e7777fb78c44bc7a8ac3a95dcdbb041'];

noble.on('stateChange', function (state) {
    if (state === 'poweredOn') {
        console.log('bt on, scanning...');
        noble.startScanning(serviceUuids, false);
    } else {
        console.log('bt off!');
        noble.stopScanning();
    }
});

noble.on('discover', function (peripheral) {
    console.log('Found device with local name: ' + peripheral.advertisement.localName);
    console.log('  > advertising the following service uuid\'s: ' + peripheral.advertisement.serviceUuids);
    console.log();

    if (config) {
        var nexmo = new Nexmo({
            apiKey: config.nexmo.key,
            apiSecret: config.nexmo.secret,
            // applicationId: '',
            // privateKey: '',
        });
        // nexmo.message.sendSms('15555551212', '15555551213', 'BT Loaded', {}, function() {});
    }

    peripheral.connect(function (error) {
        console.log('connected to peripheral: %s', peripheral.uuid);
        var noblePeripheral = peripheral;

        peripheral.once('disconnect', function () {
            console.log('disconnected from peripheral! trying to reconnect in 5 secs...');
            setTimeout(function () {
                console.log('trying to reconnect...');
                noble.startScanning(serviceUuids, false);
            }, 5000);
        });

        var services = [
            '4e7777fb78c44bc7a8ac3a95dcdbb041' // primary info service
            , '180f' // battery
            //,'460927b8c25b49e6b8a0e671e51e8d52' // write request service (firmware???)
        ];

        // debug:
        // peripheral.discoverAllServicesAndCharacteristics(function (error, services, characteristics){
        //     for (var i in services) {
        //         if (services[i] == undefined)
        //             continue;
        //         console.log('S  %d uuid: %s', i, services[i].uuid);
        //     }
        //     for (var i in characteristics) {
        //         (function (characteristic) {
        //             characteristic.read(function (error, data) {
        //                 console.log('C uuid: %s', characteristic.uuid);
        //                 console.log(data);
        //             });
        //         })(characteristics[i]);
        //     }
        // });

        peripheral.discoverServices(services, function (error, services) {
            console.log('discovered the following services:');
            for (var i in services) {
                console.log('  %d uuid: %s', i, services[i].uuid);

                if (services[i].uuid === '180f') {
                    var batteryService = services[i];
                    batteryService.discoverCharacteristics(['2a19'], function (error, characteristics) {
                        var batteryLevelCharacteristic = characteristics[0];
                        console.log('discovered Battery Level characteristic');

                        batteryLevelCharacteristic.on('read', function (data, isNotification) {
                            var batteryPercent = data.readUInt8(0);
                            console.log('battery level is %d%', batteryPercent);

                            db.setBatteryStatus(batteryPercent);
                        });
                        // force battery read
                        batteryLevelCharacteristic.read(function (error, data) {});

                        // true to enable notify
                        batteryLevelCharacteristic.notify(true, function (error) {
                            console.log('battery level notification on');
                        });
                    });
                }
                if (services[i].uuid === '4e7777fb78c44bc7a8ac3a95dcdbb041') {
                    var svc = services[i];

                    var tempCharacteristics = [
                        // we only care about the temp of the four probes
                        'e73c489ab8bb494e86c501fd7341f217' // probe 1
                        , '80a6c886eac2489d80dcd264dfc210c2' // probe 2
                        , '3e430fdd525b455a8ab29dc9dbb15f07' // probe 3
                        , '43536d938bd6451d8f2ec54b0516fe8b' // probe 4
                    ];
                    svc.discoverCharacteristics(tempCharacteristics, function (error, characteristics) {
                        for (var c in characteristics) {
                            (function (characteristic) {

                                characteristic.on('read', function (data, isNotification) {
                                    var rawTemp = data.readUInt16LE(0);
                                    var ts = new Date().toISOString();
                                    var probeId = tempCharacteristics.indexOf(characteristic.uuid) + 1;
                                    // temp is offset by +54
                                    var probeTemp = rawTemp - 54;
                                    if (probeTemp < 0) {
                                        console.log('%s - probe %s disconnected', ts, probeId);
                                    }
                                    else {
                                        console.log('%s - probe %s temp is now: %d F', ts, probeId, probeTemp);

                                        db.setProbeTemp(probeId, ts, probeTemp);

                                        io.emit('temp', { probe: probeId, time: ts, temp: probeTemp });
                                    }
                                });

                                // true to enable notify
                                characteristic.notify(true, function (error) {
                                    var probeId = tempCharacteristics.indexOf(characteristic.uuid) + 1;
                                    console.log('probe %s notification on', probeId);
                                });

                            })(characteristics[c]);
                        }
                    });
                }
            }

        });

    });
});