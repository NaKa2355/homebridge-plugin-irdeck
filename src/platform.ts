import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { IrdeckApi } from './irdeckApi';
import { Remote } from './remote';
import { ButtonPlatformAccessory } from './buttonAccessory';
import { TogglePlatformAccessory } from './toggleAccessory';

export type AccessoryContext = {
  remote: Remote;
};

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
  public readonly accessories: PlatformAccessory<AccessoryContext>[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);
    this.log.info('PiRem API URL: ', this.config.piremUrl);
    this.log.info('Aim API URL: ', this.config.aimUrl);
    this.log.info(`API polling interval: ${this.config.pollingIntervalMs} ms`);
    this.remotes = new Map();
    this.irdeckApi = new IrdeckApi(this.config.piremUrl as string);
    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory<AccessoryContext>) {
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
          this.remotes.set(
            uuid,
            new Remote(
              remote.getId(),
              remote.getName(),
              remote.getDeviceId(),
              remote.getButtonsList(),
              remote.getTag(),
              this.irdeckApi,
            ),
          );
        } catch {
          this.log.error('faild to get buttons of remote:' + remote.getName());
        }
      }
    }

    //とってきたデータに現在保存されているデータがない場合は保存されているデータを削除する。
    this.remotes.forEach((remote) => {
      const existingRemote = fetchedRemotes.find(fetchedRemote => fetchedRemote.getId() === remote.id);
      const uuid = this.api.hap.uuid.generate(remote.id);
      if (!existingRemote) {
        this.remotes.delete(uuid);
      }
    });
  };

  //リモートのタイプに応じてアクセサリーを変化させる
  private constructAccessory = (remote: Remote, accessory: PlatformAccessory<AccessoryContext>): boolean => {
    switch (remote.tag) {
      case 'button':
        new ButtonPlatformAccessory(this, accessory);
        return true;
      case 'toggle':
        new TogglePlatformAccessory(this, accessory);
        return true;
      default:
        return false;
    }
  };

  private deleteAccessory = () => {
    //アクセサリーにあって取得してきたデータにないアクセサリーを削除する
    this.accessories.forEach((accessory, i) => {
      const uuid = accessory.UUID;
      const exists = this.remotes.has(uuid);
      if (!exists) {
        this.log.info(`deleting accessory: ${accessory.displayName}`);
        this.api.unregisterPlatformAccessories(PLATFORM_NAME, PLATFORM_NAME, [accessory]);
        this.accessories.splice(i, 1);
      }
    });
  };

  //キャッシュからインスタンスを作成
  private createInstanceFromCahce = () => {
    this.accessories.forEach((accessory) => {
      const remote = this.remotes.get(accessory.UUID);
      if (!remote) {
        return;
      }

      this.log.info('Restoring an accessory from cache:', accessory.displayName);
      accessory.context.remote = remote;
      this.constructAccessory(remote, accessory as PlatformAccessory<AccessoryContext>);
    });
  };

  private updateAccessory = () => {
    this.remotes.forEach((remote) => {
      const uuid = this.api.hap.uuid.generate(remote.id);
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

      //アクセサリがキャッシュにない場合
      if (!existingAccessory) {
        const accessory = new this.api.platformAccessory<AccessoryContext>(remote.name, uuid);
        accessory.context.remote = remote;
        if (!this.constructAccessory(remote, accessory)) {
          return;
        }

        this.log.info('Adding new accessory:', accessory.displayName);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.accessories.push(accessory);
        return;
      }

      existingAccessory.context.remote = remote;
      this.api.updatePlatformAccessories([existingAccessory]);
      return;
    });
  };

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent 'duplicate UUID' errors.
   */
  private discoverDevices = async () => {
    try {
      await this.fetchRemotes();
      this.createInstanceFromCahce();

      //ポーリング
      setInterval(() => {
        this.poll();
      }, this.config.pollingIntervalMs);
    } catch {
      this.log.error('faild to fetch remotes');
      //リトライ
      setTimeout(() => {
        this.discoverDevices();
        this.log.error('retrying...');
      }, this.config.pollingIntervalMs);
    }
  };

  private poll = async () => {
    try {
      await this.fetchRemotes();
    } catch {
      this.log.error('faild to fetch remotes');
    }

    this.updateAccessory();
    this.deleteAccessory();
  };
}
