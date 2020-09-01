'use strict';

const Homey = require('homey');
const Logger = require('../../lib/Logger');
const { TimeoutError } = require('../../lib/exceptions');
const Network = require('../../lib/network');
const math = require('../../lib/math');
const Platform = require('../../lib/castv2-client/senders/Platform');
const DefaultMediaReceiver = require('../../lib/castv2-client/senders/DefaultMediaReceiver');
const YouTube = require('../../lib/castv2-client/senders/YouTube');

module.exports = class ChromecastDevice extends Homey.Device {

    async onInit() {
        this.logger = new Logger({
            logLevel: 4,
            captureLevel: 5,
            logFunc: this.log,
            errorFunc: this.error,
        }, Homey.env);

        await this.migrate();

        this._networkClient = new Network({ log: this.log });
        this._stepInterval = 0.02;

        this.registerCapabilityListener('speaker_playing', value => this.onSpeakerPlaying(value));
        this.registerCapabilityListener('speaker_prev', value => this.onSpeakerPrev(value));
        this.registerCapabilityListener('speaker_next', value => this.onSpeakerNext(value));
        this.registerCapabilityListener('volume_set', value => this.onSetVolume(value));
        this.registerCapabilityListener('volume_mute', value => this.onVolumeMute(value));
        this.registerCapabilityListener('volume_up', value => this.onVolumeUp(value));
        this.registerCapabilityListener('volume_down', value => this.onVolumeDown(value));

        // Create artwork image
        try {
            this.artworkImage = new Homey.Image('jpg')
            this.artworkImage.setUrl(null)
            await this.artworkImage.register();
            this.setAlbumArtImage(this.artworkImage);
        } catch (err) {
            this.logger.error(`Error creating artwork image`, err);
        }

        this.scheduleAvailableJob();
        this.schedulePlayerStatus();
    }

    async migrate() {
        try {
            if (!this.hasCapability('speaker_prev')) {
                await this.addCapability('speaker_prev');
            }
            if (!this.hasCapability('speaker_playing')) {
                await this.addCapability('speaker_playing');
            }
            if (!this.hasCapability('speaker_next')) {
                await this.addCapability('speaker_next');
            }
            if (!this.hasCapability('speaker_artist')) {
                await this.addCapability('speaker_artist');
            }
            if (!this.hasCapability('speaker_album')) {
                await this.addCapability('speaker_album');
            }
            if (!this.hasCapability('speaker_track')) {
                await this.addCapability('speaker_track');
            }
        } catch (err) {
            this.logger.error('Migration failed', err);
        }
    }

    async onAdded() {
    }

    async onDeleted() {
        await this.onDoDelete();
    }

    onDiscoveryResult(discoveryResult) {
        return discoveryResult.id === this.getData().id;
    }

    async onDiscoveryAvailable(discoveryResult) {
        this.logger.verbose('onDiscoveryAvailable', discoveryResult);
        await this._updateDiscovery(discoveryResult);
    }

    async onDiscoveryAddressChanged(discoveryResult) {
        this.logger.verbose('onDiscoveryAddressChanged', discoveryResult);
        await this._updateDiscovery(discoveryResult);
    }

    async _updateDiscovery(discoveryResult) {
        if (this.getStoreValue('ipaddress') !== discoveryResult.address ||
            this.getStoreValue('port') !== discoveryResult.port) {
            await this.setSettings({
                ipaddress: discoveryResult.address,
                modelName: discoveryResult.txt.md
            })
            await this.setStoreValue('ipaddress', discoveryResult.address);
            await this.setStoreValue('port', discoveryResult.port);
            this.logger.info(`IP Address / port has changed: ${discoveryResult.address}:${discoveryResult.port}`);
            await this._onStopPlatform();
        }
    }

    onSettings(oldSettingsObj, newSettingsObj, changedKeysArr, callback) {
        callback(null, true);
    }

    async onDoDelete() {
        this._deleted = true;
        this.clearAvailableTimeout();
        this.clearPlayerStatusTimeout();
        await this.onStopCasting();
        await this._onStopPlatform();
    }

    async onSpeakerPlaying(play) {
        this.logger.debug('onSpeakerPlaying', play);
        if (this._player) {
            return play ? this._player.play() : this._player.pause();
        }
    }

    async onSpeakerPrev(value, opts) {
        this.logger.debug('onSpeakerPrev', value, opts);
        if (this._player) {

        }
    }

    async onSpeakerNext(value, opts) {
        this.logger.debug('onSpeakerNext', value, opts);
        if (this._player) {

        }
    }

    async onSetVolume(level) {
        this.logger.debug('onSetVolume', level);
        await this._createPlatformIfMissing();
        return this._platform.setVolume({ level: level });
    }

    async onVolumeMute(muted) {
        this.logger.debug('onVolumeMute', muted);
        await this._createPlatformIfMissing();
        return this._platform.setVolume({ muted: muted });
    }

    async onVolumeUp(level) {
        const volumeLevel = math.round(Math.min(1.0, this.getCapabilityValue('volume_set') + this._stepInterval));
        await this.setCapabilityValue('volume_set', volumeLevel);
        await this._createPlatformIfMissing();
        return this._platform.setVolume({ level: volumeLevel });
    }

    async onVolumeDown(level) {
        const volumeLevel = math.round(Math.max(0.0, this.getCapabilityValue('volume_set') - this._stepInterval));
        await this.setCapabilityValue('volume_set', volumeLevel);
        await this._createPlatformIfMissing();
        return this._platform.setVolume({ level: volumeLevel });
    }

    async onCastWebsite(website) {
        this.logger.verbose('onCastWebsite', website);
        await this._onStartPlayer(DefaultMediaReceiver);
        await this._player.load({
            contentId: website,
            contentType: 'audio/mp3',
            streamType: 'LIVE'
        }, { autoplay: true });
    }

    async onCastAudio(link) {
        this.logger.verbose('onCastAudio', link);
        await this._onStartPlayer(DefaultMediaReceiver);
        await this._player.load({
            contentId: 'aac',
            contentUrl: link,
            contentType: 'audio/aac',
            streamType: 'LIVE'
        }, { autoplay: true });
    }

    async onCastm3u8(link) {
        this.logger.verbose('onCastm3u8', link);
        await this._onStartPlayer(DefaultMediaReceiver);
        await this._player.load({
            contentId: 'm3u8',
            contentUrl: link,
            streamType: 'LIVE',
            contentType: 'application/vnd.apple.mpegurl',
            //contentType: 'application/x-mpegURL',
        }, { autoplay: true });
    }

    async onCastYouTube(videoId) {
        this.logger.verbose('onCastYouTube', videoId);
        try {
            await this._onStartPlayer(YouTube);
            await this._player.load(videoId);
        } catch (err) {
            this.logger.error(`Error casting YouTube VideoId ${videoId}`, err);
        }
    }

    async onCastYouTubeList(listId) {
        this.logger.verbose('onCastYouTubeList', listId);
        await this._onStartPlayer(YouTube);
        await this._player.playList(listId);
    }

    async onStopCasting() {
        await this._createPlatformIfMissing();
        await this._platform.stop(this._player);
        await this._onStopPlayer();
    }

    clearAvailableTimeout() {
        if (this._availableTimeout) {
            clearTimeout(this._availableTimeout);
            this._availableTimeout = undefined;
        }
    }

    async scheduleAvailableJob(seconds) {
        if (this._deleted) {
            return;
        }
        this.clearAvailableTimeout();
        let interval = seconds;
        if (!interval) {
            let settings = await this.getSettings();
            interval = settings.Available_Interval || 30;
        }
        this._availableTimeout = setTimeout(this.checkAvailableJob.bind(this), interval * 1000);
    }

    async checkAvailableJob() {
        if (this._deleted) {
            return;
        }
        try {
            this.clearAvailableTimeout();
            if (!this._isScanning) {
                this._isScanning = true;
                const host = this.getStoreValue('ipaddress');
                const port = this.getStoreValue('port');
                this._networkClient.scan(host, port, 5000)
                    .then(async result => {
                        this._isScanning = false;
                        if (!this.getAvailable()) {
                            try {
                                await this.setAvailable();
                                this.logger.warn(`Device is available. ${host}:${port}`);
                            } catch (err2) {
                                this.logger.error(`Cannot mark device as available. ${host}:${port} -> ${err2.message}`);
                            }
                        }
                    })
                    .catch(async err => {
                        this._isScanning = false;
                        if (this.getAvailable()) {
                            try {
                                await this.setUnavailable(Homey.__('error.unavailable', { since: new Date().toString() }));
                                await this._onStopPlatform();
                                this.logger.error(`Device was marked as unavailable. ${host}:${port}`);
                            } catch (err2) {
                                this.logger.error(`Cannot mark device as unavailable. ${host}:${port} -> ${err2.message}`);
                            }
                        }
                    });
            }
        } catch (err) {
            this.logger.error('Check available failed', err);
        } finally {
            this.scheduleAvailableJob();
        }
    }

    clearPlayerStatusTimeout() {
        if (this._playerStatusTimeout) {
            clearTimeout(this._playerStatusTimeout);
            this._playerStatusTimeout = undefined;
        }
    }

    async schedulePlayerStatus(seconds = 10) {
        if (this._deleted) {
            return;
        }
        this.clearPlayerStatusTimeout();
        this._playerStatusTimeout = setTimeout(this.checkPlayerStatusJob.bind(this), seconds * 1000);
    }

    async checkPlayerStatusJob() {
        if (this._deleted) {
            return;
        }
        try {
            this.clearPlayerStatusTimeout();
            if (this._platform) {
                this._platform.getStatus();
            }
            if (this._player) {
                await this._player.getStatus();
            }
        } catch (err) {
            this.logger.error('Check player status failed', err);
        } finally {
            this.schedulePlayerStatus();
        }
    }

    async _createPlatformIfMissing() {
        if (this._platformCreating) {
            await this._waitFor(50, 100, () => !this._platformCreating && this._platform);
        } else if (!this._platform) {
            try {
                this._platformCreating = true;
                this._platform = await this._createPlatform();
            } finally {
                this._platformCreating = false;
            }
        }
    }

    _waitFor(iters, delay, check) {
        return new Promise(async (resolve, reject) => {
            while (iters-- > 0) {
                if (check()) {
                    resolve();
                }
                await this._delay(delay);
            }
            this.logger.error(`Wait for timeout`);
            resolve();
        });
    }

    _delay(ms) {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        });
    }

    async _createPlatform() {
        const host = this.getStoreValue('ipaddress');
        const port = this.getStoreValue('port');
        const newPlatform = new Platform(this.logger);
        await newPlatform.connect({
            host: host,
            port: port
        });
        newPlatform.on('error', this._onPlatformError.bind(this));
        newPlatform.on('status', this._onPlatformStatus.bind(this));
        this.logger.verbose(`Platform created`);
        return newPlatform;
    }

    async _onStopPlatform() {
        await this._onStopPlayer();
        if (this._platform) {
            this._platform.removeListener('error', this._onPlatformError.bind(this));
            this._platform.removeListener('status', this._onPlatformStatus.bind(this));
            this._platform.close();
            delete this._platform;
            this._platform = null;
            this.logger.verbose('Platform deleted');
        }
    }

    async _onPlatformError(err) {
        this.logger.error('Platform error', err);
        if (err instanceof TimeoutError) {
            await this._onStopPlatform();
        }
    }

    async _onPlatformStatus(platformStatus, broadcast) {
        if (platformStatus) {
            this.logger.debug('PLATFORM status', JSON.stringify(platformStatus), broadcast);
            this._onVolumeStatus({
                level: platformStatus.volume.level,
                muted: platformStatus.volume.muted,
                stepInterval: platformStatus.volume.stepInterval
            });
            this._lastAppIds = this._getApps(this._currentApplications);
            this._currentApplications = this._getApps(platformStatus.applications);

            const lastAppIds = this._lastAppIds.map(app => app.appId);
            const currentAppIds = this._currentApplications.map(app => app.appId);

            const newApplications = currentAppIds.filter(appId => !lastAppIds.includes(appId));
            if (newApplications.length > 0) {
                this._onStartedCasting(newApplications.map(appId => this._currentApplications.find(app => app.appId === appId)));
            }
            const stoppedApplications = lastAppIds.filter(appId => !currentAppIds.includes(appId));
            if (stoppedApplications.length > 0) {
                this._onStoppedCasting(stoppedApplications.map(appId => this._lastAppIds.find(app => app.appId === appId)));
            }

            if (currentAppIds.length === 0 && this.getCapabilityValue('speaker_playing') === true) {
                this.setCapabilityValue('speaker_playing', false).catch(err => this.logger.error(err));
            }

            const curApp = platformStatus.applications && platformStatus.applications.length === 1 ? platformStatus.applications[0] : undefined;
            if (curApp) {
                if (!this._player && (curApp.appId !== 'CC1AD845' && curApp.appId !== '233637DE')) {
                    await this._onCreateGenericPlayer(curApp);
                }
            }
        }
    }

    async _onVolumeStatus(event) {
        this.logger.debug('Volume status', event);
        if (event.level !== undefined) {
            const volumeLevel = math.round(event.level);
            if (volumeLevel !== this.getCapabilityValue('volume_set')) {
                this.setCapabilityValue('volume_set', volumeLevel).catch(err => this.logger.error(`Error updating volume_set capability`, err));
                this.logger.verbose('_onVolumeStatus: level:', volumeLevel);
            }
        }
        if (event.muted !== undefined && event.muted !== this.getCapabilityValue('volume_mute')) {
            this.setCapabilityValue('volume_mute', event.muted).catch(err => this.logger.error(`Error updating volume_mute capability`, err));
            this.logger.verbose('_onVolumeStatus: muted:', event.muted);
        }
        if (event.stepInterval) {
            this._stepInterval = math.round(event.stepInterval);
        }
    }

    _getApps(apps) {
        return apps ? apps.map(a => ({
            appId: a.appId,
            displayName: a.displayName,
            sessionId: a.sessionId,
            transportId: a.transportId
        })) : [];
    }

    async _onStartedCasting(apps) {
        for (let app of apps) {
            this.logger.verbose('Started casting', app);
            Homey.app.startedCastingTrigger.trigger(this, app, {});
        }
    }

    async _onStoppedCasting(apps) {
        for (let app of apps) {
            this.logger.verbose('Stopped casting', app);
            Homey.app.stoppedCastingTrigger.trigger(this, app, {});
        }
    }

    async _onStartPlayer(Application) {
        await this._createPlatformIfMissing();
        if (!this._player || !(await this._platform.isApplicationRunning(Application))) {
            await this.onStopCasting()
            this._player = await this._platform.launch(Application);
            this._player.on('status', this._onPlayerStatus.bind(this));
            this.logger.verbose(`Started player with app ID: ${Application.APP_ID}`);
        }
        return this._player;
    }

    async _onStopPlayer() {
        if (this._player) {
            this._player.removeListener('status', this._onPlayerStatus.bind(this));
            delete this._player;
            this._player = null;
            if (this.getCapabilityValue('speaker_playing') === true) {
                this.setCapabilityValue('speaker_playing', false).catch(err => this.logger.error(err));
            }
            this.logger.verbose('Player stopped');
        }
    }

    async _onCreateGenericPlayer(session) {
        if (!this._player) {
            this.logger.debug(`Create generic player: ${session.appId} -> ${session.namespaces.map(ns => ns.name)}`);
            this._player = await this._platform.genericPlayer(session);
            this._player.on('status', this._onPlayerStatus.bind(this));
            this.logger.verbose(`Started player with app ID: ${session.appId}`);
        }
    }

    _onPlayerStatus(playerStatus, broadcast) {
        if (playerStatus) {
            this.logger.debug('PLAYER status', JSON.stringify(playerStatus), broadcast);
            const isPlaying = playerStatus.playerState === 'PLAYING';
            if (this.getCapabilityValue('speaker_playing') !== isPlaying) {
                this.setCapabilityValue('speaker_playing', isPlaying).catch(err => this.logger.error(err));
            }

            if (playerStatus.media && playerStatus.media.metadata) {
                const metadata = playerStatus.media.metadata;
                const artist = metadata.artist || metadata.title;
                if (this.getCapabilityValue('speaker_artist') !== artist) {
                    this.setCapabilityValue('speaker_artist', artist).catch(err => this.logger.error(err));
                }
                const album = metadata.albumName || '';
                if (this.getCapabilityValue('speaker_album') !== album) {
                    this.setCapabilityValue('speaker_album', album).catch(err => this.logger.error(err));
                }
                const track = metadata.songName || '';
                if (this.getCapabilityValue('speaker_track') !== track) {
                    this.setCapabilityValue('speaker_track', track).catch(err => this.logger.error(err));
                }
                if (metadata.images && metadata.images.length > 0) {
                    const imageUrl = metadata.images[0].url;
                    if (this._image !== imageUrl) {
                        this._image = imageUrl;
                        this._setImageByUrl(imageUrl);
                    }
                }
            }
        }
    }

    async _setImageByUrl(url) {
        try {
            this.log(`_setImageByUrl -> ${url}`);
            this.artworkImage.setUrl(url)
            await this.artworkImage.update()
        } catch (err) {
            this.logger.error(`Error updating album art`, url, err);
        }
    }

    async isCasting() {
        return this._platform && this._platform.isCasting();
    }

};

/*
SpotifyPlatform = {
            "applications": [{
                "appId": "CC32E753",
                "displayName": "Spotify",
                "iconUrl": "https://lh3.googleusercontent.com/HOX9yqNu6y87Chb1lHYqhKVTQW43oFAFFe2ojx94yCLh0yMzgygTrM0RweAexApRWqq6UahgrWYimVgK",
                "isIdleScreen": false,
                "launchedFromCloud": false,
                "namespaces": [{ "name": "urn:x-cast:com.google.cast.cac" },
                { "name": "urn:x-cast:com.google.cast.debugoverlay" },
                { "name": "urn:x-cast:com.spotify.chromecast.secure.v1" },
                 { "name": "urn:x-cast:com.google.cast.test" },
                 { "name": "urn:x-cast:com.google.cast.broadcast" },
                 { "name": "urn:x-cast:com.google.cast.media" }],
                "sessionId": "a6136cf0-ea50-4fb4-8635-3029de8fd7ac",
                "statusText": "Spotify",
                "transportId": "a6136cf0-ea50-4fb4-8635-3029de8fd7ac",
                "universalAppId": "CC32E753"
            }],
            "userEq": {
                "high_shelf": { "frequency": 4500, "gain_db": 0, "quality": 0.707 },
                "low_shelf": { "frequency": 150, "gain_db": 0, "quality": 0.707 },
                "max_peaking_eqs": 0,
                "peaking_eqs": []
            },
            "volume": {
                "controlType": "master",
                "level": 0.5299999713897705,
                "muted": false,
                "stepInterval": 0.019999999552965164
            }
        }

 SpotifyPlayerStatus = {
            "mediaSessionId": 1,
            "playbackRate": 1,
            "playerState": "PAUSED",
            "currentTime": 0.216,
            "supportedMediaCommands": 514511,
            "volume": { "level": 1, "muted": false },
            "activeTrackIds": [],
            "media": {
                "contentId": "spotify:track:1yoMvmasuxZfqHEipJhRbp",
                "streamType": "BUFFERED",
                "mediaCategory": "AUDIO",
                "contentType": "application/x-spotify.track",
                "metadata": {
                    "metadataType": 3,
                    "title": "Hawái",
                    "songName": "Hawái",
                    "artist": "Maluma",
                    "albumName": "PAPI JUANCHO",
                    "images": [{
                        "url": "https://i.scdn.co/image/ab67616d00001e0287d15f78ec75621d40028baf",
                        "height": 300,
                        "width": 300
                    }, {
                        "url": "https://i.scdn.co/image/ab67616d0000485187d15f78ec75621d40028baf",
                        "height": 64,
                        "width": 64
                    }, {
                        "url": "https://i.scdn.co/image/ab67616d0000b27387d15f78ec75621d40028baf",
                        "height": 640,
                        "width": 640
                    }]
                },
                "entity": "spotify:track:1yoMvmasuxZfqHEipJhRbp",
                "duration": 199.112,
                "tracks": [],
                "breaks": [],
                "breakClips": []
            },
            "currentItemId": 1,
            "items": [{
                "itemId": 1,
                "media": {
                    "contentId": "spotify:track:1yoMvmasuxZfqHEipJhRbp",
                    "streamType": "BUFFERED",
                    "mediaCategory": "AUDIO",
                    "contentType": "application/x-spotify.track",
                    "metadata": {
                        "metadataType": 3,
                        "title": "Hawái",
                        "songName": "Hawái",
                        "artist": "Maluma",
                        "albumName": "PAPI JUANCHO",
                        "images": [{
                            "url": "https://i.scdn.co/image/ab67616d00001e0287d15f78ec75621d40028baf",
                            "height": 300,
                            "width": 300
                        }, {
                            "url": "https://i.scdn.co/image/ab67616d0000485187d15f78ec75621d40028baf",
                            "height": 64,
                            "width": 64
                        }, {
                            "url": "https://i.scdn.co/image/ab67616d0000b27387d15f78ec75621d40028baf",
                            "height": 640,
                            "width": 640
                        }]
                    },
                    "entity": "spotify:track:1yoMvmasuxZfqHEipJhRbp",
                    "duration": 199.112
                },
                "autoplay": false,
                "customData": { "isForcingLoadOnlyToUpdateUI": true },
                "orderId": 0
            }],
            "repeatMode": "REPEAT_OFF"
        }


    NrkPlatform = {
            "applications": [{
                "appId": "A49874B1",
                "displayName": "NRK Radio",
                "iconUrl": "https://lh3.googleusercontent.com/Jxwb27gVAOOtugOLgwCtYfobZbv2uh07w9EcsqYzp3m9HX4P-HKgYSCM83mjd13DGQUVY7aX9O4VMR1H",
                "isIdleScreen": false,
                "launchedFromCloud": false,
                "namespaces": [{ "name": "urn:x-cast:com.google.cast.cac" },
                 { "name": "urn:x-cast:com.google.cast.debugoverlay" },
                 { "name": "urn:x-cast:nrktv.chromecast.error" },
                  { "name": "urn:x-cast:nrktv.chromecast.command" },
                  { "name": "urn:x-cast:nrktv.chromecast.debug" },
                  { "name": "urn:x-cast:com.google.cast.broadcast" },
                   { "name": "urn:x-cast:com.google.cast.media" }],
                "sessionId": "b5859ba1-5e7f-4353-a162-749ac4136cf5",
                "statusText": "Casting: NRK P1+",
                "transportId": "b5859ba1-5e7f-4353-a162-749ac4136cf5",
                "universalAppId": "A49874B1"
            }],
            "userEq": {
                "high_shelf": { "frequency": 4500, "gain_db": 0, "quality": 0.707 },
                "low_shelf": { "frequency": 150, "gain_db": 0, "quality": 0.707 },
                "max_peaking_eqs": 0,
                "peaking_eqs": []
            },
            "volume": {
                "controlType": "master",
                "level": 0.46000000834465027,
                "muted": false,
                "stepInterval": 0.019999999552965164
            }
        };

         NrkPlayer = {
            "mediaSessionId": 1,
            "playbackRate": 1,
            "playerState": "PLAYING",
            "currentTime": 10770.438048,
            "supportedMediaCommands": 274447,
            "volume": { "level": 1, "muted": false },
            "activeTrackIds": [],
            "media": {
                "contentId": "p1pluss",
                "contentUrl": "https://nrk-p1pluss.akamaized.net/47/0/hls/nrk_p1_pluss/playlist.m3u8?no_subtitles=",
                "streamType": "LIVE",
                "contentType": "application/vnd.apple.mpegurl",
                "metadata": {
                    "metadataType": 0,
                    "title": "NRK P1+",
                    "subtitle": "Direkte",
                    "images": [{ "url": "https://gfx.nrk.no/SQXDTEJ7Jwh3dmDQxe2nLQEq04rVxEAn6D6WEWJEFBlg" }]
                },
                "tracks": [{ "trackId": 1, "trackContentType": "video/mp2t", "type": "AUDIO" }],
                "textTrackStyle": {
                    "fontScale": 0.8,
                    "backgroundColor": "#000000B0",
                    "fontFamily": "Helvetica Neue,Helvetica,Arial,sans-serif",
                    "fontGenericFamily": "SANS_SERIF"
                },
                "customData": {
                    "manifestName": "default",
                    "liveProgress": 99.87040178372138,
                    "live": {
                        "progress": 99.8703924934947,
                        "currentTimeSec": 10750.049048,
                        "durationSec": 10764.000000000231,
                        "currentTimeTimestamp": 1598604327411,
                        "startOfBufferTimestamp": 1598593577362,
                        "endOfBufferTimestamp": 1598604341362,
                        "streamStartedTimestamp": 1598593607973,
                        "timeSinceStaredSec": 20.389,
                        "timeSinceStartedSec": 20.389,
                        "valuesUpdatedTimestamp": 1598604392362
                    }
                },
                "breaks": [],
                "breakClips": []
            },
            "queueData": { "name": "NRK spilleliste", "shuffle": false },
            "currentItemId": 1,
            "items": [{
                "itemId": 1,
                "media": {
                    "contentId": "p1pluss",
                    "contentUrl": "https://nrk-p1pluss.akamaized.net/47/0/hls/nrk_p1_pluss/playlist.m3u8?no_subtitles=",
                    "streamType": "LIVE",
                    "contentType": "application/vnd.apple.mpegurl",
                    "metadata": {
                        "metadataType": 0,
                        "title": "NRK P1+",
                        "subtitle": "Direkte",
                        "images": [{ "url": "https://gfx.nrk.no/SQXDTEJ7Jwh3dmDQxe2nLQEq04rVxEAn6D6WEWJEFBlg" }]
                    },
                    "duration": -1,
                    "tracks": [],
                    "customData": { "manifestName": "default" }
                },
                "preloadTime": 10,
                "customData": { "manifestName": "default" },
                "orderId": 0
            }],
            "repeatMode": "REPEAT_OFF",
            "liveSeekableRange": {
                "start": 9.600000000000364,
                "end": 10773.600000000231,
                "isMovingWindow": true,
                "isLiveDone": false
            }
        };

    YouTubePlatform = {
        "applications": [{
            "appId": "233637DE",
            "displayName": "YouTube",
            "iconUrl": "https://lh3.googleusercontent.com/fYXhG7TGRR7Kz9Teq7NVeDCWSjE-WzTMaN69EfXJCEHvTMxxCC8SdopLZEM27uhBHc4MlRypmDPH03ySJw",
            "isIdleScreen": false,
            "launchedFromCloud": false,
            "namespaces": [{ "name": "urn:x-cast:com.google.cast.debugoverlay" },
             { "name": "urn:x-cast:com.google.cast.cac" },
            { "name": "urn:x-cast:com.google.cast.media" },
             { "name": "urn:x-cast:com.google.youtube.mdx" }],
            "sessionId": "fe43a535-c782-48d8-8a76-1c31a09ed485",
            "statusText": "YouTube",
            "transportId": "fe43a535-c782-48d8-8a76-1c31a09ed485",
            "universalAppId": "233637DE"
        }],
        "userEq": {
            "high_shelf": { "frequency": 4500, "gain_db": 0, "quality": 0.707 },
            "low_shelf": { "frequency": 150, "gain_db": 0, "quality": 0.707 },
            "max_peaking_eqs": 0,
            "peaking_eqs": []
        },
        "volume": {
            "controlType": "master",
            "level": 0.09999999403953552,
            "muted": false,
            "stepInterval": 0.019999999552965164
        }
    };

    YouTubePlayer = {
            "mediaSessionId": 1330335753,
            "playbackRate": 1,
            "supportedMediaCommands": 262147,
            "volume": { "level": 0.09999999403953552, "muted": false },
            "playerState": "IDLE",
            "customData": { "playerState": -1 }
        };

 */
