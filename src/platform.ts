import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { IrdeckApi } from './irdeckApi';
import { Remote } from './remote';
import { ButtonPlatformAccessory } from './buttonAccessory';
import { TogglePlatformAccessory } from './toggleAccessory';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class ExampleHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  private irdeckApi: IrdeckApi;
  private remotes: Map<string, Remote>;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);
    this.log.info('PiRem API URL: ', this.config.piremUrl);
    this.log.info('Aim API URL: ', this.config.aimUrl);
    this.log.info(`API polling interval: ${this.config.pollingIntervalMs} ms`)
    this.remotes = new Map();
    this.irdeckApi = new IrdeckApi(this.config.aimUrl as string, this.config.piremUrl as string);
    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
      setInterval(() => {
        this.discoverDevices();
      }, this.config.pollingIntervalMs)
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  private fetchRemotes = async () => {
    const fetchedRemotes = await this.irdeckApi.getRemotes();

    for (const remote of fetchedRemotes) {
      const uuid = this.api.hap.uuid.generate(remote.getId());
      const existingRemote = this.remotes.get(uuid);
      if (existingRemote) {
        existingRemote.name = remote.getName();
        existingRemote.deviceId = remote.getDeviceId();
        this.remotes.set(uuid, existingRemote);
      } else {
        try {
          const buttons = await this.irdeckApi.getButtons(remote.getId());
          this.remotes.set(
            uuid,
            new Remote(
              remote.getId(),
              remote.getName(),
              remote.getDeviceId(),
              buttons,
              remote.getTag(),
              this.irdeckApi
            )
          )
        } catch {
          this.log.error("faild to get buttons of remote:" + remote.getName());
        }
      }
    }

    this.remotes.forEach((remote) => {
      const existingRemote = fetchedRemotes.find(fetchedRemote => fetchedRemote.getId() === remote.id);
      const uuid = this.api.hap.uuid.generate(remote.id);
      if (!existingRemote) {
        this.remotes.delete(uuid);
      }
    })
  }


  private updateAccessory = (
    remotes: Map<string, Remote>,
    constructAccessory: (accessory: PlatformAccessory<{ remote: Remote }>, remote: Remote) => boolean
  ) => {
    remotes.forEach((remote) => {
      const uuid = this.api.hap.uuid.generate(remote.id);
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

      if (existingAccessory) {
        if (!!existingAccessory.context.isStored) {
          existingAccessory.context.remote = remote;
          this.log.info('Updating accessory:', existingAccessory.displayName);
          this.api.updatePlatformAccessories([existingAccessory]);
        }
        existingAccessory.context.isStored = true;
        existingAccessory.context.remote = remote;
        constructAccessory(existingAccessory as PlatformAccessory<{ remote: Remote }>, remote);
        return;
      }

      //アクセサリがキャッシュにない場合
      const accessory = new this.api.platformAccessory<{ remote: Remote, isStored: boolean }>(remote.name, uuid);
      accessory.context.remote = remote;
      accessory.context.isStored = true;
      this.log.info('Adding new accessory:', accessory.displayName);
      constructAccessory(accessory, remote);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory])
      this.accessories.push(accessory);
    })

    //アクセサリーにあって取得してきたデータにないアクセサリーを削除する
    for (let i = 0; i < this.accessories.length; i++) {
      const accessory = this.accessories[i];
      const uuid = accessory.UUID;
      const exists = remotes.has(uuid)
      if (!exists) {
        this.log.info(`deleting accessory: ${accessory.displayName}`)
        this.api.unregisterPlatformAccessories(PLATFORM_NAME, PLATFORM_NAME, [accessory])
        this.accessories.splice(i, 1)
      }
    }
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  async discoverDevices() {
    try {
      await this.fetchRemotes();
      // loop over the discovered devices and register each one if it has not already been registered
      this.updateAccessory(this.remotes, (accessory, remote) => {
        switch (remote.tag) {
          case "button":
            new ButtonPlatformAccessory(this, accessory);
            return true
          case "toggle":
            new TogglePlatformAccessory(this, accessory);
            return true;;
          default:
            return false;
        }
      })
    } catch {
      this.log.error("faild to fetch remotes");
    }
  }
}
